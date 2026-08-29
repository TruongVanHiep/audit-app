/**
 * setup-manager.mjs — Role "Manager" cho quản lý vùng / trưởng phòng kiểm soát.
 *
 * Chạy:  node directus/schema/setup-manager.mjs
 *
 * ─── NGUYÊN TẮC: TOÀN VẸN BẰNG CHỨNG ────────────────────────────────
 *
 * Manager đọc được MỌI phiếu audit (khác auditor — chỉ thấy phiếu của mình),
 * duyệt phiếu, và giao việc khắc phục. Nhưng KHÔNG sửa được câu trả lời.
 *
 * Vì sao cấm sửa `audit_answers`? Vì đó là bằng chứng. Một hệ thống audit mà
 * cấp trên sửa được điểm cấp dưới đã chấm thì toàn bộ dữ liệu mất giá trị —
 * không ai còn phân biệt được "cửa hàng này thật sự tốt" với "cửa hàng này
 * được ai đó nâng điểm". Auditor chấm nhầm thì huỷ phiếu làm lại, không sửa lén.
 *
 * Manager cũng chỉ đổi được `status`, và chỉ khi phiếu đã nộp. Không lùi được
 * phiếu về `draft` để mở khoá cho auditor sửa.
 */

import { login, api, log } from './lib.mjs';

const POLICY_NAME = 'Manager Policy';
const ROLE_NAME = 'Manager';

const MANAGER_USER = {
  email: 'manager@example.com',
  password: 'Manager123!',
  first_name: 'Lê',
  last_name: 'Quản Lý',
};

/** Chỉ duyệt được phiếu đã nộp — không đụng vào phiếu auditor đang làm dở. */
const ONLY_SUBMITTED = { status: { _eq: 'submitted' } };

/** Duyệt hoặc huỷ. Không lùi được về draft để mở khoá cho auditor sửa. */
const APPROVE_OR_CANCEL = { status: { _in: ['reviewed', 'cancelled'] } };

/**
 * Mỗi dòng: { collection, action, filter, fields, presets, validation }
 *  - filter {} = không giới hạn dòng nào (Manager xem được tất cả)
 *  - fields mặc định ['*']; đặt danh sách cụ thể để giới hạn cột
 */
const PERMISSIONS = [
  /* --- Dữ liệu gốc: chỉ đọc. Sửa cửa hàng / bộ tiêu chí là việc của admin --- */
  { collection: 'stores', action: 'read' },
  { collection: 'templates', action: 'read' },
  { collection: 'template_items', action: 'read' },

  /* --- Phiếu audit: đọc hết, chỉ duyệt được --- */
  { collection: 'audits', action: 'read' },
  {
    collection: 'audits',
    action: 'update',
    filter: ONLY_SUBMITTED,
    // Giới hạn CỘT: dù client có gửi score hay note lên cũng bị từ chối
    fields: ['status'],
    validation: APPROVE_OR_CANCEL,
  },

  /* --- Câu trả lời: CHỈ ĐỌC. Đây là bằng chứng, không ai sửa được --- */
  { collection: 'audit_answers', action: 'read' },
  { collection: 'audit_answers_photos', action: 'read' },

  /* --- Lỗi cần khắc phục: đây mới là việc chính của Manager --- */
  { collection: 'findings', action: 'create' },
  { collection: 'findings', action: 'read' },
  { collection: 'findings', action: 'update' },
  { collection: 'findings_photos', action: 'create' },
  { collection: 'findings_photos', action: 'read' },
  { collection: 'findings_photos', action: 'delete' },

  /* --- File: xem được ảnh bằng chứng của MỌI auditor.
         Khác auditor — người đó chỉ xem được ảnh mình tải lên. --- */
  { collection: 'directus_files', action: 'read' },
  { collection: 'directus_files', action: 'create' },

  /* --- Người dùng: cần để chọn người giao việc khắc phục.
         Giới hạn cột — Manager không cần biết gì hơn tên và email. --- */
  {
    collection: 'directus_users',
    action: 'read',
    fields: ['id', 'first_name', 'last_name', 'email', 'avatar', 'status'],
  },

  /* --- Nhật ký hoạt động: cho panel logging & monitoring trên dashboard --- */
  { collection: 'directus_activity', action: 'read' },
  { collection: 'directus_revisions', action: 'read' },
];

async function main() {
  log.step('Kết nối Directus...');
  await login();
  log.ok('Đăng nhập admin thành công');

  /* ---------------- Policy ---------------- */
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
        icon: 'supervisor_account',
        description: 'Quản lý vùng: xem toàn bộ, duyệt phiếu, giao khắc phục',
        app_access: true,
        admin_access: false,
        enforce_tfa: false,
      },
    });
    policyId = p.id;
    log.ok(`policy "${POLICY_NAME}"`);
  }

  /* ---------------- Role ---------------- */
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
      body: { name: ROLE_NAME, icon: 'supervisor_account', description: 'Quản lý vùng' },
    });
    roleId = r.id;
    log.ok(`role "${ROLE_NAME}"`);
  }

  /* ---------------- Nối Role <-> Policy ---------------- */
  log.step('3/4  Gán policy cho role');
  const access = await api(
    `/access?limit=-1&fields=id&filter[role][_eq]=${roleId}&filter[policy][_eq]=${policyId}`,
  );
  if (access.length) {
    log.skip('access role -> policy');
  } else {
    await api('/access', { method: 'POST', body: { role: roleId, policy: policyId, sort: 1 } });
    log.ok('access role -> policy');
  }

  /* ---------------- Permissions (upsert) ---------------- */
  log.step('4/4  Permissions');
  const existing = await api(
    `/permissions?limit=-1&fields=id,collection,action&filter[policy][_eq]=${policyId}`,
  );
  const have = new Map(existing.map((p) => [`${p.collection}:${p.action}`, p.id]));

  for (const perm of PERMISSIONS) {
    const {
      collection,
      action,
      filter = {},
      presets = null,
      validation = {},
      fields = ['*'],
    } = perm;
    const payload = {
      policy: policyId,
      collection,
      action,
      permissions: filter,
      validation,
      presets,
      fields,
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

  /* ---------------- Tài khoản mẫu ---------------- */
  log.step('Tài khoản manager mẫu');
  const users = await api(
    `/users?limit=-1&fields=id&filter[email][_eq]=${encodeURIComponent(MANAGER_USER.email)}`,
  );
  if (users.length) {
    log.skip(MANAGER_USER.email);
  } else {
    await api('/users', {
      method: 'POST',
      body: { ...MANAGER_USER, role: roleId, status: 'active' },
    });
    log.ok(MANAGER_USER.email);
  }

  log.step('✅ Xong!');
  log.info(`Đăng nhập: ${MANAGER_USER.email} / ${MANAGER_USER.password}`);
  log.info('Kiểm chứng bằng: node directus/schema/verify-manager.mjs');
}

main().catch((err) => {
  console.error(`\n\x1b[31m✗ Lỗi:\x1b[0m ${err.message}`);
  if (err.errors) console.error(JSON.stringify(err.errors, null, 2));
  process.exit(1);
});
