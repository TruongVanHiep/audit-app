/**
 * seed-data.mjs — Nạp dữ liệu mẫu để app mobile có cái mà hiển thị.
 *
 * Chạy:  node directus/schema/seed-data.mjs
 * Idempotent: dựa vào `code` của store và `name`+`version` của template
 * để biết đã nạp chưa, chạy lại không tạo trùng.
 */

import { login, api, log } from './lib.mjs';

/* ------------------------------------------------------------------ */
/* Dữ liệu cửa hàng                                                    */
/* ------------------------------------------------------------------ */

const STORES = [
  { code: 'HN-001', name: 'Cửa hàng Cầu Giấy',   address: '234 Xuân Thủy, Cầu Giấy, Hà Nội',        region: 'north',   manager_name: 'Nguyễn Văn An',   phone: '0901234567', latitude: 21.0362, longitude: 105.7825 },
  { code: 'HN-002', name: 'Cửa hàng Hoàn Kiếm',  address: '12 Hàng Bài, Hoàn Kiếm, Hà Nội',         region: 'north',   manager_name: 'Trần Thị Bình',   phone: '0902234567', latitude: 21.0245, longitude: 105.8524 },
  { code: 'HN-003', name: 'Cửa hàng Long Biên',  address: '89 Nguyễn Văn Cừ, Long Biên, Hà Nội',    region: 'north',   manager_name: 'Lê Minh Cường',   phone: '0903234567', latitude: 21.0490, longitude: 105.8760 },
  { code: 'DN-001', name: 'Cửa hàng Hải Châu',   address: '45 Lê Duẩn, Hải Châu, Đà Nẵng',          region: 'central', manager_name: 'Phạm Thu Dung',   phone: '0904234567', latitude: 16.0678, longitude: 108.2208 },
  { code: 'HCM-001', name: 'Cửa hàng Quận 1',    address: '68 Lê Lợi, Quận 1, TP.HCM',              region: 'south',   manager_name: 'Võ Hoàng Em',     phone: '0905234567', latitude: 10.7725, longitude: 106.6980 },
  { code: 'HCM-002', name: 'Cửa hàng Thủ Đức',   address: '123 Võ Văn Ngân, Thủ Đức, TP.HCM',       region: 'south',   manager_name: 'Đặng Quốc Phong', phone: '0906234567', latitude: 10.8505, longitude: 106.7717 },
];

/* ------------------------------------------------------------------ */
/* Bộ tiêu chí audit                                                   */
/* ------------------------------------------------------------------ */

const TEMPLATE = {
  name: 'Audit cửa hàng bán lẻ',
  description:
    'Bộ tiêu chí kiểm tra định kỳ cửa hàng: trưng bày, vệ sinh, giá, tồn kho và dịch vụ khách hàng.',
  version: 1,
  status: 'published',
};

// [section, question, answer_type, weight, requires_photo, is_critical, guidance]
const ITEMS = [
  // ---- Trưng bày & POSM ----
  ['Trưng bày & POSM', 'Biển hiệu cửa hàng sạch sẽ, đèn sáng đầy đủ?', 'pass_fail', 2, true, false,
   'Kiểm tra ban ngày lẫn ban đêm. Bóng cháy hoặc biển bẩn = Không đạt.'],
  ['Trưng bày & POSM', 'Quầy kệ trưng bày đúng planogram?', 'pass_fail', 3, true, false,
   'Đối chiếu với ảnh planogram công ty gửi tháng này.'],
  ['Trưng bày & POSM', 'Chấm điểm tổng thể mức độ gọn gàng của khu trưng bày', 'score_5', 2, false, false,
   '1 = rất lộn xộn, 5 = hoàn hảo.'],
  ['Trưng bày & POSM', 'POSM khuyến mãi hiện tại đã được treo đúng vị trí?', 'pass_fail', 2, true, false,
   'POSM hết hạn còn treo cũng tính là Không đạt.'],

  // ---- Vệ sinh & Cơ sở vật chất ----
  ['Vệ sinh & Cơ sở vật chất', 'Sàn nhà, lối đi sạch, không trơn trượt?', 'pass_fail', 2, false, false, null],
  ['Vệ sinh & Cơ sở vật chất', 'Khu vực kho/hậu cần gọn gàng, không chắn lối thoát hiểm?', 'pass_fail', 3, true, true,
   'Chắn lối thoát hiểm là lỗi trọng yếu — trượt tiêu chí này là cả audit không đạt.'],
  ['Vệ sinh & Cơ sở vật chất', 'Điều hòa, quạt, hệ thống chiếu sáng hoạt động bình thường?', 'pass_fail', 1, false, false, null],
  ['Vệ sinh & Cơ sở vật chất', 'Nhà vệ sinh sạch, đủ vật tư?', 'score_5', 1, false, false, null],

  // ---- Giá & Khuyến mãi ----
  ['Giá & Khuyến mãi', 'Tem giá khớp với giá trên hệ thống?', 'pass_fail', 3, true, true,
   'Lấy mẫu ngẫu nhiên 10 SKU. Sai từ 1 SKU trở lên = Không đạt.'],
  ['Giá & Khuyến mãi', 'Số SKU bị sai giá phát hiện được', 'number', 0, false, false,
   'Nhập 0 nếu không có sai sót. Tiêu chí này chỉ ghi nhận, không tính điểm.'],
  ['Giá & Khuyến mãi', 'Chương trình khuyến mãi đang chạy được niêm yết rõ ràng?', 'pass_fail', 2, true, false, null],

  // ---- Tồn kho ----
  ['Tồn kho', 'Không có hàng hết hạn hoặc cận hạn trên kệ?', 'pass_fail', 3, true, true,
   'Cận hạn = còn dưới 30 ngày. Đây là lỗi trọng yếu.'],
  ['Tồn kho', 'Tỷ lệ đầy kệ của nhóm hàng chủ lực', 'score_5', 2, false, false,
   '1 = dưới 50% kệ có hàng, 5 = đầy 100%.'],
  ['Tồn kho', 'Số mặt hàng chủ lực bị hết hàng (OOS)', 'number', 0, false, false,
   'Đếm theo danh mục 20 SKU chủ lực.'],

  // ---- Nhân viên & Dịch vụ ----
  ['Nhân viên & Dịch vụ', 'Nhân viên mặc đồng phục, đeo bảng tên đầy đủ?', 'pass_fail', 2, true, false, null],
  ['Nhân viên & Dịch vụ', 'Chấm điểm thái độ phục vụ khách (quan sát trực tiếp)', 'score_5', 3, false, false,
   'Đứng quan sát ít nhất 10 phút trước khi chấm.'],
  ['Nhân viên & Dịch vụ', 'Nhân viên nắm được chương trình khuyến mãi đang chạy?', 'pass_fail', 2, false, false,
   'Hỏi ngẫu nhiên 2 nhân viên.'],
  ['Nhân viên & Dịch vụ', 'Ghi nhận khác về nhân sự tại cửa hàng', 'text', 0, false, false,
   'Ví dụ: thiếu người ca chiều, nhân viên mới chưa được đào tạo...'],
];

/* ------------------------------------------------------------------ */

async function main() {
  log.step('Kết nối Directus...');
  await login();
  log.ok('Đăng nhập admin thành công');

  /* ---------------- Cửa hàng ---------------- */
  log.step('Nạp cửa hàng');
  const existingStores = await api('/items/stores?limit=-1&fields=id,code');
  const storeCodes = new Set(existingStores.map((s) => s.code));

  const newStores = STORES.filter((s) => !storeCodes.has(s.code));
  if (newStores.length) {
    // Directus cho phép POST một mảng để tạo nhiều bản ghi trong 1 request
    await api('/items/stores', {
      method: 'POST',
      body: newStores.map((s) => ({ ...s, is_active: true })),
    });
    newStores.forEach((s) => log.ok(`${s.code} — ${s.name}`));
  }
  STORES.filter((s) => storeCodes.has(s.code)).forEach((s) => log.skip(s.code));

  /* ---------------- Bộ tiêu chí ---------------- */
  log.step('Nạp bộ tiêu chí');
  const existingTemplates = await api(
    `/items/templates?limit=-1&fields=id,name,version` +
      `&filter[name][_eq]=${encodeURIComponent(TEMPLATE.name)}` +
      `&filter[version][_eq]=${TEMPLATE.version}`,
  );

  let templateId;
  if (existingTemplates.length) {
    templateId = existingTemplates[0].id;
    log.skip(`template "${TEMPLATE.name}" v${TEMPLATE.version}`);
  } else {
    const created = await api('/items/templates', { method: 'POST', body: TEMPLATE });
    templateId = created.id;
    log.ok(`template "${TEMPLATE.name}" v${TEMPLATE.version}`);
  }

  /* ---------------- Câu hỏi ---------------- */
  log.step('Nạp câu hỏi tiêu chí');
  const existingItems = await api(
    `/items/template_items?limit=-1&fields=id,question&filter[template][_eq]=${templateId}`,
  );
  const existingQuestions = new Set(existingItems.map((i) => i.question));

  const newItems = ITEMS
    .map(([section, question, answer_type, weight, requires_photo, is_critical, guidance], idx) => ({
      template: templateId,
      sort: idx + 1,
      section,
      question,
      answer_type,
      weight,
      requires_photo,
      is_critical,
      guidance,
    }))
    .filter((i) => !existingQuestions.has(i.question));

  if (newItems.length) {
    await api('/items/template_items', { method: 'POST', body: newItems });
    log.ok(`${newItems.length} câu hỏi`);
  } else {
    log.skip(`${ITEMS.length} câu hỏi`);
  }

  /* ---------------- Tổng kết ---------------- */
  const totalWeight = ITEMS.reduce((sum, i) => sum + i[3], 0);
  log.step('✅ Xong!');
  log.info(`${STORES.length} cửa hàng, 1 bộ tiêu chí, ${ITEMS.length} câu hỏi`);
  log.info(`Tổng trọng số: ${totalWeight} -> điểm tối đa = ${totalWeight * 5} (thang 5 điểm/tiêu chí)`);
  log.info('Xem tại: http://localhost:8055/admin/content/stores');
}

main().catch((err) => {
  console.error(`\n\x1b[31m✗ Lỗi:\x1b[0m ${err.message}`);
  if (err.errors) console.error(JSON.stringify(err.errors, null, 2));
  process.exit(1);
});
