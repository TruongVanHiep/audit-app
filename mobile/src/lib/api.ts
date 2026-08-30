/**
 * api.ts — Mọi lời gọi tới Directus gom về đây.
 *
 * Vì sao không gọi thẳng directus.request() trong màn hình?
 *  - Màn hình chỉ nên lo việc hiển thị. Trộn code gọi API vào giữa JSX là
 *    con đường nhanh nhất tới một file 800 dòng không ai dám sửa.
 *  - Khi Directus đổi cách đặt tên field, bạn sửa ở đây, không phải lục
 *    khắp các màn hình.
 *  - Dễ viết test giả lập (mock) cho từng hàm.
 */

import {
  readItems,
  readItem,
  createItem,
  updateItem,
  uploadFiles,
  aggregate,
} from '@directus/sdk';

import { directus } from './directus';
import type { Audit, AuditAnswer, Store, Template, TemplateItem } from './types';

/* ------------------------------------------------------------------ */
/* Cửa hàng                                                            */
/* ------------------------------------------------------------------ */

export async function listStores(search?: string): Promise<Store[]> {
  return (await directus.request(
    readItems('stores', {
      // Xin đúng field cần dùng. Đừng dùng '*' — mỗi field thừa là thêm
      // byte phải tải qua mạng 4G của người đi hiện trường.
      fields: ['id', 'code', 'name', 'address', 'region', 'manager_name', 'phone', 'latitude', 'longitude'],
      filter: {
        is_active: { _eq: true },
        // _or chỉ thêm vào khi có từ khoá tìm kiếm
        ...(search
          ? {
              _or: [
                { name: { _icontains: search } },
                { code: { _icontains: search } },
                { address: { _icontains: search } },
              ],
            }
          : {}),
      },
      sort: ['code'],
      limit: 200,
    }),
  )) as Store[];
}

/* ------------------------------------------------------------------ */
/* Bộ tiêu chí                                                         */
/* ------------------------------------------------------------------ */

/** Lấy bộ tiêu chí đang dùng, ưu tiên version cao nhất. */
export async function getActiveTemplate(): Promise<Template | null> {
  const rows = (await directus.request(
    readItems('templates', {
      fields: ['id', 'name', 'description', 'version', 'status'],
      filter: { status: { _eq: 'published' } },
      sort: ['-version'],
      limit: 1,
    }),
  )) as Template[];
  return rows[0] ?? null;
}

export async function listTemplateItems(templateId: string): Promise<TemplateItem[]> {
  return (await directus.request(
    readItems('template_items', {
      fields: [
        'id', 'template', 'sort', 'section', 'question',
        'guidance', 'answer_type', 'weight', 'requires_photo', 'is_critical',
      ],
      filter: { template: { _eq: templateId } },
      sort: ['sort'],
      limit: -1,
    }),
  )) as TemplateItem[];
}

/* ------------------------------------------------------------------ */
/* Phiên audit                                                         */
/* ------------------------------------------------------------------ */

/**
 * Field cần lấy cho một phiếu audit.
 *
 * Lưu ý cú pháp: quan hệ lồng nhau viết bằng OBJECT `{ store: [...] }`,
 * KHÔNG viết bằng đường dẫn chấm `'store.id'`. REST API của Directus chấp nhận
 * cả hai, nhưng kiểu TypeScript của SDK chỉ hiểu dạng object — dùng dạng chấm
 * sẽ biên dịch lỗi.
 */
const AUDIT_FIELDS = [
  'id', 'status', 'date_started', 'date_submitted',
  'score', 'max_score', 'score_percent', 'latitude', 'longitude', 'note',
  { store: ['id', 'code', 'name', 'address'] },
  { template: ['id', 'name', 'version'] },
] as const;

/** Danh sách audit của chính người đang đăng nhập (server tự lọc theo quyền). */
export async function listMyAudits(): Promise<Audit[]> {
  return (await directus.request(
    readItems('audits', {
      fields: [...AUDIT_FIELDS],
      sort: ['-date_started'],
      limit: 100,
    }),
  )) as unknown as Audit[];
}

export async function getAudit(id: string): Promise<Audit> {
  return (await directus.request(
    readItem('audits', id, { fields: [...AUDIT_FIELDS] }),
  )) as unknown as Audit;
}

/** Tìm audit còn dở dang của cửa hàng này, để không tạo trùng. */
export async function findDraftAudit(storeId: string): Promise<Audit | null> {
  const rows = (await directus.request(
    readItems('audits', {
      fields: [...AUDIT_FIELDS],
      filter: { store: { _eq: storeId }, status: { _eq: 'draft' } },
      sort: ['-date_started'],
      limit: 1,
    }),
  )) as unknown as Audit[];
  return rows[0] ?? null;
}

export async function createAudit(input: {
  storeId: string;
  templateId: string;
  latitude?: number | null;
  longitude?: number | null;
  /** Khu vuc cua cua hang, chep sang audits de dashboard gop nhom duoc */
  region?: string | null;
}): Promise<Audit> {
  // KHÔNG gửi `auditor` lên. Directus tự điền bằng preset $CURRENT_USER,
  // và validation sẽ từ chối nếu ta cố gửi id người khác.
  return (await directus.request(
    createItem('audits', {
      store: input.storeId,
      template: input.templateId,
      date_started: new Date().toISOString(),
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      region: input.region ?? null,
    } as never),
  )) as unknown as Audit;
}

export async function updateAuditNote(auditId: string, note: string): Promise<void> {
  await directus.request(updateItem('audits', auditId, { note } as never));
}

export async function submitAudit(
  auditId: string,
  totals: { score: number; maxScore: number; percent: number },
): Promise<void> {
  await directus.request(
    updateItem('audits', auditId, {
      status: 'submitted',
      date_submitted: new Date().toISOString(),
      score: totals.score,
      max_score: totals.maxScore,
      score_percent: totals.percent,
    } as never),
  );
}

/* ------------------------------------------------------------------ */
/* Câu trả lời                                                         */
/* ------------------------------------------------------------------ */

const ANSWER_FIELDS = [
  'id', 'audit', 'item', 'value', 'score', 'note',
  { photos: ['id', 'directus_files_id'] },
] as const;

export async function listAnswers(auditId: string): Promise<AuditAnswer[]> {
  return (await directus.request(
    readItems('audit_answers', {
      fields: [...ANSWER_FIELDS],
      filter: { audit: { _eq: auditId } },
      limit: -1,
    }),
  )) as unknown as AuditAnswer[];
}

/**
 * Tạo mới hoặc cập nhật câu trả lời.
 *
 * Directus không có endpoint "upsert", nên tự xử: có id thì PATCH, chưa có
 * thì POST. Màn hình giữ id trả về để lần lưu sau biết đường cập nhật.
 */
export async function saveAnswer(input: {
  answerId?: string | null;
  auditId: string;
  itemId: string;
  value: string | null;
  score: number | null;
  note: string | null;
  photoIds?: string[];
}): Promise<AuditAnswer> {
  const payload: Record<string, unknown> = {
    value: input.value,
    score: input.score,
    note: input.note,
  };

  // Quan hệ M2M: gửi mảng { directus_files_id } là Directus tự dựng bảng
  // trung gian. Gửi mảng rỗng nghĩa là gỡ hết ảnh.
  if (input.photoIds) {
    payload.photos = input.photoIds.map((fileId) => ({ directus_files_id: fileId }));
  }

  if (input.answerId) {
    return (await directus.request(
      updateItem('audit_answers', input.answerId, payload as never, {
        fields: [...ANSWER_FIELDS],
      }),
    )) as unknown as AuditAnswer;
  }

  return (await directus.request(
    createItem(
      'audit_answers',
      { ...payload, audit: input.auditId, item: input.itemId } as never,
      { fields: [...ANSWER_FIELDS] },
    ),
  )) as unknown as AuditAnswer;
}

/* ------------------------------------------------------------------ */
/* Ảnh                                                                 */
/* ------------------------------------------------------------------ */

/**
 * Tải một ảnh từ điện thoại lên Directus, trả về id file.
 *
 * React Native không có đối tượng File như trên web. Cách chuẩn là nhét vào
 * FormData một object { uri, name, type } — cầu nối native sẽ tự đọc file
 * từ đường dẫn đó và stream lên, không phải nạp cả ảnh vào RAM.
 */
export async function uploadPhoto(asset: {
  uri: string;
  fileName?: string | null;
  mimeType?: string;
}): Promise<string> {
  const form = new FormData();
  const name = asset.fileName ?? `photo_${Date.now()}.jpg`;

  form.append('file', {
    uri: asset.uri,
    name,
    type: asset.mimeType ?? 'image/jpeg',
  } as unknown as Blob);

  const file = (await directus.request(uploadFiles(form))) as { id: string };
  return file.id;
}

/* ------------------------------------------------------------------ */
/* Thống kê cho màn tổng quan                                          */
/* ------------------------------------------------------------------ */

export async function myAuditStats(): Promise<{
  total: number;
  drafts: number;
  submitted: number;
  avgPercent: number | null;
}> {
  const [totalRes, draftRes, submittedRes] = await Promise.all([
    directus.request(aggregate('audits', { aggregate: { count: '*' } })),
    directus.request(
      aggregate('audits', { aggregate: { count: '*' }, query: { filter: { status: { _eq: 'draft' } } } }),
    ),
    directus.request(
      aggregate('audits', {
        aggregate: { count: '*', avg: 'score_percent' },
        query: { filter: { status: { _neq: 'draft' } } },
      }),
    ),
  ]);

  const num = (v: unknown) => (v === null || v === undefined ? 0 : Number(v));

  return {
    total: num((totalRes as never[])[0]?.['count']),
    drafts: num((draftRes as never[])[0]?.['count']),
    submitted: num((submittedRes as never[])[0]?.['count']),
    avgPercent: (submittedRes as never[])[0]?.['avg']?.['score_percent'] ?? null,
  };
}
