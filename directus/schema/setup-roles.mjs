/**
 * setup-roles.mjs — Tạo Role "Auditor" + tài khoản mẫu để app mobile đăng nhập.
 *
 * Chạy:  node directus/schema/setup-roles.mjs
 *
 * ─── ĐIỂM QUAN TRỌNG: MÔ HÌNH PHÂN QUYỀN CỦA DIRECTUS 11+ ────────────
 *
 * Bản Directus cũ (<=10):   User ──> Role ──> Permissions
 * Bản Directus 11/12:       User ──> Role ──> Access ──> Policy ──> Permissions
 *                                └──────── Access ───────┘  (gán thẳng cũng được)
 *
 * `Policy` (chính sách) là túi chứa các quyền. `Role` chỉ là nhóm người dùng.
 * Bảng `directus_access` nối 2 thứ đó lại. Lợi ích: một policy tái sử dụng cho
 * nhiều role, và có thể gán policy riêng cho 1 user cụ thể mà không đổi role.
 *
 * ─── QUY TẮC PHÂN QUYỀN CHO AUDITOR ─────────────────────────────────
 *
 *  - Cửa hàng / bộ tiêu chí: CHỈ ĐỌC (auditor không được sửa dữ liệu gốc)
 *  - Phiên audit: chỉ thấy và sửa được audit CỦA CHÍNH MÌNH
 *  - Đã nộp (submitted) thì không sửa được nữa
 *  - Được upload ảnh, nhưng chỉ đọc được file của mình
 *
 * Bộ lọc `$CURRENT_USER` là biến động Directus thay bằng id người đang gọi API.
 * Đây chính là row-level security — thứ mà nếu tự code backend bạn phải viết tay
 * ở mọi endpoint.
 */

import { login, api, log } from './lib.mjs';

const POLICY_NAME = 'Auditor Policy';
const ROLE_NAME = 'Auditor';

const AUDITOR_USER = {
  email: 'auditor@example.com',
  password: 'Auditor123!',
  first_name: 'Nguyễn',
  last_name: 'Kiểm Toán',
};

/** Bộ lọc: chỉ những bản ghi audit do chính tôi thực hiện. */
const MINE = { auditor: { _eq: '$CURRENT_USER' } };
/** Bộ lọc gián tiếp: bản ghi con thuộc về audit của tôi. */
const MINE_VIA_AUDIT = { audit: { auditor: { _eq: '$CURRENT_USER' } } };
/** Chỉ audit đang ở trạng thái nháp mới cho sửa. */
const MINE_AND_DRAFT = { _and: [MINE, { status: { _eq: 'draft' } }] };

/**
 * ─── PRESET KHÔNG PHẢI LÀ RÀO CHẮN ──────────────────────────────────
 *
 * Đây là bài học rút ra từ việc tự tấn công hệ thống (xem verify.mjs):
 *
 *   `presets`    = giá trị MẶC ĐỊNH khi client không gửi field đó lên.
 *                  Client gửi giá trị khác -> giá trị của client THẮNG.
 *   `validation` = luật BẮT BUỘC payload phải thoả. Không thoả -> 400.
 *
 * Nếu chỉ đặt preset `auditor: $CURRENT_USER`, auditor A vẫn tạo được audit
 * mang tên auditor B bằng cách gửi thẳng `auditor: <id của B>`. Đã thử và
 * mạo danh THÀNH CÔNG. Phải có `validation` đi kèm mới thực sự chặn được.
 *
 * Quy tắc chung: preset để tiện, validation để an toàn. Luôn dùng cả hai.
 *
 * ─── GIỚI HẠN CỦA VALIDATION ────────────────────────────────────────
 *
 * `validation` chỉ soi được field TRỰC TIẾP của bản ghi đang tạo.
 * Nó KHÔNG đi xuyên quan hệ được — luật `{ audit: { auditor: {...} } }`
 * bị Directus hiểu sai và chặn luôn cả request hợp lệ (đã thử nghiệm).
 * Xem ghi chú ở phần audit_answers bên dưới để biết cách xử lý.
 */

/** Chỉ được tạo audit mang tên chính mình, và luôn bắt đầu ở trạng thái nháp. */
const CREATE_AS_ME = {
  _and: [{ auditor: { _eq: '$CURRENT_USER' } }, { status: { _eq: 'draft' } }],
};
/** Khi sửa audit, không được chuyển quyền sở hữu sang người khác. */
const STAY_MINE = { auditor: { _eq: '$CURRENT_USER' } };

/**
 * Danh sách quyền.
 *  - filter     : giới hạn DÒNG nào được đụng tới ({} = không giới hạn)
 *  - presets    : giá trị tự điền khi client không gửi
 *  - validation : luật payload bắt buộc phải thoả
 */
const PERMISSIONS = [
  /* --- Dữ liệu gốc: chỉ đọc, auditor không được sửa --- */
  { collection: 'stores', action: 'read' },
  { collection: 'templates', action: 'read', filter: { status: { _eq: 'published' } } },
  { collection: 'template_items', action: 'read' },

  /* --- Phiên audit --- */
  {
    collection: 'audits',
    action: 'create',
    presets: { auditor: '$CURRENT_USER', status: 'draft' },
    validation: CREATE_AS_ME, // <- thứ thực sự chặn mạo danh
  },
  { collection: 'audits', action: 'read', filter: MINE },
  { collection: 'audits', action: 'update', filter: MINE_AND_DRAFT, validation: STAY_MINE },
  { collection: 'audits', action: 'delete', filter: MINE_AND_DRAFT },

  /* --- Câu trả lời ---
   * LƯU Ý CÒN HỞ: không thể dùng validation để bắt buộc `audit` phải thuộc
   * về mình (validation không xuyên quan hệ được). Nghĩa là một auditor cố ý
   * vẫn có thể chèn câu trả lời rác vào audit của người khác.
   * Đọc/sửa/xoá thì đã chặn được, chỉ riêng tạo mới là hở.
   * Cách vá đúng: dùng Directus Flow (trigger filter items.create) để kiểm tra
   * quyền sở hữu ở phía server. Sẽ làm ở bước sau khi app đã chạy. */
  { collection: 'audit_answers', action: 'create' },
  { collection: 'audit_answers', action: 'read', filter: MINE_VIA_AUDIT },
  { collection: 'audit_answers', action: 'update', filter: MINE_VIA_AUDIT },
  { collection: 'audit_answers', action: 'delete', filter: MINE_VIA_AUDIT },

  /* --- Lỗi phát hiện (cùng giới hạn như trên) --- */
  { collection: 'findings', action: 'create' },
  { collection: 'findings', action: 'read', filter: MINE_VIA_AUDIT },
  { collection: 'findings', action: 'update', filter: MINE_VIA_AUDIT },
  { collection: 'findings', action: 'delete', filter: MINE_VIA_AUDIT },

  /* --- Bảng trung gian nối ảnh (Directus cần quyền riêng cho junction) --- */
  { collection: 'audit_answers_photos', action: 'create' },
  { collection: 'audit_answers_photos', action: 'read' },
  { collection: 'audit_answers_photos', action: 'update' },
  { collection: 'audit_answers_photos', action: 'delete' },
  { collection: 'findings_photos', action: 'create' },
  { collection: 'findings_photos', action: 'read' },
  { collection: 'findings_photos', action: 'update' },
  { collection: 'findings_photos', action: 'delete' },

  /* --- File: upload được, chỉ thấy file mình tải lên --- */
  { collection: 'directus_files', action: 'create' },
  { collection: 'directus_files', action: 'read', filter: { uploaded_by: { _eq: '$CURRENT_USER' } } },
  { collection: 'directus_files', action: 'update', filter: { uploaded_by: { _eq: '$CURRENT_USER' } } },
];

async function main() {
  log.step('Kết nối Directus...');
  await login();
  log.ok('Đăng nhập admin thành công');

  /* ---------------- 1. Policy ---------------- */
  log.step('1/4  Access Policy');
  const policies = await api(
    `/policies?limit=-1&fields=id,name&filter[name][_eq]=${encodeURIComponent(POLICY_NAME)}`,
  );
  let policyId;
  if (policies.length) {
    policyId = policies[0].id;
    log.skip(`policy "${POLICY_NAME}"`);
  } else {
    const p = await api('/policies', {
      method: 'POST',
      body: {
        name: POLICY_NAME,
        icon: 'verified_user',
        description: 'Quyền của nhân viên đi audit cửa hàng',
        app_access: true,   // cho phép đăng nhập vào Data Studio (tiện để bạn quan sát)
        admin_access: false,
        enforce_tfa: false,
      },
    });
    policyId = p.id;
    log.ok(`policy "${POLICY_NAME}"`);
  }

  /* ---------------- 2. Role ---------------- */
  log.step('2/4  Role');
  const roles = await api(
    `/roles?limit=-1&fields=id,name&filter[name][_eq]=${encodeURIComponent(ROLE_NAME)}`,
  );
  let roleId;
  if (roles.length) {
    roleId = roles[0].id;
    log.skip(`role "${ROLE_NAME}"`);
  } else {
    const r = await api('/roles', {
      method: 'POST',
      body: { name: ROLE_NAME, icon: 'fact_check', description: 'Nhân viên đi kiểm tra cửa hàng' },
    });
    roleId = r.id;
    log.ok(`role "${ROLE_NAME}"`);
  }

  /* ---------------- 3. Nối Role <-> Policy ---------------- */
  log.step('3/4  Gán policy cho role (bảng directus_access)');
  const access = await api(
    `/access?limit=-1&fields=id,role,policy&filter[role][_eq]=${roleId}&filter[policy][_eq]=${policyId}`,
  );
  if (access.length) {
    log.skip('access role -> policy');
  } else {
    await api('/access', { method: 'POST', body: { role: roleId, policy: policyId, sort: 1 } });
    log.ok('access role -> policy');
  }

  /* ---------------- 4. Permissions ---------------- */
  log.step('4/4  Permissions');
  const existing = await api(
    `/permissions?limit=-1&fields=id,collection,action,policy&filter[policy][_eq]=${policyId}`,
  );
  // Map "collection:action" -> id, để biết cái nào đã có mà PATCH lại
  const have = new Map(existing.map((p) => [`${p.collection}:${p.action}`, p.id]));

  // Upsert thay vì chỉ tạo mới: nếu ai đó lỡ sửa quyền trong UI, chạy lại
  // script này sẽ kéo về đúng như khai báo trong code. Code là nguồn sự thật.
  for (const perm of PERMISSIONS) {
    const { collection, action, filter = {}, presets = null, validation = {} } = perm;
    const payload = {
      policy: policyId,
      collection,
      action,
      permissions: filter,
      validation,
      presets,
      fields: ['*'],
    };

    const id = have.get(`${collection}:${action}`);
    if (id) {
      await api(`/permissions/${id}`, { method: 'PATCH', body: payload });
      log.info(`${collection}: ${action} (cập nhật)`);
    } else {
      await api('/permissions', { method: 'POST', body: payload });
      log.ok(`${collection}: ${action}`);
    }
  }

  /* ---------------- 5. Tài khoản auditor mẫu ---------------- */
  log.step('Tài khoản auditor mẫu');
  const users = await api(
    `/users?limit=-1&fields=id,email&filter[email][_eq]=${encodeURIComponent(AUDITOR_USER.email)}`,
  );
  if (users.length) {
    log.skip(AUDITOR_USER.email);
  } else {
    await api('/users', {
      method: 'POST',
      body: { ...AUDITOR_USER, role: roleId, status: 'active' },
    });
    log.ok(AUDITOR_USER.email);
  }

  log.step('✅ Xong!');
  log.info(`Đăng nhập app bằng:  ${AUDITOR_USER.email} / ${AUDITOR_USER.password}`);
  log.info('Thử vào http://localhost:8055 bằng tài khoản này để thấy quyền bị giới hạn thế nào.');
}

main().catch((err) => {
  console.error(`\n\x1b[31m✗ Lỗi:\x1b[0m ${err.message}`);
  if (err.errors) console.error(JSON.stringify(err.errors, null, 2));
  process.exit(1);
});
