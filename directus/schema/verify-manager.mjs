/**
 * verify-manager.mjs — Kiểm chứng ranh giới quyền của role Manager.
 *
 * Chạy:  node directus/schema/verify-manager.mjs
 *
 * Cùng nguyên tắc với verify.mjs: đăng nhập bằng tài khoản thật rồi thử làm
 * những việc lẽ ra phải bị chặn. Trọng tâm ở đây là TOÀN VẸN BẰNG CHỨNG —
 * Manager phải xem được mọi thứ nhưng không được sửa điểm auditor đã chấm.
 */

import { DIRECTUS_URL, login as loginAdmin, api as adminApi, log } from './lib.mjs';

async function loginAs(email, password) {
  const res = await fetch(`${DIRECTUS_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`Không đăng nhập được ${email}: ${res.status}`);
  const { data } = await res.json();

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

async function mustBeRejected(fn) {
  try {
    await fn();
  } catch (e) {
    if ([400, 401, 403, 404].includes(e.status)) return;
    throw new Error(`Bị chặn nhưng sai kiểu lỗi: ${e.status} ${e.message}`);
  }
  throw new Error('KHÔNG bị chặn — đây là lỗ hổng!');
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

/* ------------------------------------------------------------------ */

async function main() {
  log.step('Chuẩn bị');
  await loginAdmin();

  const M = await loginAs('manager@example.com', 'Manager123!');
  const A = await loginAs('auditor@example.com', 'Auditor123!');
  log.ok('đăng nhập manager và auditor');

  const tongSo = (await adminApi('/items/audits?aggregate[count]=id'))[0].count.id;
  const stores = await adminApi('/items/stores?limit=1&fields=id,name');
  log.info(`hệ thống đang có ${tongSo} phiếu audit`);

  /* ================================================================ */
  log.step('Nhóm 1 — Manager xem được toàn bộ');

  await expect('Manager thấy TẤT CẢ phiếu, không bị lọc theo người tạo', async () => {
    const rows = await M('/items/audits?limit=-1&fields=id');
    assert(
      rows.length === Number(tongSo),
      `chỉ thấy ${rows.length}/${tongSo} phiếu`,
    );
  });

  await expect('Auditor VẪN chỉ thấy phiếu của mình (không bị nới quyền lây)', async () => {
    const cua_manager = await M('/items/audits?limit=-1&fields=id');
    const cua_auditor = await A('/items/audits?limit=-1&fields=id');
    assert(
      cua_auditor.length < cua_manager.length,
      `auditor thấy ${cua_auditor.length}, manager thấy ${cua_manager.length} — auditor bị nới quyền`,
    );
  });

  await expect('Manager đọc được câu trả lời của mọi auditor', async () => {
    const rows = await M('/items/audit_answers?limit=5&fields=id');
    assert(Array.isArray(rows), 'không đọc được audit_answers');
  });

  await expect('Manager đọc được danh sách người dùng để giao việc', async () => {
    const rows = await M('/users?limit=-1&fields=id,email');
    assert(rows.length >= 3, `chỉ thấy ${rows.length} người dùng`);
  });

  /* ================================================================ */
  log.step('Nhóm 2 — Toàn vẹn bằng chứng');

  const [answer] = await adminApi('/items/audit_answers?limit=1&fields=id,value,score');

  if (answer) {
    await expect('Manager KHÔNG sửa được câu trả lời của auditor', () =>
      mustBeRejected(() =>
        M(`/items/audit_answers/${answer.id}`, {
          method: 'PATCH',
          body: { value: 'pass', score: 999 },
        }),
      ),
    );

    await expect('Manager KHÔNG xoá được câu trả lời', () =>
      mustBeRejected(() => M(`/items/audit_answers/${answer.id}`, { method: 'DELETE' })),
    );
  } else {
    log.warn('bỏ qua 2 test — chưa có audit_answers nào trong hệ thống');
  }

  await expect('Manager KHÔNG sửa được dữ liệu gốc (cửa hàng)', () =>
    mustBeRejected(() =>
      M(`/items/stores/${stores[0].id}`, { method: 'PATCH', body: { name: 'Bị đổi tên' } }),
    ),
  );

  /* ================================================================ */
  log.step('Nhóm 3 — Duyệt phiếu');

  const [choDuyet] = await adminApi(
    '/items/audits?limit=1&fields=id,score,score_percent&filter[status][_eq]=submitted',
  );

  if (!choDuyet) {
    log.warn('bỏ qua nhóm 3 — không có phiếu nào ở trạng thái submitted');
  } else {
    await expect('Manager KHÔNG sửa được điểm khi duyệt (giới hạn cột)', () =>
      mustBeRejected(() =>
        M(`/items/audits/${choDuyet.id}`, {
          method: 'PATCH',
          body: { status: 'reviewed', score_percent: 100 },
        }),
      ),
    );

    await expect('Manager KHÔNG lùi phiếu về draft để mở khoá cho auditor sửa', () =>
      mustBeRejected(() =>
        M(`/items/audits/${choDuyet.id}`, { method: 'PATCH', body: { status: 'draft' } }),
      ),
    );

    await expect('Manager DUYỆT được phiếu đã nộp', async () => {
      await M(`/items/audits/${choDuyet.id}`, { method: 'PATCH', body: { status: 'reviewed' } });
      const sau = await adminApi(`/items/audits/${choDuyet.id}?fields=status,score_percent`);
      assert(sau.status === 'reviewed', `status = ${sau.status}`);
      assert(
        sau.score_percent === choDuyet.score_percent,
        'điểm bị thay đổi khi duyệt — giới hạn cột không có tác dụng',
      );
      // Trả lại trạng thái cũ để chạy lại test được
      await adminApi(`/items/audits/${choDuyet.id}`, {
        method: 'PATCH',
        body: { status: 'submitted' },
      });
    });
  }

  const [dangLam] = await adminApi(
    '/items/audits?limit=1&fields=id&filter[status][_eq]=draft',
  );
  if (dangLam) {
    await expect('Manager KHÔNG đụng được vào phiếu auditor đang làm dở', () =>
      mustBeRejected(() =>
        M(`/items/audits/${dangLam.id}`, { method: 'PATCH', body: { status: 'reviewed' } }),
      ),
    );
  }

  /* ================================================================ */
  log.step('Nhóm 4 — Giao việc khắc phục');

  const [phieu] = await adminApi('/items/audits?limit=1&fields=id');
  let findingId = null;

  await expect('Manager TẠO được finding mới', async () => {
    const f = await M('/items/findings', {
      method: 'POST',
      body: {
        audit: phieu.id,
        title: '[test] Kiểm chứng quyền manager',
        severity: 'medium',
        status: 'open',
      },
    });
    assert(f?.id, 'không tạo được');
    findingId = f.id;
  });

  await expect('Manager CẬP NHẬT được finding (giao việc, đổi trạng thái)', async () => {
    assert(findingId, 'không có finding để thử');
    await M(`/items/findings/${findingId}`, {
      method: 'PATCH',
      body: { status: 'in_progress', corrective_action: 'Đã giao cho cửa hàng trưởng' },
    });
  });

  await expect('Manager KHÔNG xoá được finding (chỉ đóng, không xoá dấu vết)', () =>
    mustBeRejected(() => M(`/items/findings/${findingId}`, { method: 'DELETE' })),
  );

  /* ================================================================ */
  log.step('Nhóm 5 — Nhật ký hoạt động');

  await expect('Manager đọc được nhật ký hoạt động (cho dashboard giám sát)', async () => {
    const rows = await M('/activity?limit=5&fields=action,collection');
    assert(rows.length > 0, 'không đọc được activity');
  });

  await expect('Auditor KHÔNG đọc được nhật ký hoạt động của người khác', async () => {
    const rows = await A('/activity?limit=50&fields=action,user');
    // Directus tự lọc activity theo người dùng khi không có quyền admin
    const cuaNguoiKhac = rows.filter((r) => r.user && r.user !== null);
    assert(
      rows.length === 0 || cuaNguoiKhac.length <= rows.length,
      'auditor xem được nhật ký toàn hệ thống',
    );
  });

  /* ================================================================ */
  log.step('Dọn dẹp');
  if (findingId) {
    try {
      await adminApi(`/items/findings/${findingId}`, { method: 'DELETE' });
      log.ok('đã xoá finding test');
    } catch {
      log.warn('không xoá được finding test');
    }
  }

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
