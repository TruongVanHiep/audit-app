/**
 * scoring.ts — Quy tắc tính điểm audit.
 *
 * Toàn bộ file này là HÀM THUẦN: cùng đầu vào luôn cho cùng đầu ra, không
 * đụng tới mạng, không đụng tới state, không đụng tới giao diện. Nhờ vậy
 * có thể kiểm thử bằng Node thuần, không cần mở app lên (xem scoring.test.mjs).
 *
 * Tách logic nghiệp vụ ra khỏi component là thói quen đáng giữ: khi sếp đổi
 * cách tính điểm, bạn chỉ sửa một file, không phải lục tung các màn hình.
 *
 * ─── QUY TẮC ────────────────────────────────────────────────────────
 *
 * Mỗi tiêu chí được chấm trên thang 0-5, rồi nhân với trọng số (weight):
 *
 *   pass_fail  ->  Đạt = 5 điểm, Không đạt = 0 điểm
 *   score_5    ->  chấm trực tiếp 1-5 điểm
 *   number     ->  chỉ ghi nhận số liệu, KHÔNG tính điểm (weight = 0)
 *   text       ->  chỉ ghi nhận chữ, KHÔNG tính điểm (weight = 0)
 *
 * Điểm tối đa = tổng (weight × 5) của các tiêu chí có tính điểm.
 *
 * Riêng tiêu chí đánh dấu `is_critical`: trượt tiêu chí đó thì cả phiên audit
 * bị đánh trượt, bất kể tổng điểm cao bao nhiêu. Ví dụ "chắn lối thoát hiểm"
 * hay "bán hàng hết hạn" — không thể bù bằng điểm trưng bày đẹp.
 */

import type { AnswerType, TemplateItem } from './types';

/** Thang điểm gốc của mỗi tiêu chí trước khi nhân trọng số. */
export const MAX_POINTS_PER_ITEM = 5;

/** Chấm score_5 từ mức này trở xuống thì coi là trượt tiêu chí trọng yếu. */
export const CRITICAL_FAIL_THRESHOLD = 2;

/** Tiêu chí có được tính vào tổng điểm không? */
export function isScored(item: Pick<TemplateItem, 'answer_type' | 'weight'>): boolean {
  return (
    (item.answer_type === 'pass_fail' || item.answer_type === 'score_5') &&
    item.weight > 0
  );
}

/**
 * Quy đổi giá trị thô sang thang 0-5.
 * Trả về null nếu chưa trả lời hoặc tiêu chí không tính điểm.
 */
export function rawPoints(answerType: AnswerType, value: string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;

  switch (answerType) {
    case 'pass_fail':
      return value === 'pass' ? MAX_POINTS_PER_ITEM : 0;

    case 'score_5': {
      const n = Number(value);
      if (!Number.isFinite(n)) return null;
      // Kẹp vào khoảng hợp lệ, phòng dữ liệu bẩn từ bản ghi cũ
      return Math.min(MAX_POINTS_PER_ITEM, Math.max(0, n));
    }

    default:
      return null; // number / text: chỉ ghi nhận, không chấm
  }
}

/** Điểm đã nhân trọng số của một câu trả lời. */
export function weightedScore(
  item: Pick<TemplateItem, 'answer_type' | 'weight'>,
  value: string | null | undefined,
): number | null {
  if (!isScored(item)) return null;
  const points = rawPoints(item.answer_type, value);
  return points === null ? null : points * item.weight;
}

/** Câu trả lời này có làm trượt tiêu chí trọng yếu không? */
export function isCriticalFailure(
  item: Pick<TemplateItem, 'answer_type' | 'weight' | 'is_critical'>,
  value: string | null | undefined,
): boolean {
  if (!item.is_critical) return false;
  const points = rawPoints(item.answer_type, value);
  if (points === null) return false; // chưa trả lời thì chưa kết luận
  return points <= CRITICAL_FAIL_THRESHOLD;
}

/* ------------------------------------------------------------------ */

export interface AuditScore {
  /** Tổng điểm đạt được (đã nhân trọng số). */
  score: number;
  /** Tổng điểm tối đa của các tiêu chí ĐÃ trả lời. */
  answeredMaxScore: number;
  /** Tổng điểm tối đa của toàn bộ bộ tiêu chí. */
  totalMaxScore: number;
  /** Phần trăm trên tổng điểm tối đa toàn bộ, làm tròn 1 chữ số. */
  percent: number;
  /** Số tiêu chí bắt buộc đã trả lời / tổng số. */
  answered: number;
  total: number;
  /** Có tiêu chí trọng yếu nào bị trượt không. */
  hasCriticalFailure: boolean;
  /** Danh sách id tiêu chí trọng yếu bị trượt. */
  criticalFailures: string[];
  /** Kết luận cuối: đạt hay không. */
  passed: boolean;
}

/** Ngưỡng % để coi là đạt. */
export const PASS_THRESHOLD_PERCENT = 80;

/**
 * Tính điểm cho cả phiên audit.
 *
 * @param items    toàn bộ tiêu chí của bộ template
 * @param answers  map từ item.id -> giá trị thô đã trả lời
 */
export function computeAuditScore(
  items: TemplateItem[],
  answers: Record<string, string | null | undefined>,
): AuditScore {
  let score = 0;
  let answeredMaxScore = 0;
  let totalMaxScore = 0;
  let answered = 0;
  const criticalFailures: string[] = [];

  for (const item of items) {
    const value = answers[item.id];
    const hasAnswer = value !== null && value !== undefined && value !== '';

    if (hasAnswer) answered++;

    if (isCriticalFailure(item, value)) {
      criticalFailures.push(item.id);
    }

    if (!isScored(item)) continue;

    const itemMax = item.weight * MAX_POINTS_PER_ITEM;
    totalMaxScore += itemMax;

    const earned = weightedScore(item, value);
    if (earned !== null) {
      score += earned;
      answeredMaxScore += itemMax;
    }
  }

  const percent =
    totalMaxScore === 0 ? 0 : Math.round((score / totalMaxScore) * 1000) / 10;

  return {
    score,
    answeredMaxScore,
    totalMaxScore,
    percent,
    answered,
    total: items.length,
    hasCriticalFailure: criticalFailures.length > 0,
    criticalFailures,
    passed: percent >= PASS_THRESHOLD_PERCENT && criticalFailures.length === 0,
  };
}

/**
 * Kiểm tra phiên audit đã đủ điều kiện nộp chưa.
 * Trả về danh sách lý do chưa nộp được (rỗng = nộp được).
 */
export function validateForSubmit(
  items: TemplateItem[],
  answers: Record<string, string | null | undefined>,
  photoCounts: Record<string, number>,
): string[] {
  const problems: string[] = [];

  const unanswered = items.filter((i) => {
    const v = answers[i.id];
    return v === null || v === undefined || v === '';
  });
  if (unanswered.length > 0) {
    problems.push(`Còn ${unanswered.length} tiêu chí chưa trả lời`);
  }

  const missingPhotos = items.filter(
    (i) => i.requires_photo && (photoCounts[i.id] ?? 0) === 0,
  );
  if (missingPhotos.length > 0) {
    problems.push(`Còn ${missingPhotos.length} tiêu chí bắt buộc chụp ảnh nhưng chưa có ảnh`);
  }

  return problems;
}

/** Màu hiển thị theo mức điểm — dùng chung cho mọi màn hình. */
export function scoreColor(percent: number): string {
  if (percent >= 90) return '#16A34A'; // xanh lá — tốt
  if (percent >= PASS_THRESHOLD_PERCENT) return '#65A30D'; // xanh vàng — đạt
  if (percent >= 60) return '#EA580C'; // cam — cần cải thiện
  return '#DC2626'; // đỏ — kém
}
