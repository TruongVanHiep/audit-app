/**
 * setup-dashboard.mjs — Dựng dashboard Insights bằng script.
 *
 * Chạy:  node directus/schema/setup-dashboard.mjs
 *
 * Vì sao dựng bằng script thay vì kéo thả trong giao diện?
 * Cùng lý do với schema: kéo thả nhanh hơn lúc đầu nhưng không tái tạo được,
 * không đưa vào Git được, và đồng đội không dựng lại được y hệt. Dashboard là
 * một phần của sản phẩm, không phải thứ ai đó nghịch ra rồi quên.
 *
 * Script IDEMPOTENT theo kiểu ghi đè: mỗi lần chạy xoá sạch panel cũ của
 * dashboard rồi tạo lại theo đúng khai báo dưới đây. Nghĩa là ai sửa panel
 * trong giao diện thì lần chạy sau sẽ mất — code là nguồn sự thật.
 *
 * ─── GIỚI HẠN ĐÃ KIỂM CHỨNG ─────────────────────────────────────────
 *
 * Directus 11.17.4 KHÔNG gộp nhóm xuyên quan hệ được:
 *   /items/audits?aggregate[avg]=score_percent&groupBy=store.region  -> lỗi 500
 *
 * Đó là lý do bảng `audits` có cột `region` lặp lại từ `stores`. Lọc xuyên
 * quan hệ thì vẫn chạy bình thường (`filter[store][region][_eq]=north`),
 * chỉ riêng gộp nhóm là không.
 */

import { login, api, log } from './lib.mjs';

/* ------------------------------------------------------------------ */
/* Khai báo dashboard                                                  */
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
          collection: 'audits', field: 'id', aggregate_function: 'count',
          filter: DA_NOP, abbreviate_value: false,
        },
      },
      {
        name: 'Điểm trung bình', icon: 'star_rate', type: 'metric',
        x: 7, y: 1, w: 6, h: 6,
        options: {
          collection: 'audits', field: 'score_percent', aggregate_function: 'avg',
          filter: DA_NOP, decimals: 1, suffix: '%',
          // Tô màu theo ngưỡng — nhìn màu là biết tình hình, không cần đọc số
          conditional_styles: [
            { operator: '<', value: 70, color: '#DC2626' },
            { operator: '<', value: 80, color: '#EA580C' },
            { operator: '>=', value: 80, color: '#16A34A' },
          ],
        },
      },
      {
        name: 'Chờ duyệt', icon: 'pending_actions', type: 'metric',
        x: 13, y: 1, w: 6, h: 6,
        options: {
          collection: 'audits', field: 'id', aggregate_function: 'count',
          filter: { status: { _eq: 'submitted' } },
          conditional_styles: [{ operator: '>', value: 10, color: '#EA580C' }],
        },
      },
      {
        name: 'Lỗi nghiêm trọng chưa xử lý', icon: 'gpp_maybe', type: 'metric',
        x: 19, y: 1, w: 6, h: 6,
        options: {
          collection: 'findings', field: 'id', aggregate_function: 'count',
          filter: { _and: [CHUA_XONG, { severity: { _in: ['critical', 'high'] } }] },
          conditional_styles: [
            { operator: '>', value: 0, color: '#DC2626' },
            { operator: '=', value: 0, color: '#16A34A' },
          ],
        },
      },

      /* ---- Hàng 2: hai biểu đồ cột ---- */
      {
        name: 'Điểm trung bình theo khu vực', icon: 'map', type: 'bar-chart',
        x: 1, y: 7, w: 12, h: 12,
        options: {
          collection: 'audits',
          x_axis: 'region',        // cột phi chuẩn hoá — xem ghi chú đầu file
          y_axis: 'score_percent',
          function: 'avg',
          filter: DA_NOP,
          value_decimals: 1,
          color: '#2563EB',
          horizontal: false,
        },
      },
      {
        name: 'Lỗi chưa khắc phục theo mức độ', icon: 'report_problem', type: 'bar-chart',
        x: 13, y: 7, w: 12, h: 12,
        options: {
          collection: 'findings',
          x_axis: 'severity',
          y_axis: 'id',
          function: 'count',
          filter: CHUA_XONG,
          color: '#DC2626',
          horizontal: true,
        },
      },

      /* ---- Hàng 3: bảng cửa hàng cần can thiệp ---- */
      {
        name: 'Cửa hàng điểm thấp nhất — cần can thiệp', icon: 'trending_down', type: 'list',
        x: 1, y: 19, w: 24, h: 12,
        options: {
          collection: 'audits',
          limit: 12,
          sort_field: 'score_percent',
          sort_direction: 'asc',
          display_template: '{{store.code}} · {{store.name}} — {{score_percent}}% ({{date_started}})',
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
          collection: 'directus_activity', field: 'id', aggregate_function: 'count',
          // $NOW là biến động của Directus, tính tại thời điểm chạy query
          filter: { timestamp: { _gte: '$NOW(-24 hours)' } },
        },
      },
      {
        name: 'Lượt đăng nhập 7 ngày', icon: 'login', type: 'metric',
        x: 7, y: 1, w: 6, h: 6,
        options: {
          collection: 'directus_activity', field: 'id', aggregate_function: 'count',
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
        options: {
          collection: 'directus_activity', field: 'id', aggregate_function: 'count',
        },
      },
      {
        name: 'Số người dùng đang hoạt động', icon: 'group', type: 'metric',
        x: 19, y: 1, w: 6, h: 6,
        options: {
          collection: 'directus_users', field: 'id', aggregate_function: 'count',
          filter: { status: { _eq: 'active' } },
        },
      },

      {
        name: 'Hoạt động theo loại', icon: 'category', type: 'bar-chart',
        x: 1, y: 7, w: 12, h: 12,
        options: {
          collection: 'directus_activity',
          x_axis: 'action',
          y_axis: 'id',
          function: 'count',
          filter: { timestamp: { _gte: '$NOW(-30 days)' } },
          color: '#7C3AED',
          horizontal: true,
        },
      },
      {
        name: 'Nhật ký gần nhất', icon: 'receipt_long', type: 'list',
        x: 13, y: 7, w: 12, h: 12,
        options: {
          collection: 'directus_activity',
          limit: 20,
          sort_field: 'timestamp',
          sort_direction: 'desc',
          display_template: '{{timestamp}} · {{action}} · {{collection}} · {{user.email}}',
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

    /* --- Tìm hoặc tạo dashboard --- */
    const found = await api(
      `/dashboards?limit=-1&fields=id,name&filter[name][_eq]=${encodeURIComponent(d.name)}`,
    );

    let dashboardId;
    if (found.length) {
      dashboardId = found[0].id;
      // Xoá sạch panel cũ rồi tạo lại — code là nguồn sự thật
      const old = await api(
        `/panels?limit=-1&fields=id&filter[dashboard][_eq]=${dashboardId}`,
      );
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

    /* --- Tạo panel --- */
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
  log.info('Đăng nhập manager@example.com / Manager123! để xem với quyền quản lý');
}

main().catch((err) => {
  console.error(`\n\x1b[31m✗ Lỗi:\x1b[0m ${err.message}`);
  if (err.errors) console.error(JSON.stringify(err.errors, null, 2));
  process.exit(1);
});
