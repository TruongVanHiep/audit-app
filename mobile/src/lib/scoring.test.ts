/**
 * scoring.test.ts — Test cho logic tính điểm.
 *
 * Chạy:  node --test mobile/src/lib/scoring.test.ts
 *
 * Không cần jest, vitest, hay bước build. Node 24 chạy thẳng file .ts bằng
 * cách bóc bỏ phần kiểu. Lưu ý: nó KHÔNG kiểm tra kiểu (việc đó là của
 * `npx tsc --noEmit`), và không chạy được `.tsx` — nên cách này chỉ dùng cho
 * hàm thuần, không dùng cho component React.
 *
 * Nhớ ghi đuôi `.ts` trong import, Node không tự đoán như bundler.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  computeAuditScore,
  isCriticalFailure,
  rawPoints,
  validateForSubmit,
  weightedScore,
  PASS_THRESHOLD_PERCENT,
} from './scoring.ts';
import type { AnswerType, TemplateItem } from './types.ts';

/** Tạo nhanh một tiêu chí, chỉ khai những gì cần cho từng test. */
function item(over: Partial<TemplateItem> & { id: string }): TemplateItem {
  return {
    template: 'tpl',
    sort: 0,
    section: 'Nhóm',
    question: 'Câu hỏi',
    guidance: null,
    answer_type: 'pass_fail' as AnswerType,
    weight: 1,
    requires_photo: false,
    is_critical: false,
    ...over,
  };
}

/* ------------------------------------------------------------------ */

describe('rawPoints — quy đổi giá trị thô sang thang 0-5', () => {
  test('pass_fail: "pass" = 5, "fail" = 0', () => {
    assert.equal(rawPoints('pass_fail', 'pass'), 5);
    assert.equal(rawPoints('pass_fail', 'fail'), 0);
  });

  test('score_5: lấy đúng con số đã chấm', () => {
    assert.equal(rawPoints('score_5', '4'), 4);
    assert.equal(rawPoints('score_5', '1'), 1);
  });

  test('score_5: kẹp giá trị ngoài khoảng, phòng dữ liệu bẩn từ bản ghi cũ', () => {
    assert.equal(rawPoints('score_5', '9'), 5);
    assert.equal(rawPoints('score_5', '-3'), 0);
  });

  test('number và text không được chấm điểm', () => {
    assert.equal(rawPoints('number', '42'), null);
    assert.equal(rawPoints('text', 'thiếu người ca chiều'), null);
  });

  test('chưa trả lời thì trả về null, không phải 0', () => {
    // Phân biệt quan trọng: 0 điểm là ĐÃ chấm và trượt;
    // null là CHƯA chấm. Lẫn hai cái này là tính sai tiến độ.
    assert.equal(rawPoints('pass_fail', null), null);
    assert.equal(rawPoints('pass_fail', ''), null);
    assert.equal(rawPoints('score_5', undefined), null);
  });
});

describe('weightedScore — nhân trọng số', () => {
  test('nhân đúng hệ số', () => {
    assert.equal(weightedScore(item({ id: 'a', weight: 3 }), 'pass'), 15);
    assert.equal(
      weightedScore(item({ id: 'b', answer_type: 'score_5', weight: 2 }), '4'),
      8,
    );
  });

  test('tiêu chí trọng số 0 không tính điểm', () => {
    assert.equal(
      weightedScore(item({ id: 'c', answer_type: 'number', weight: 0 }), '5'),
      null,
    );
  });
});

describe('isCriticalFailure — tiêu chí trọng yếu', () => {
  const critical = item({ id: 'k', is_critical: true });

  test('trượt tiêu chí trọng yếu thì bị đánh dấu', () => {
    assert.equal(isCriticalFailure(critical, 'fail'), true);
  });

  test('đạt thì không bị đánh dấu', () => {
    assert.equal(isCriticalFailure(critical, 'pass'), false);
  });

  test('chấm 1-2 điểm cũng coi là trượt tiêu chí trọng yếu', () => {
    const c5 = item({ id: 'k5', is_critical: true, answer_type: 'score_5' });
    assert.equal(isCriticalFailure(c5, '2'), true);
    assert.equal(isCriticalFailure(c5, '3'), false);
  });

  test('chưa trả lời thì chưa kết luận là trượt', () => {
    assert.equal(isCriticalFailure(critical, null), false);
  });

  test('tiêu chí thường trượt không kích hoạt cờ trọng yếu', () => {
    assert.equal(isCriticalFailure(item({ id: 'n' }), 'fail'), false);
  });
});

describe('computeAuditScore — tính điểm cả phiếu', () => {
  test('cộng dồn đúng và tính đúng phần trăm', () => {
    const items = [
      item({ id: 'a', weight: 2 }),                            // tối đa 10
      item({ id: 'b', weight: 1, answer_type: 'score_5' }),     // tối đa 5
    ];
    const r = computeAuditScore(items, { a: 'pass', b: '3' });

    assert.equal(r.score, 10 + 3);
    assert.equal(r.totalMaxScore, 15);
    assert.equal(r.percent, 86.7);
    assert.equal(r.answered, 2);
  });

  test('tiêu chí chưa trả lời VẪN nằm trong điểm tối đa', () => {
    // Nếu không, làm 1 câu đúng rồi bỏ dở sẽ hiện 100% — sai nguy hiểm,
    // auditor tưởng mình đang đạt điểm tuyệt đối.
    const items = [item({ id: 'a' }), item({ id: 'b' })];
    const r = computeAuditScore(items, { a: 'pass' });

    assert.equal(r.score, 5);
    assert.equal(r.totalMaxScore, 10);
    assert.equal(r.percent, 50);
    assert.equal(r.answeredMaxScore, 5);
    assert.equal(r.answered, 1);
  });

  test('tiêu chí number/text không làm phình điểm tối đa', () => {
    const items = [
      item({ id: 'a' }),
      item({ id: 'b', answer_type: 'number', weight: 0 }),
      item({ id: 'c', answer_type: 'text', weight: 0 }),
    ];
    const r = computeAuditScore(items, { a: 'pass', b: '7', c: 'ghi chú' });

    assert.equal(r.totalMaxScore, 5);
    assert.equal(r.percent, 100);
    assert.equal(r.answered, 3, 'vẫn đếm là đã trả lời để tính tiến độ');
  });

  test('trượt tiêu chí trọng yếu thì KHÔNG đạt dù điểm rất cao', () => {
    // Đây là quy tắc nghiệp vụ quan trọng nhất: không thể bù lỗi
    // "chắn lối thoát hiểm" bằng điểm trưng bày đẹp.
    const items = [
      item({ id: 'a', weight: 10 }),                 // tối đa 50
      item({ id: 'k', weight: 1, is_critical: true }), // tối đa 5
    ];
    const r = computeAuditScore(items, { a: 'pass', k: 'fail' });

    assert.equal(r.percent, 90.9, 'điểm vẫn cao');
    assert.ok(r.percent >= PASS_THRESHOLD_PERCENT, 'vượt ngưỡng đạt');
    assert.equal(r.hasCriticalFailure, true);
    assert.deepEqual(r.criticalFailures, ['k']);
    assert.equal(r.passed, false, 'nhưng vẫn phải KHÔNG ĐẠT');
  });

  test('dưới ngưỡng thì không đạt dù không trượt tiêu chí trọng yếu', () => {
    const items = [item({ id: 'a' }), item({ id: 'b' })];
    const r = computeAuditScore(items, { a: 'pass', b: 'fail' });

    assert.equal(r.percent, 50);
    assert.equal(r.hasCriticalFailure, false);
    assert.equal(r.passed, false);
  });

  test('bộ tiêu chí rỗng không làm chia cho 0', () => {
    const r = computeAuditScore([], {});
    assert.equal(r.percent, 0);
    assert.equal(r.passed, false);
  });
});

describe('validateForSubmit — điều kiện nộp bài', () => {
  test('đủ điều kiện thì không có vấn đề nào', () => {
    const items = [item({ id: 'a' })];
    assert.deepEqual(validateForSubmit(items, { a: 'pass' }, {}), []);
  });

  test('còn tiêu chí chưa trả lời thì chặn', () => {
    const items = [item({ id: 'a' }), item({ id: 'b' })];
    const p = validateForSubmit(items, { a: 'pass' }, {});
    assert.equal(p.length, 1);
    assert.match(p[0], /1 tiêu chí chưa trả lời/);
  });

  test('thiếu ảnh bắt buộc thì chặn', () => {
    const items = [item({ id: 'a', requires_photo: true })];
    const p = validateForSubmit(items, { a: 'pass' }, { a: 0 });
    assert.equal(p.length, 1);
    assert.match(p[0], /bắt buộc chụp ảnh/);
  });

  test('có ảnh rồi thì qua', () => {
    const items = [item({ id: 'a', requires_photo: true })];
    assert.deepEqual(validateForSubmit(items, { a: 'pass' }, { a: 2 }), []);
  });

  test('báo cùng lúc cả hai loại thiếu sót', () => {
    const items = [
      item({ id: 'a' }),
      item({ id: 'b', requires_photo: true }),
    ];
    const p = validateForSubmit(items, { b: 'pass' }, { b: 0 });
    assert.equal(p.length, 2);
  });
});
