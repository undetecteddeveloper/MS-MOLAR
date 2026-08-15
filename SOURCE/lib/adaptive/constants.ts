// Ngưỡng dùng chung của Engine 1 (Adaptive AI & Feedback).
//
// Cả hai đều là GIÁ TRỊ TẠM do PRD tự đánh dấu (U3/U5) — ship với con số này
// rồi chỉnh lại khi có dữ liệu thật. Giữ ở đây thành hằng số có tên, KHÔNG rải
// literal khắp nơi, đúng vì lý do đó: chỉnh sau là diff một dòng.

/**
 * Tỉ lệ đúng (correctCount / totalCount) từ mức này trở lên thì coi như một
 * node kỹ năng đã "qua" — dùng làm cổng tiên quyết trong `recommendNextSkill()`
 * (PRD U5).
 *
 * 0.7 là con số PRD chọn khi chưa có dữ liệu sử dụng thật; corpus hiện chỉ ~47
 * câu Toán nên phần lớn node sẽ có rất ít lượt làm (PRD R-f). Đặt thấp hơn thì
 * học sinh bị đẩy qua node kế khi chưa vững; đặt cao hơn thì gần như không node
 * nào "qua" nổi với lượng câu hỏi hiện có, và mọi gợi ý sẽ dồn hết về node gốc.
 * Final-Phase Task 27 ghi lại giá trị thực sự ship/chỉnh lại.
 */
export const MASTERY_CLEARED_THRESHOLD = 0.7;

/**
 * Ngưỡng tin cậy tối thiểu để `tagQuestionSkills.ts` GHI `questions.skill_node_id`
 * (PRD U3/D2/AC-005). Dưới ngưỡng thì để NULL, không đoán bừa — cùng quy ước
 * với `normalizeSubject()` (lib/ugc/subjects.ts) trả null thay vì đoán.
 *
 * Cao hơn `MASTERY_CLEARED_THRESHOLD` có chủ ý: một tag sai KHÔNG hiện ra như
 * lỗi (PRD R-a — học sinh chỉ đơn giản bị đẩy đi luyện sai thứ, và mô hình
 * mastery học theo cái sai đó), nên thà bỏ trống còn hơn ghi nhầm.
 *
 * 0.90, KHÔNG phải 0.75 như PRD ghi ban đầu. Đây chính là lần chỉnh mà U3 dự
 * liệu sẵn ("shipped as placeholder, retune when real data exists"), và dữ
 * liệu thật đã có: dry-run trên toàn corpus 47 câu Toán (2026-08-15) cho thấy
 * ranh giới đúng/sai nằm gọn ở mốc 0.90 —
 *   - 36 câu confidence >= 0.90: engineer rà tay, 100% đúng.
 *   - 5 câu confidence == 0.85: cả 5 đều sai hoặc lệch — "tập xác định của
 *     hàm số" bị xếp vào mệnh-đề-tập-hợp; hàm BẬC NHẤT y = 2x-1 bị xếp vào
 *     hàm-số-bậc-hai (taxonomy không có node cho hàm bậc nhất, đúng ra phải
 *     NULL); và 3 câu "đạo hàm tại một điểm" — kiến thức lớp 11, DAG cố ý
 *     không phủ lớp 11. Chính câu lớp 11 đó ở một lần chạy khác bị model xếp
 *     "no-matching-node", tức bản thân model cũng không chắc.
 * 0.85 là mức model dùng khi "gần đúng nhưng không hẳn" — đúng nhóm mà D2 bảo
 * để NULL. Coverage tụt 87.2% → 76.6%, vẫn trên mốc dừng-xem-lại 70% của PRD
 * Success Criteria #4.
 */
export const SKILL_TAG_CONFIDENCE_THRESHOLD = 0.9;
