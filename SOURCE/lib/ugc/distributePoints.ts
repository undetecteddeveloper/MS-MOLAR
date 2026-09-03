// distributePoints — LỜI KHAI DUY NHẤT của "chia N điểm cho một nhóm câu"
// (panel gán điểm màn sửa đề, 2026-09-03).
//
// Tách khỏi component vì luật ở đây phải ĐÚNG TUYỆT ĐỐI với cổng publish, và
// một luật sống trong JSX thì không có cách nào kiểm bằng test đơn.
//
// THUẦN: không I/O, không React, không đồng hồ.

import { LIMITS } from "./limits";

/** Số chữ số thập phân của một điểm câu.
 *
 *  2 chữ số là điểm gặp nhau của ba ràng buộc CÓ SẴN, không phải một con số
 *  đẹp: bậc nhỏ nhất tác giả gõ được theo quy chế là 0.1 và 0.25
 *  (TRUE_FALSE_TIERS trong lib/scoring/questionPoints.ts), còn POINTS_EPSILON
 *  = 0.01 là sai số mà cổng publish tha. Làm tròn thô hơn 2 chữ số sẽ đẩy tổng
 *  ra ngoài epsilon; mịn hơn thì sinh ra những con số như 0.4285714 mà tác giả
 *  không đọc nổi trên ô nhập, và cũng không viết được lên đề giấy. */
const POINT_DECIMALS = 2;

const SCALE = 10 ** POINT_DECIMALS;

/** Làm tròn về bậc điểm nhỏ nhất hiển thị được. */
function roundPoint(value: number): number {
  return Math.round(value * SCALE) / SCALE;
}

/**
 * Chia `total` điểm cho `count` câu theo `weights`, trả về mảng điểm từng câu.
 *
 * Bất biến QUAN TRỌNG NHẤT: **tổng mảng trả về bằng ĐÚNG `total`** sau khi làm
 * tròn — không phải "gần bằng". Lý do rất cụ thể: cổng publish cộng lại chính
 * những con số này và so với 10 trong sai số POINTS_EPSILON = 0.01. Cách ngây
 * thơ (làm tròn từng câu độc lập) hỏng ngay ở ví dụ đầu tiên người dùng nghĩ
 * ra — chia 3 điểm cho 7 câu:
 *
 *     3/7 = 0.428571…  →  làm tròn  0.43  ×7  =  3.01   (lệch 0.01)
 *
 * Trên một đề, cái lệch đó cộng dồn qua từng phần rồi hiện ra dưới dạng "tổng
 * 10.03/10" mà tác giả không tìm được nó ở đâu, vì mọi ô nhập đều trông đúng.
 *
 * Nên: làm tròn từng câu, rồi DỒN TOÀN BỘ phần dư vào câu CUỐI của nhóm. Câu
 * cuối lệch tối đa `count × 0.005` so với phần chia lý thuyết của nó — với
 * MAX_QUESTIONS = 50 thì tối đa 0.25 điểm, và chỉ ở những biểu điểm mà tác giả
 * vốn đã phải tự chỉnh tay. Đổi lại tổng LUÔN khớp, và đó là thứ chặn publish.
 *
 * Vì sao câu CUỐI chứ không phải câu đầu hay câu lớn nhất: nó là quy tắc duy
 * nhất mà tác giả nhìn bảng cũng suy ra được ("câu cuối gánh phần lẻ"), và nó
 * ổn định — chạy lại cùng input cho cùng kết quả, không nhảy chỗ khi trọng số
 * đổi một chút.
 *
 * @param total   Tổng điểm cho cả nhóm. Phải > 0.
 * @param weights Trọng số từng câu, cùng thứ tự với nhóm câu. Chia đều =
 *                mảng toàn 1. Trọng số ≤ 0 hoặc không hữu hạn bị coi là 0.
 * @returns       Mảng điểm cùng độ dài `weights`. Mảng rỗng nếu không chia được.
 */
export function distributePoints(total: number, weights: number[]): number[] {
  if (weights.length === 0) return [];
  if (!Number.isFinite(total) || total <= 0) return [];

  const safe = weights.map((w) => (Number.isFinite(w) && w > 0 ? w : 0));
  const sum = safe.reduce((a, b) => a + b, 0);
  // Mọi trọng số bằng 0 ⇒ không có tỉ lệ nào để chia. Rơi về chia đều thay vì
  // trả rỗng: người dùng vừa xoá hết ô trọng số thì ý định của họ rõ ràng vẫn
  // là "chia cho nhóm này", và một panel không phản hồi gì là câu trả lời tệ
  // hơn một biểu điểm đều.
  const effective = sum > 0 ? safe : safe.map(() => 1);
  const effectiveSum = sum > 0 ? sum : safe.length;

  const out = effective.map((w) => roundPoint((total * w) / effectiveSum));

  // Dồn dư vào câu cuối CÓ ĐIỂM. Nếu dồn vào một câu đang mang 0 (trọng số 0),
  // ta vừa hồi sinh một câu mà tác giả cố ý loại khỏi nhóm.
  // Mọi câu làm tròn về 0 (tổng quá nhỏ so với số câu) ⇒ KHÔNG có câu nào để
  // dồn dư vào, và mảng toàn 0 chính là biểu điểm mà cổng publish sẽ chặn.
  // Trả rỗng để panel báo "không chia được" thay vì ghi một biểu điểm hỏng.
  const lastScored = out.reduce((acc, p, i) => (p > 0 ? i : acc), -1);
  if (lastScored === -1) return [];

  const drift = roundPoint(total - out.reduce((a, b) => a + b, 0));
  if (drift !== 0) out[lastScored] = roundPoint(out[lastScored] + drift);

  // Dồn dư có thể kéo câu cuối xuống ≤ 0 khi nhóm quá đông so với tổng (vd 0.1
  // điểm cho 50 câu: mỗi câu làm tròn về 0, câu cuối gánh 0.1 — vẫn dương; còn
  // trọng số lệch cực đoan thì có thể âm). Cổng publish từ chối `points <= 0`,
  // nên trả về một mảng như thế là đẩy tác giả vào lỗi mà panel vừa tạo ra.
  if (out[lastScored] <= 0) return [];

  return out;
}

/** Tổng điểm của một đề, làm tròn cùng bậc với `distributePoints`.
 *
 *  Dùng cho con số `x/10` trong panel. Làm tròn Ở ĐÂY chứ không để component
 *  tự `toFixed`: cộng dấu phẩy động 40 lần ra 9.999999999999998, và một panel
 *  báo "9.999999999999998/10" trong khi cổng publish nói đề hợp lệ là hai
 *  nguồn chân lý nói ngược nhau về cùng một đề. */
export function sumPoints(points: (number | undefined)[]): number {
  return roundPoint(
    points.reduce<number>(
      (acc, p) => acc + (typeof p === "number" && Number.isFinite(p) && p > 0 ? p : 0),
      0
    )
  );
}

/** Tổng điểm đề đã khớp thang chưa — CÙNG phép thử với validatePointsForPublish. */
export function isTotalBalanced(total: number): boolean {
  return Math.abs(total - LIMITS.EXAM_TOTAL_POINTS) <= LIMITS.POINTS_EPSILON;
}
