/**
 * setup-dashboard.mjs — Dựng dashboard Insights bằng script.
 *
 * Chạy:  node directus/schema/setup-dashboard.mjs
 *
 * Vì sao dựng bằng script thay vì kéo thả trong giao diện?
 * Cùng lý do với schema: kéo thả nhanh hơn lúc đầu nhưng không tái tạo được,
 * không đưa vào Git được, và đồng đội không dựng lại được y hệt.
 *
 * Script IDEMPOTENT theo kiểu ghi đè: mỗi lần chạy xoá sạch panel cũ rồi tạo
 * lại theo khai báo dưới đây. Ai sửa panel trong giao diện thì lần chạy sau
 * sẽ mất — code là nguồn sự thật.
 *
 * ─── CẠM BẪY LỚN NHẤT: TÊN KHOÁ options ─────────────────────────────
 *
 * Directus KHÔNG kiểm tra `options` khi lưu panel — nó chấp nhận mọi JSON.
 * Gõ sai tên khoá thì API trả 200, panel vẫn hiện ra, nhưng hiển thị 0 hoặc
 * trống và KHÔNG có lỗi ở bất cứ đâu. Rất khó lần ra.
 *
 * Đã dính đúng lỗi này: dùng `aggregate_function`, `x_axis`, `value_decimals`
 * theo tài liệu trên web -> mọi ô số liệu ra 0.
 *
 * Tên khoá ĐÚNG cho v11.17.4 lấy từ mã nguồn, không lấy từ tài liệu:
 *   https://github.com/directus/directus/blob/v11.17.4/app/src/panels/<tên>/index.ts
 *
 *   metric     : collection, field, function, sortField, filter,
 *                prefix, suffix, minimumFractionDigits, maximumFractionDigits,
 *                conditionalFormatting, textAlign, fontWeight, ...
 *   bar-chart  : collection, horizontal, xAxis, xAxisDisplayField, yAxis,
 *                function, decimals, color, filter, showAxisLabels,
 *                showDataLabel, conditionalFill
 *   list       : collection, limit, sortField, sortDirection, displayTemplate,
 *                linkToItem, filter
 *
 * Tất cả đều camelCase. Tài liệu trên web ghi snake_case là của bản khác.
 *
 * ─── GIỚI HẠN ĐÃ KIỂM CHỨNG ─────────────────────────────────────────
 *
 * Directus 11.17.4 KHÔNG gộp nhóm xuyên quan hệ được:
 *   /items/audits?aggregate[avg]=score_percent&groupBy=store.region  -> 500
 *
 * Đó là lý do bảng `audits` có cột `region` lặp lại từ `stores`. Lọc xuyên
 * quan hệ thì vẫn chạy bình thường, chỉ riêng gộp nhóm là không.
 */

import { login, api, log } from './lib.mjs';

/* ------------------------------------------------------------------ */

/** Chỉ tính phiếu đã nộp — phiếu đang làm dở chưa có điểm, đưa vào là méo số. */
const DA_NOP = { status: { _neq: 'draft' } };

/** Lỗi chưa xử lý xong. */
const CHUA_XONG = { status: { _in: ['open', 'in_progress'] } };

const DASHBOARDS = [
  {
    name: 'Tổng quan Audit',
    icon: 'insights',
    note: 'Bức tranh chung: sản lượng, chất lượng, và chỗ cần can thiệp',
    panels: [
      /* ---- Hàng 1: bốn con số lớn ---- */
      {
        name: 'Phiếu đã nộp', icon: 'assignment_turned_in', type: 'metric',
        x: 1, y: 1, w: 6, h: 6,
        options: {
          collection: 'audits',
          field: 'id',
          function: 'count',
          filter: DA_NOP,
        },
      },
      {
        name: 'Điểm trung bình', icon: 'star_rate', type: 'metric',
        x: 7, y: 1, w: 6, h: 6,
        options: {
          collection: 'audits',
          field: 'score_percent',
          function: 'avg',
          filter: DA_NOP,
          suffix: '%',
          minimumFractionDigits: 0,
          maximumFractionDigits: 1,
        },
      },
      {
        name: 'Chờ duyệt', icon: 'pending_actions', type: 'metric',
        x: 13, y: 1, w: 6, h: 6,
        options: {
          collection: 'audits',
          field: 'id',
          function: 'count',
          filter: { status: { _eq: 'submitted' } },
        },
      },
      {
        name: 'Lỗi nghiêm trọng chưa xử lý', icon: 'gpp_maybe', type: 'metric',
        x: 19, y: 1, w: 6, h: 6,
        options: {
          collection: 'findings',
          field: 'id',
          function: 'count',
          filter: { _and: [CHUA_XONG, { severity: { _in: ['critical', 'high'] } }] },
        },
      },

      /* ---- Hàng 2: hai biểu đồ cột ---- */
      {
        name: 'Điểm trung bình theo khu vực', icon: 'map', type: 'bar-chart',
        x: 1, y: 7, w: 12, h: 12,
        options: {
          collection: 'audits',
          xAxis: 'region',          // cột phi chuẩn hoá — xem ghi chú đầu file
          yAxis: 'score_percent',
          function: 'avg',
          filter: DA_NOP,
          decimals: 1,
          color: '#2563EB',
          horizontal: false,
          showAxisLabels: 'both',
          showDataLabel: true,
        },
      },
      {
        name: 'Lỗi chưa khắc phục theo mức độ', icon: 'report_problem', type: 'bar-chart',
        x: 13, y: 7, w: 12, h: 12,
        options: {
          collection: 'findings',
          xAxis: 'severity',
          yAxis: 'id',
          function: 'count',
          filter: CHUA_XONG,
          decimals: 0,
          color: '#DC2626',
          horizontal: true,
          showAxisLabels: 'both',
          showDataLabel: true,
        },
      },

      /* ---- Hàng 3: bảng cửa hàng cần can thiệp ---- */
      {
        name: 'Cửa hàng điểm thấp nhất — cần can thiệp', icon: 'trending_down', type: 'list',
        x: 1, y: 19, w: 24, h: 12,
        options: {
          collection: 'audits',
          limit: 12,
          sortField: 'score_percent',
          sortDirection: 'asc',
          displayTemplate: '{{store.code}} · {{store.name}} — {{score_percent}}%',
          linkToItem: true,
          filter: DA_NOP,
        },
      },
    ],
  },

  {
    name: 'Nhật ký & Giám sát',
    icon: 'monitor_heart',
    note: 'Ai làm gì trong hệ thống, và hệ thống có đang chạy bình thường không',
    panels: [
      {
        name: 'Hoạt động 24 giờ qua', icon: 'bolt', type: 'metric',
        x: 1, y: 1, w: 6, h: 6,
        options: {
          collection: 'directus_activity',
          field: 'id',
          function: 'count',
          // $NOW là biến động của Directus, tính tại thời điểm chạy query
          filter: { timestamp: { _gte: '$NOW(-24 hours)' } },
        },
      },
      {
        name: 'Lượt đăng nhập 7 ngày', icon: 'login', type: 'metric',
        x: 7, y: 1, w: 6, h: 6,
        options: {
          collection: 'directus_activity',
          field: 'id',
          function: 'count',
          filter: {
            _and: [
              { action: { _eq: 'login' } },
              { timestamp: { _gte: '$NOW(-7 days)' } },
            ],
          },
        },
      },
      {
        name: 'Tổng bản ghi hoạt động', icon: 'history', type: 'metric',
        x: 13, y: 1, w: 6, h: 6,
        options: { collection: 'directus_activity', field: 'id', function: 'count' },
      },
      {
        name: 'Người dùng đang hoạt động', icon: 'group', type: 'metric',
        x: 19, y: 1, w: 6, h: 6,
        options: {
          collection: 'directus_users',
          field: 'id',
          function: 'count',
          filter: { status: { _eq: 'active' } },
        },
      },

      {
        name: 'Hoạt động theo loại (30 ngày)', icon: 'category', type: 'bar-chart',
        x: 1, y: 7, w: 12, h: 12,
        options: {
          collection: 'directus_activity',
          xAxis: 'action',
          yAxis: 'id',
          function: 'count',
          filter: { timestamp: { _gte: '$NOW(-30 days)' } },
          decimals: 0,
          color: '#7C3AED',
          horizontal: true,
          showAxisLabels: 'both',
          showDataLabel: true,
        },
      },
      {
        name: 'Nhật ký gần nhất', icon: 'receipt_long', type: 'list',
        x: 13, y: 7, w: 12, h: 12,
        options: {
          collection: 'directus_activity',
          limit: 20,
          sortField: 'timestamp',
          sortDirection: 'desc',
          displayTemplate: '{{action}} · {{collection}} · {{timestamp}}',
          linkToItem: false,
        },
      },
    ],
  },
];

/* ------------------------------------------------------------------ */

async function main() {
  log.step('Kết nối Directus...');
  await login();
  log.ok('Đăng nhập admin thành công');

  for (const d of DASHBOARDS) {
    log.step(`Dashboard: ${d.name}`);

    const found = await api(
      `/dashboards?limit=-1&fields=id,name&filter[name][_eq]=${encodeURIComponent(d.name)}`,
    );

    let dashboardId;
    if (found.length) {
      dashboardId = found[0].id;
      const old = await api(`/panels?limit=-1&fields=id&filter[dashboard][_eq]=${dashboardId}`);
      if (old.length) {
        await api('/panels', { method: 'DELETE', body: old.map((p) => p.id) });
        log.info(`xoá ${old.length} panel cũ để dựng lại`);
      }
    } else {
      const created = await api('/dashboards', {
        method: 'POST',
        body: { name: d.name, icon: d.icon, note: d.note },
      });
      dashboardId = created.id;
      log.ok(`tạo dashboard "${d.name}"`);
    }

    await api('/panels', {
      method: 'POST',
      body: d.panels.map((p) => ({
        dashboard: dashboardId,
        name: p.name,
        icon: p.icon ?? null,
        type: p.type,
        position_x: p.x,
        position_y: p.y,
        width: p.w,
        height: p.h,
        options: p.options,
      })),
    });
    d.panels.forEach((p) => log.ok(`  ${p.type.padEnd(10)} ${p.name}`));
  }

  log.step('✅ Xong!');
  log.info('Xem tại: http://localhost:8055/admin/insights');
  log.info('Tải lại trang (F5) sau khi chạy script — Data Studio có cache panel.');
}

main().catch((err) => {
  console.error(`\n\x1b[31m✗ Lỗi:\x1b[0m ${err.message}`);
  if (err.errors) console.error(JSON.stringify(err.errors, null, 2));
  process.exit(1);
});
