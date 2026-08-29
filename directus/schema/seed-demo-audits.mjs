/**
 * seed-demo-audits.mjs — Sinh phiếu audit mẫu để dashboard có dữ liệu thật.
 *
 * Chạy:  node directus/schema/seed-demo-audits.mjs [số phiếu]
 *
 * CHỈ DÙNG CHO MÔI TRƯỜNG HỌC TẬP / DEMO. Không chạy trên production.
 * Script tự đánh dấu phiếu demo bằng tiền tố trong `note` để xoá lại được:
 *
 *     node directus/schema/seed-demo-audits.mjs --xoa
 *
 * Dữ liệu được sinh có chủ ý KHÔNG đều: miền Bắc điểm cao, miền Nam điểm thấp,
 * một cửa hàng tệ hẳn. Dashboard mà không lộ ra được những khác biệt đó thì
 * dashboard đó vô dụng — đây chính là cách kiểm chứng nó.
 */

import { login, api, log } from './lib.mjs';

/** Dấu nhận biết phiếu do script sinh ra, để xoá lại cho sạch. */
const DEMO_TAG = '[demo]';

/** Điểm trung bình mong muốn theo khu vực — tạo ra sự khác biệt để nhìn thấy. */
const REGION_BIAS = { north: 88, central: 79, south: 68 };

/** Một cửa hàng cố tình kém hẳn, để bảng "top cửa hàng thấp nhất" có ý nghĩa. */
const STORE_PENALTY = { 'HCM-002': -18 };

const FINDING_TITLES = [
  ['Tem giá không khớp hệ thống', 'high'],
  ['Hàng cận hạn còn trên kệ', 'critical'],
  ['Lối thoát hiểm bị hàng chắn', 'critical'],
  ['Biển hiệu cháy bóng đèn', 'low'],
  ['POSM khuyến mãi hết hạn chưa gỡ', 'medium'],
  ['Nhân viên thiếu bảng tên', 'low'],
  ['Kệ hàng chủ lực trống nhiều ô', 'high'],
  ['Nhà vệ sinh thiếu vật tư', 'medium'],
];

/* ------------------------------------------------------------------ */

const rnd = (min, max) => Math.random() * (max - min) + min;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

/** Ngày ngẫu nhiên trong `days` ngày gần đây. */
function randomDate(days) {
  const d = new Date();
  d.setDate(d.getDate() - Math.floor(rnd(0, days)));
  d.setHours(Math.floor(rnd(8, 18)), Math.floor(rnd(0, 60)), 0, 0);
  return d;
}

async function xoaDemo() {
  log.step('Xoá dữ liệu demo cũ');

  const audits = await api(
    `/items/audits?limit=-1&fields=id&filter[note][_starts_with]=${encodeURIComponent(DEMO_TAG)}`,
  );
  if (!audits.length) {
    log.skip('không có phiếu demo nào');
    return;
  }
  // Xoá theo lô; findings và audit_answers tự xoá theo nhờ ON DELETE CASCADE
  await api('/items/audits', { method: 'DELETE', body: audits.map((a) => a.id) });
  log.ok(`đã xoá ${audits.length} phiếu demo (kèm câu trả lời và finding)`);
}

async function main() {
  const args = process.argv.slice(2);
  const chiXoa = args.includes('--xoa');
  const soPhieu = Number(args.find((a) => /^\d+$/.test(a))) || 60;

  log.step('Kết nối Directus...');
  await login();
  log.ok('Đăng nhập admin thành công');

  await xoaDemo();
  if (chiXoa) {
    log.step('✅ Xong (chỉ xoá).');
    return;
  }

  /* ---------------- Dữ liệu nền ---------------- */
  const stores = await api('/items/stores?limit=-1&fields=id,code,name,region');
  const templates = await api(
    '/items/templates?limit=1&fields=id&filter[status][_eq]=published&sort=-version',
  );
  const items = await api(
    `/items/template_items?limit=-1&fields=id,answer_type,weight,is_critical&filter[template][_eq]=${templates[0].id}`,
  );
  const auditors = await api(
    '/users?limit=-1&fields=id,email&filter[email][_starts_with]=auditor',
  );

  if (!stores.length || !templates.length || !items.length) {
    throw new Error('Thiếu dữ liệu nền — chạy seed-data.mjs trước');
  }
  if (!auditors.length) {
    throw new Error('Chưa có tài khoản auditor — chạy setup-roles.mjs trước');
  }

  const maxScore = items
    .filter((i) => (i.answer_type === 'pass_fail' || i.answer_type === 'score_5') && i.weight > 0)
    .reduce((s, i) => s + i.weight * 5, 0);

  log.step(`Sinh ${soPhieu} phiếu audit trong 90 ngày qua`);
  log.info(`${stores.length} cửa hàng · ${items.length} tiêu chí · điểm tối đa ${maxScore}`);

  let daNop = 0;
  let daDuyet = 0;
  let soFinding = 0;

  for (let n = 0; n < soPhieu; n++) {
    const store = pick(stores);
    const auditor = pick(auditors);
    const batDau = randomDate(90);

    // Điểm mục tiêu: theo khu vực, trừ hao nếu là cửa hàng kém, cộng nhiễu
    const target = Math.max(
      35,
      Math.min(100, (REGION_BIAS[store.region] ?? 75) + (STORE_PENALTY[store.code] ?? 0) + rnd(-10, 10)),
    );

    // 15% phiếu còn đang làm dở, còn lại đã nộp; 60% số đã nộp thì đã duyệt
    const conDangLam = Math.random() < 0.15;
    const status = conDangLam ? 'draft' : Math.random() < 0.6 ? 'reviewed' : 'submitted';

    const audit = await api('/items/audits', {
      method: 'POST',
      body: {
        store: store.id,
        template: templates[0].id,
        auditor: auditor.id,
        // Phi chuẩn hoá khu vực — dashboard gộp nhóm bằng trường này
        region: store.region,
        status,
        date_started: batDau.toISOString(),
        date_submitted: conDangLam
          ? null
          : new Date(batDau.getTime() + rnd(40, 110) * 60000).toISOString(),
        score: conDangLam ? null : Math.round((target / 100) * maxScore),
        max_score: conDangLam ? null : maxScore,
        score_percent: conDangLam ? null : Math.round(target * 10) / 10,
        latitude: null,
        longitude: null,
        note: `${DEMO_TAG} phiếu sinh tự động để thử dashboard`,
      },
    });

    if (!conDangLam) {
      status === 'reviewed' ? daDuyet++ : daNop++;

      // Điểm càng thấp càng nhiều lỗi cần khắc phục
      const soLoi = target < 70 ? Math.floor(rnd(2, 5)) : target < 85 ? Math.floor(rnd(0, 3)) : Math.floor(rnd(0, 2));

      for (let k = 0; k < soLoi; k++) {
        const [title, severity] = pick(FINDING_TITLES);
        const hanXuLy = new Date(batDau.getTime() + rnd(3, 21) * 86400000);
        // Lỗi cũ thì nhiều khả năng đã xử lý xong
        const daQua = (Date.now() - batDau.getTime()) / 86400000;
        const trangThai =
          daQua > 45 ? pick(['resolved', 'closed', 'closed'])
          : daQua > 20 ? pick(['open', 'in_progress', 'resolved'])
          : pick(['open', 'open', 'in_progress']);

        await api('/items/findings', {
          method: 'POST',
          body: {
            audit: audit.id,
            title,
            description: `${DEMO_TAG} Phát hiện khi kiểm tra ${store.name}.`,
            severity,
            status: trangThai,
            due_date: hanXuLy.toISOString().slice(0, 10),
            assignee: null,
            corrective_action:
              trangThai === 'resolved' || trangThai === 'closed'
                ? 'Đã xử lý và báo cáo lại quản lý vùng.'
                : null,
            date_resolved:
              trangThai === 'resolved' || trangThai === 'closed'
                ? new Date(hanXuLy.getTime() - rnd(0, 3) * 86400000).toISOString()
                : null,
          },
        });
        soFinding++;
      }
    }

    if ((n + 1) % 20 === 0) log.info(`  ...${n + 1}/${soPhieu}`);
  }

  log.step('✅ Xong!');
  log.info(`${soPhieu} phiếu: ${daDuyet} đã duyệt, ${daNop} chờ duyệt, còn lại đang làm`);
  log.info(`${soFinding} lỗi cần khắc phục`);
  log.info('Xoá lại: node directus/schema/seed-demo-audits.mjs --xoa');
}

main().catch((err) => {
  console.error(`\n\x1b[31m✗ Lỗi:\x1b[0m ${err.message}`);
  if (err.errors) console.error(JSON.stringify(err.errors, null, 2));
  process.exit(1);
});
