/**
 * verify.mjs — Kiểm chứng phân quyền thực sự hoạt động.
 *
 * Chạy:  node directus/schema/verify.mjs
 *
 * Script này đăng nhập bằng tài khoản auditor (KHÔNG phải admin) rồi thử làm
 * những việc lẽ ra phải bị chặn. Đây là thói quen quan trọng: đừng tin phân
 * quyền chỉ vì đã cấu hình xong — phải tự tấn công hệ thống của mình để kiểm tra.
 *
 * Nó cũng tạo 2 auditor để chứng minh: auditor A không thấy được audit của B.
 */

import { DIRECTUS_URL, login as loginAdmin, api as adminApi, log } from './lib.mjs';

/* ------------------------------------------------------------------ */
/* Client riêng cho user thường (lib.mjs chỉ giữ 1 token admin)         */
/* ------------------------------------------------------------------ */

async function loginAs(email, password) {
  const res = await fetch(`${DIRECTUS_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`Không đăng nhập được ${email}: ${res.status}`);
  const { data } = await res.json();

  // Trả về một hàm gọi API đã gắn sẵn token của user này
  return async function call(path, init = {}) {
    const { body, ...rest } = init;
    const r = await fetch(`${DIRECTUS_URL}${path}`, {
      ...rest,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${data.access_token}`,
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const text = await r.text();
    const parsed = text ? JSON.parse(text) : null;
    if (!r.ok) {
      const err = new Error(parsed?.errors?.[0]?.message ?? text);
      err.status = r.status;
      throw err;
    }
    return parsed?.data ?? null;
  };
}

/* ------------------------------------------------------------------ */
/* Bộ khung test nhỏ                                                   */
/* ------------------------------------------------------------------ */

let passed = 0;
let failed = 0;

async function expect(label, fn) {
  try {
    await fn();
    console.log(`  \x1b[32m✓ PASS\x1b[0m  ${label}`);
    passed++;
  } catch (e) {
    console.log(`  \x1b[31m✗ FAIL\x1b[0m  ${label}\n         \x1b[31m${e.message}\x1b[0m`);
    failed++;
  }
}

/** Khẳng định lời gọi API PHẢI bị từ chối vì thiếu quyền (403/401/404). */
async function mustBeDenied(fn) {
  try {
    await fn();
  } catch (e) {
    if (e.status === 403 || e.status === 401 || e.status === 404) return; // đúng như mong đợi
    throw new Error(`Bị chặn nhưng sai kiểu lỗi: ${e.status} ${e.message}`);
  }
  throw new Error('KHÔNG bị chặn — đây là lỗ hổng bảo mật!');
}

/**
 * Khẳng định lời gọi API PHẢI bị từ chối, chấp nhận cả 400 (validation).
 * Tách riêng vì Directus trả 400 khi payload vi phạm `validation`,
 * còn 403 khi vi phạm `permissions` filter — hai cơ chế khác nhau.
 */
async function mustBeRejected(fn) {
  try {
    await fn();
  } catch (e) {
    if ([400, 401, 403, 404].includes(e.status)) return;
    throw new Error(`Bị chặn nhưng sai kiểu lỗi: ${e.status} ${e.message}`);
  }
  throw new Error('KHÔNG bị chặn — đây là lỗ hổng bảo mật!');
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

/* ------------------------------------------------------------------ */

const AUDITOR_A = { email: 'auditor@example.com', password: 'Auditor123!' };
const AUDITOR_B = { email: 'auditor2@example.com', password: 'Auditor123!' };

async function main() {
  log.step('Chuẩn bị: đảm bảo có 2 tài khoản auditor');
  await loginAdmin();

  const roles = await adminApi(`/roles?limit=-1&fields=id,name&filter[name][_eq]=Auditor`);
  assert(roles.length, 'Chưa có role Auditor — chạy setup-roles.mjs trước');
  const roleId = roles[0].id;

  const existingB = await adminApi(
    `/users?limit=-1&fields=id&filter[email][_eq]=${encodeURIComponent(AUDITOR_B.email)}`,
  );
  if (!existingB.length) {
    await adminApi('/users', {
      method: 'POST',
      body: {
        email: AUDITOR_B.email,
        password: AUDITOR_B.password,
        first_name: 'Trần',
        last_name: 'Kiểm Toán Hai',
        role: roleId,
        status: 'active',
      },
    });
    log.ok(`tạo ${AUDITOR_B.email}`);
  } else {
    log.skip(AUDITOR_B.email);
  }

  const stores = await adminApi('/items/stores?limit=2&fields=id,code');
  const templates = await adminApi('/items/templates?limit=1&fields=id,name');
  assert(stores.length >= 2 && templates.length, 'Thiếu dữ liệu mẫu — chạy seed-data.mjs trước');

  const A = await loginAs(AUDITOR_A.email, AUDITOR_A.password);
  const B = await loginAs(AUDITOR_B.email, AUDITOR_B.password);
  log.ok('đăng nhập được cả 2 auditor');

  /* ================================================================ */
  log.step('Nhóm 1 — Dữ liệu gốc chỉ được đọc');

  await expect('auditor ĐỌC được danh sách cửa hàng', async () => {
    const rows = await A('/items/stores?limit=-1&fields=id,code');
    assert(rows.length >= 6, `chỉ thấy ${rows.length} cửa hàng`);
  });

  await expect('auditor KHÔNG sửa được cửa hàng', () =>
    mustBeDenied(() =>
      A(`/items/stores/${stores[0].id}`, { method: 'PATCH', body: { name: 'Bị hack' } }),
    ),
  );

  await expect('auditor KHÔNG tạo được cửa hàng mới', () =>
    mustBeDenied(() =>
      A('/items/stores', { method: 'POST', body: { code: 'HACK-001', name: 'Hack' } }),
    ),
  );

  await expect('auditor KHÔNG sửa được bộ tiêu chí', () =>
    mustBeDenied(() =>
      A(`/items/templates/${templates[0].id}`, { method: 'PATCH', body: { name: 'Bị sửa' } }),
    ),
  );

  /* ================================================================ */
  log.step('Nhóm 2 — Preset tự gán người thực hiện');

  let auditA;
  await expect('tạo audit KHÔNG cần gửi trường auditor (preset tự điền)', async () => {
    auditA = await A('/items/audits', {
      method: 'POST',
      body: {
        store: stores[0].id,
        template: templates[0].id,
        date_started: new Date().toISOString(),
        // cố tình KHÔNG gửi `auditor`
      },
    });
    assert(auditA?.id, 'không tạo được audit');
  });

  await expect('audit vừa tạo được gán đúng cho auditor A', async () => {
    const me = await A('/users/me?fields=id');
    const row = await A(`/items/audits/${auditA.id}?fields=id,auditor,status`);
    assert(row.auditor === me.id, `auditor = ${row.auditor}, đáng lẽ = ${me.id}`);
    assert(row.status === 'draft', `status = ${row.status}, đáng lẽ = draft`);
  });

  // Đây là bài test quan trọng nhất file này. Nó từng FAIL, và cái fail đó
  // phơi ra một lỗ hổng thật: preset không chặn được mạo danh, phải thêm
  // validation. Giữ lại test để nếu sau này ai sửa quyền làm hỏng, ta biết ngay.
  await expect('auditor KHÔNG mạo danh được người khác khi tạo audit', async () => {
    const meB = await B('/users/me?fields=id');
    await mustBeRejected(() =>
      A('/items/audits', {
        method: 'POST',
        body: { store: stores[1].id, template: templates[0].id, auditor: meB.id },
      }),
    );
  });

  await expect('auditor KHÔNG tự tạo audit ở trạng thái đã duyệt', async () => {
    await mustBeRejected(() =>
      A('/items/audits', {
        method: 'POST',
        body: { store: stores[1].id, template: templates[0].id, status: 'reviewed' },
      }),
    );
  });

  await expect('auditor KHÔNG chuyển audit của mình sang cho người khác', async () => {
    const meB = await B('/users/me?fields=id');
    await mustBeRejected(() =>
      A(`/items/audits/${auditA.id}`, { method: 'PATCH', body: { auditor: meB.id } }),
    );
  });

  /* ================================================================ */
  log.step('Nhóm 3 — Row-level security: A không thấy dữ liệu của B');

  let auditB;
  await expect('auditor B tạo audit riêng', async () => {
    auditB = await B('/items/audits', {
      method: 'POST',
      body: { store: stores[1].id, template: templates[0].id, date_started: new Date().toISOString() },
    });
    assert(auditB?.id);
  });

  await expect('A liệt kê audit thì KHÔNG thấy audit của B', async () => {
    const rows = await A('/items/audits?limit=-1&fields=id');
    const ids = rows.map((r) => r.id);
    assert(ids.includes(auditA.id), 'A không thấy chính audit của mình');
    assert(!ids.includes(auditB.id), 'A THẤY audit của B — rò rỉ dữ liệu!');
  });

  await expect('A gọi thẳng id audit của B cũng KHÔNG đọc được', () =>
    mustBeDenied(() => A(`/items/audits/${auditB.id}`)),
  );

  await expect('A KHÔNG sửa được audit của B', () =>
    mustBeDenied(() =>
      A(`/items/audits/${auditB.id}`, { method: 'PATCH', body: { note: 'chen ngang' } }),
    ),
  );

  await expect('A KHÔNG xoá được audit của B', () =>
    mustBeDenied(() => A(`/items/audits/${auditB.id}`, { method: 'DELETE' })),
  );

  /* ================================================================ */
  log.step('Nhóm 4 — Đã nộp thì khoá, không sửa được nữa');

  await expect('A sửa được audit của mình khi còn nháp', async () => {
    await A(`/items/audits/${auditA.id}`, { method: 'PATCH', body: { note: 'ghi chú nháp' } });
  });

  await expect('sau khi nộp (submitted) thì A KHÔNG sửa được nữa', async () => {
    await A(`/items/audits/${auditA.id}`, {
      method: 'PATCH',
      body: { status: 'submitted', date_submitted: new Date().toISOString() },
    });
    await mustBeDenied(() =>
      A(`/items/audits/${auditA.id}`, { method: 'PATCH', body: { note: 'sửa lén sau khi nộp' } }),
    );
  });

  await expect('A vẫn ĐỌC được audit đã nộp của mình', async () => {
    const row = await A(`/items/audits/${auditA.id}?fields=id,status,note`);
    assert(row.status === 'submitted');
    assert(row.note === 'ghi chú nháp', `note bị đổi thành "${row.note}"`);
  });

  /* ================================================================ */
  log.step('Dọn dẹp dữ liệu test');
  for (const id of [auditA?.id, auditB?.id].filter(Boolean)) {
    try {
      await adminApi(`/items/audits/${id}`, { method: 'DELETE' });
    } catch {}
  }
  log.ok('đã xoá audit test');

  /* ================================================================ */
  console.log(
    `\n\x1b[1m${failed === 0 ? '\x1b[32m' : '\x1b[31m'}` +
      `Kết quả: ${passed} pass, ${failed} fail\x1b[0m\n`,
  );
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(`\n\x1b[31m✗ Lỗi:\x1b[0m ${err.message}`);
  process.exit(1);
});
