/**
 * types.ts — Kiểu dữ liệu khớp với schema Directus.
 *
 * Directus SDK cho phép khai báo "schema" của toàn bộ project dưới dạng
 * TypeScript. Khi đã khai báo, mọi lời gọi readItems('stores') sẽ được
 * TypeScript kiểm tra: gõ sai tên collection, sai tên field, hay dùng sai
 * kiểu -> báo lỗi ngay lúc viết code chứ không phải lúc app chạy trên điện thoại.
 *
 * Các định nghĩa ở đây phải khớp với directus/schema/setup-schema.mjs.
 * Sửa schema thì nhớ sửa cả file này.
 */

/* ------------------------------------------------------------------ */
/* Các kiểu literal — đồng bộ với dropdown trong Directus              */
/* ------------------------------------------------------------------ */

export type Region = 'north' | 'central' | 'south';

export type AnswerType = 'pass_fail' | 'score_5' | 'number' | 'text';

export type AuditStatus = 'draft' | 'submitted' | 'reviewed' | 'cancelled';

export type Severity = 'low' | 'medium' | 'high' | 'critical';

export type FindingStatus = 'open' | 'in_progress' | 'resolved' | 'closed';

/* ------------------------------------------------------------------ */
/* Collections                                                         */
/* ------------------------------------------------------------------ */

export interface Store {
  id: string;
  code: string;
  name: string;
  address: string | null;
  region: Region | null;
  manager_name: string | null;
  phone: string | null;
  latitude: number | null;
  longitude: number | null;
  is_active: boolean;
}

export interface Template {
  id: string;
  name: string;
  description: string | null;
  version: number;
  status: 'draft' | 'published' | 'archived';
  /** Chỉ có dữ liệu khi query kèm `fields: ['items.*']` */
  items?: TemplateItem[];
}

export interface TemplateItem {
  id: string;
  template: string;
  sort: number | null;
  section: string;
  question: string;
  guidance: string | null;
  answer_type: AnswerType;
  weight: number;
  requires_photo: boolean;
  is_critical: boolean;
}

export interface Audit {
  id: string;
  store: string | Store;
  template: string | Template;
  auditor: string | null;
  status: AuditStatus;
  date_started: string | null;
  date_submitted: string | null;
  score: number | null;
  max_score: number | null;
  score_percent: number | null;
  latitude: number | null;
  longitude: number | null;
  note: string | null;
  answers?: AuditAnswer[];
  findings?: Finding[];
}

/**
 * Bảng trung gian nối câu trả lời với file ảnh.
 *
 * Phải khai báo tường minh và đưa vào `Schema` bên dưới, nếu không Directus SDK
 * không coi `photos` là quan hệ và sẽ không cho query field lồng nhau
 * `{ photos: ['directus_files_id'] }`.
 */
export interface AuditAnswerPhoto {
  id: number;
  audit_answers_id: string;
  directus_files_id: string;
}

export interface FindingPhoto {
  id: number;
  findings_id: string;
  directus_files_id: string;
}

export interface AuditAnswer {
  id: string;
  audit: string;
  item: string | TemplateItem;
  /** Giá trị thô dạng chuỗi. Cách đọc phụ thuộc answer_type của item. */
  value: string | null;
  score: number | null;
  note: string | null;
  photos?: AuditAnswerPhoto[];
}

export interface Finding {
  id: string;
  audit: string;
  answer: string | null;
  title: string;
  description: string | null;
  severity: Severity;
  status: FindingStatus;
  due_date: string | null;
  corrective_action: string | null;
  date_resolved: string | null;
  assignee: string | null;
  photos?: FindingPhoto[];
}

export interface DirectusUser {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  avatar: string | null;
}

/* ------------------------------------------------------------------ */
/* Schema tổng — đây là thứ truyền vào createDirectus<Schema>()         */
/* ------------------------------------------------------------------ */

export interface Schema {
  stores: Store[];
  templates: Template[];
  template_items: TemplateItem[];
  audits: Audit[];
  audit_answers: AuditAnswer[];
  findings: Finding[];
  // Bảng trung gian — phải có mặt ở đây thì SDK mới hiểu quan hệ ảnh
  audit_answers_photos: AuditAnswerPhoto[];
  findings_photos: FindingPhoto[];
}

/* ------------------------------------------------------------------ */
/* Nhãn tiếng Việt để hiển thị                                         */
/* ------------------------------------------------------------------ */

export const REGION_LABEL: Record<Region, string> = {
  north: 'Miền Bắc',
  central: 'Miền Trung',
  south: 'Miền Nam',
};

export const AUDIT_STATUS_LABEL: Record<AuditStatus, string> = {
  draft: 'Đang làm',
  submitted: 'Đã nộp',
  reviewed: 'Đã duyệt',
  cancelled: 'Đã huỷ',
};

export const SEVERITY_LABEL: Record<Severity, string> = {
  low: 'Thấp',
  medium: 'Trung bình',
  high: 'Cao',
  critical: 'Nghiêm trọng',
};
