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

// --- Xếp hạng đề ở Layer 2 (PRD exam-recommendation v1.2, R11/AC-036) --------
//
// Hai trọng số dưới đây là TOÀN BỘ số học có thể chỉnh của thuật toán xếp hạng.
// Chúng ở đây chứ không rải trong `rankExams.ts` vì lý do file này đã nói ở
// đầu: chỉnh sau phải là diff một dòng. Với tính năng này lý do còn mạnh hơn —
// bản v1 KHÔNG có nhãn, KHÔNG có click-through và KHÔNG có telemetry (PRD
// "Release partition"), nên comment ở đây là lời giải thích duy nhất đọc được
// bằng mắt người về việc vì sao danh sách đề lại xếp như thế, ở bất cứ đâu
// trong hệ thống đang chạy.

/**
 * Trọng số của tín hiệu KHỚP LỚP — tỉ trọng lượt làm bài đã nộp của học sinh
 * rơi vào lớp của đề đang xét (∈ [0, 1]).
 *
 * Đây là tín hiệu cá nhân hoá DUY NHẤT còn sống ở v1, nên nó là mốc 1.0 mà
 * trọng số kia được đọc theo tỉ lệ với. Số đo prod 2026-08-16 cho thấy lớp
 * THỰC SỰ phân biệt được kho đề hiện tại (2 đề lớp 12, 1 đề lớp 9) — đó chính
 * là lý do lớp qua được đợt cắt phạm vi còn "sở thích môn" thì không (cả 3 đề
 * đều là Toán, tín hiệu đó là hằng số).
 *
 * Điểm yếu đã biết, ghi ra thay vì giấu: tín hiệu này VÒNG TRÒN (PRD R-g) —
 * nó suy ra từ chính những đề học sinh đã chọn, nên nó củng cố lựa chọn cũ chứ
 * không mở rộng. Và nó không phạt cỡ mẫu: học sinh mới làm ĐÚNG MỘT đề cũng
 * cho tỉ trọng 1.0 y như học sinh đã làm hai mươi đề. Chấp nhận ở v1 vì cách
 * chữa thật là một cột `grade` có thật trên hồ sơ (PRD U7), không phải một
 * hằng số khác.
 */
export const EXAM_RANK_GRADE_MATCH_WEIGHT = 1;

/**
 * Trọng số của tín hiệu MỚI-CŨ — `created_at` chuẩn hoá min-max trong chính
 * tập ứng viên (∈ [0, 1]), 1 = mới nhất.
 *
 * 0.25 chọn theo một tính chất cụ thể chứ không phải cảm giác: vì cả hai tín
 * hiệu đều nằm trong [0, 1], mới-cũ chỉ có thể đảo chỗ hai đề khi tỉ trọng lớp
 * của chúng chênh nhau DƯỚI 0.25. Hệ quả là hai câu có thể kiểm chứng được:
 *   - một đề mới tinh SAI lớp không bao giờ vượt một đề cũ ĐÚNG lớp (chênh
 *     lệch tỉ trọng khi đó là 1.0 hoặc gần thế, vượt xa 0.25);
 *   - khi học sinh chia thời gian gần đều cho hai lớp (chênh < 0.25) thì "mới
 *     hơn" được quyền quyết định — đúng ý, vì lúc đó lớp không còn nói lên
 *     điều gì.
 * Đây là dạng "nhỏ hơn nhưng không phải bằng 0" mà PRD mô tả cho S6.
 *
 * Với kho đề hiện tại (3 đề) mới-cũ gần như quyết định toàn bộ thứ tự cho học
 * sinh cold-start — nửa số người dùng prod. Đó là trạng thái đã được thiết kế,
 * không phải sự cố: PRD AC-022 quy định cold-start xếp theo mới-cũ rồi tới id.
 */
export const EXAM_RANK_RECENCY_WEIGHT = 0.25;
