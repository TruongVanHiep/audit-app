/**
 * setup-schema.mjs — Tạo toàn bộ schema cho app Audit cửa hàng.
 *
 * Chạy:  node directus/schema/setup-schema.mjs
 * Chạy lại nhiều lần vô tư — script idempotent, cái gì có rồi thì bỏ qua.
 *
 * ─── MÔ HÌNH DỮ LIỆU ────────────────────────────────────────────────
 *
 *   stores            Cửa hàng / chi nhánh cần đi kiểm tra
 *     │
 *     │  1─n
 *     ▼
 *   audits            Một lượt đi audit: ai, cửa hàng nào, ngày nào, mấy điểm
 *     ▲   │
 *     │   │ 1─n
 *     │   ▼
 *     │ audit_answers  Câu trả lời cho từng tiêu chí (+ ảnh bằng chứng)
 *     │   ▲
 *     │   │ n─1
 *     │ template_items Các câu hỏi trong bộ tiêu chí
 *     │   ▲
 *     │   │ n─1
 *     │ templates      Bộ tiêu chí audit (có version)
 *     │
 *     │  1─n
 *     ▼
 *   findings          Lỗi phát hiện được -> giao người sửa -> theo dõi đến khi đóng
 *
 * Điểm cần hiểu: `templates` + `template_items` là phần "khuôn",
 * `audits` + `audit_answers` là phần "bài làm". Tách ra như vậy để khi
 * công ty đổi bộ tiêu chí, các audit cũ vẫn giữ nguyên câu hỏi lúc đó.
 */

import {
  login, api, log,
  listCollections, listFields, listRelations,
  createCollection, createField, createM2O, createFilesM2M,
  dropdown, text1, textMulti, num, toggle, timestamp,
} from './lib.mjs';

/* ------------------------------------------------------------------ */

const REGIONS = [
  ['north', 'Miền Bắc'],
  ['central', 'Miền Trung'],
  ['south', 'Miền Nam'],
];

const SEVERITIES = [
  ['low', 'Thấp'],
  ['medium', 'Trung bình'],
  ['high', 'Cao'],
  ['critical', 'Nghiêm trọng'],
];

async function main() {
  log.step('Kết nối Directus...');
  await login();
  log.ok('Đăng nhập admin thành công');

  const collections = await listCollections();
  const relations = await listRelations();

  /* ================================================================ */
  /* 1. STORES — danh sách cửa hàng                                   */
  /* ================================================================ */
  log.step('1/6  stores — Cửa hàng');
  await createCollection('stores', {
    icon: 'storefront',
    note: 'Danh sách cửa hàng / chi nhánh cần audit',
    display_template: '{{code}} — {{name}}',
  }, collections);

  {
    const f = await listFields('stores');
    await createField('stores', 'code', 'string',
      text1({ required: true, unique: true, note: 'Mã cửa hàng, vd HN-001' }), f);
    await createField('stores', 'name', 'string',
      text1({ required: true, note: 'Tên cửa hàng' }), f);
    await createField('stores', 'address', 'text',
      textMulti({ note: 'Địa chỉ đầy đủ' }), f);
    await createField('stores', 'region', 'string',
      dropdown(REGIONS, { defaultValue: 'north', note: 'Khu vực' }), f);
    await createField('stores', 'manager_name', 'string',
      text1({ note: 'Cửa hàng trưởng' }), f);
    await createField('stores', 'phone', 'string', text1(), f);
    // Toạ độ để app mobile đối chiếu: auditor có thực sự đứng tại cửa hàng không
    await createField('stores', 'latitude', 'float',
      num({ note: 'Vĩ độ — dùng để kiểm tra auditor có mặt tại cửa hàng' }), f);
    await createField('stores', 'longitude', 'float', num({ note: 'Kinh độ' }), f);
    await createField('stores', 'is_active', 'boolean',
      toggle({ defaultValue: true, note: 'Còn hoạt động?' }), f);
  }

  /* ================================================================ */
  /* 2. TEMPLATES — bộ tiêu chí                                       */
  /* ================================================================ */
  log.step('2/6  templates — Bộ tiêu chí audit');
  await createCollection('templates', {
    icon: 'fact_check',
    note: 'Bộ tiêu chí audit. Mỗi lần sửa tiêu chí nên tạo version mới.',
    display_template: '{{name}} (v{{version}})',
  }, collections);

  {
    const f = await listFields('templates');
    await createField('templates', 'name', 'string',
      text1({ required: true, width: 'full', note: 'Tên bộ tiêu chí' }), f);
    await createField('templates', 'description', 'text', textMulti(), f);
    await createField('templates', 'version', 'integer',
      num({ defaultValue: 1, note: 'Phiên bản' }), f);
    await createField('templates', 'status', 'string',
      dropdown([
        ['draft', 'Nháp'],
        ['published', 'Đang dùng'],
        ['archived', 'Ngừng dùng'],
      ], { defaultValue: 'draft', note: 'Chỉ bộ "Đang dùng" mới hiện trên app' }), f);
  }

  /* ================================================================ */
  /* 3. TEMPLATE_ITEMS — từng câu hỏi                                 */
  /* ================================================================ */
  log.step('3/6  template_items — Câu hỏi trong bộ tiêu chí');
  await createCollection('template_items', {
    icon: 'checklist',
    note: 'Từng tiêu chí cụ thể auditor phải chấm',
    display_template: '{{section}} — {{question}}',
    sort_field: 'sort',
  }, collections);

  {
    const f = await listFields('template_items');
    await createField('template_items', 'sort', 'integer',
      { meta: { interface: 'input', hidden: true }, schema: { is_nullable: true } }, f);
    await createField('template_items', 'section', 'string',
      text1({ required: true, note: 'Nhóm tiêu chí, vd "Trưng bày"' }), f);
    await createField('template_items', 'question', 'text',
      { meta: { interface: 'input-multiline', required: true, width: 'full', note: 'Nội dung câu hỏi' },
        schema: { is_nullable: false } }, f);
    await createField('template_items', 'guidance', 'text',
      textMulti({ note: 'Hướng dẫn chấm — hiện dưới dạng gợi ý trong app' }), f);
    // Kiểu trả lời quyết định app mobile render control nào
    await createField('template_items', 'answer_type', 'string',
      dropdown([
        ['pass_fail', 'Đạt / Không đạt'],
        ['score_5', 'Chấm điểm 1-5'],
        ['number', 'Nhập số'],
        ['text', 'Nhập chữ'],
      ], { defaultValue: 'pass_fail', required: true, note: 'Quyết định giao diện nhập trên app' }), f);
    await createField('template_items', 'weight', 'integer',
      num({ defaultValue: 1, note: 'Trọng số khi tính điểm tổng' }), f);
    await createField('template_items', 'requires_photo', 'boolean',
      toggle({ defaultValue: false, note: 'Bắt buộc chụp ảnh?' }), f);
    await createField('template_items', 'is_critical', 'boolean',
      toggle({ defaultValue: false, note: 'Tiêu chí trọng yếu — trượt là cả audit trượt' }), f);

    await createM2O({
      collection: 'template_items', field: 'template', related: 'templates',
      oneField: 'items', onDelete: 'CASCADE', required: true, width: 'full',
      note: 'Thuộc bộ tiêu chí nào',
    }, f, relations);
  }

  /* ================================================================ */
  /* 4. AUDITS — phiên audit                                          */
  /* ================================================================ */
  log.step('4/6  audits — Phiên audit');
  await createCollection('audits', {
    icon: 'assignment',
    note: 'Một lượt đi kiểm tra cửa hàng',
    display_template: '{{store.code}} — {{date_started}}',
    archive_field: 'status',
    archive_value: 'cancelled',
    unarchive_value: 'draft',
  }, collections);

  {
    const f = await listFields('audits');
    await createField('audits', 'status', 'string',
      dropdown([
        ['draft', 'Đang làm'],
        ['submitted', 'Đã nộp'],
        ['reviewed', 'Đã duyệt'],
        ['cancelled', 'Đã huỷ'],
      ], { defaultValue: 'draft', required: true, note: 'Trạng thái phiên audit' }), f);
    await createField('audits', 'date_started', 'timestamp',
      timestamp({ note: 'Lúc auditor bấm bắt đầu' }), f);
    await createField('audits', 'date_submitted', 'timestamp',
      timestamp({ note: 'Lúc nộp bài' }), f);
    // Điểm được app tính rồi gửi lên; sau này có thể chuyển sang tính bằng Flow ở server
    await createField('audits', 'score', 'float',
      num({ note: 'Điểm đạt được (đã nhân trọng số)' }), f);
    await createField('audits', 'max_score', 'float',
      num({ note: 'Điểm tối đa có thể đạt' }), f);
    await createField('audits', 'score_percent', 'float',
      num({ note: '% điểm — dùng cho dashboard' }), f);
    await createField('audits', 'latitude', 'float',
      num({ note: 'Vị trí GPS lúc bắt đầu audit' }), f);
    await createField('audits', 'longitude', 'float', num(), f);
    await createField('audits', 'note', 'text',
      textMulti({ note: 'Nhận xét chung của auditor' }), f);

    await createM2O({
      collection: 'audits', field: 'store', related: 'stores',
      oneField: 'audits', onDelete: 'CASCADE', required: true,
      note: 'Audit cửa hàng nào',
    }, f, relations);

    await createM2O({
      collection: 'audits', field: 'template', related: 'templates',
      oneField: 'audits', onDelete: 'NO ACTION', required: true,
      note: 'Dùng bộ tiêu chí nào',
    }, f, relations);

    // Ai là người đi audit — trỏ thẳng vào bảng người dùng có sẵn của Directus
    await createM2O({
      collection: 'audits', field: 'auditor', related: 'directus_users',
      onDelete: 'SET NULL', note: 'Người thực hiện',
    }, f, relations);
  }

  /* ================================================================ */
  /* 5. AUDIT_ANSWERS — câu trả lời                                   */
  /* ================================================================ */
  log.step('5/6  audit_answers — Câu trả lời + ảnh');
  await createCollection('audit_answers', {
    icon: 'rate_review',
    note: 'Câu trả lời của auditor cho từng tiêu chí',
    display_template: '{{item.question}}',
  }, collections);

  {
    const f = await listFields('audit_answers');
    // Lưu giá trị thô dạng chuỗi cho mọi answer_type ("pass"/"fail"/"4"/"..."),
    // vì mỗi tiêu chí một kiểu. App chịu trách nhiệm đọc/ghi đúng theo answer_type.
    await createField('audit_answers', 'value', 'string',
      text1({ note: 'Giá trị thô: pass/fail, 1-5, số, hoặc chữ' }), f);
    await createField('audit_answers', 'score', 'float',
      num({ note: 'Điểm quy đổi đã nhân trọng số' }), f);
    await createField('audit_answers', 'note', 'text',
      textMulti({ note: 'Ghi chú của auditor' }), f);

    await createM2O({
      collection: 'audit_answers', field: 'audit', related: 'audits',
      oneField: 'answers', onDelete: 'CASCADE', required: true,
    }, f, relations);

    await createM2O({
      collection: 'audit_answers', field: 'item', related: 'template_items',
      onDelete: 'NO ACTION', required: true, note: 'Trả lời cho tiêu chí nào',
    }, f, relations);

    await createFilesM2M('audit_answers', 'photos', collections, relations);
  }

  /* ================================================================ */
  /* 6. FINDINGS — lỗi cần khắc phục                                  */
  /* ================================================================ */
  log.step('6/6  findings — Lỗi phát hiện & theo dõi khắc phục');
  await createCollection('findings', {
    icon: 'report_problem',
    note: 'Vấn đề phát hiện khi audit, cần giao người khắc phục',
    display_template: '{{title}} ({{severity}})',
  }, collections);

  {
    const f = await listFields('findings');
    await createField('findings', 'title', 'string',
      text1({ required: true, width: 'full', note: 'Tóm tắt vấn đề' }), f);
    await createField('findings', 'description', 'text', textMulti(), f);
    await createField('findings', 'severity', 'string',
      dropdown(SEVERITIES, { defaultValue: 'medium', required: true, note: 'Mức độ' }), f);
    await createField('findings', 'status', 'string',
      dropdown([
        ['open', 'Mới'],
        ['in_progress', 'Đang xử lý'],
        ['resolved', 'Đã khắc phục'],
        ['closed', 'Đã đóng'],
      ], { defaultValue: 'open', required: true }), f);
    await createField('findings', 'due_date', 'date',
      { meta: { interface: 'datetime', width: 'half', note: 'Hạn khắc phục' },
        schema: { is_nullable: true } }, f);
    await createField('findings', 'corrective_action', 'text',
      textMulti({ note: 'Hành động khắc phục đã làm' }), f);
    await createField('findings', 'date_resolved', 'timestamp', timestamp(), f);

    await createM2O({
      collection: 'findings', field: 'audit', related: 'audits',
      oneField: 'findings', onDelete: 'CASCADE', required: true,
    }, f, relations);

    await createM2O({
      collection: 'findings', field: 'answer', related: 'audit_answers',
      onDelete: 'SET NULL', note: 'Xuất phát từ câu trả lời nào (nếu có)',
    }, f, relations);

    await createM2O({
      collection: 'findings', field: 'assignee', related: 'directus_users',
      onDelete: 'SET NULL', note: 'Người chịu trách nhiệm khắc phục',
    }, f, relations);

    await createFilesM2M('findings', 'photos', collections, relations);
  }

  log.step('✅ Xong! Schema đã sẵn sàng.');
  log.info('Mở http://localhost:8055 -> đăng nhập admin@example.com / Password123!');
  log.info('Bước tiếp theo: node directus/schema/seed-data.mjs  (nạp dữ liệu mẫu)');
}

main().catch((err) => {
  console.error(`\n\x1b[31m✗ Lỗi:\x1b[0m ${err.message}`);
  if (err.errors) console.error(JSON.stringify(err.errors, null, 2));
  process.exit(1);
});
