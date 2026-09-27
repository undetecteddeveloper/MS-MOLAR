// Ngưỡng dùng chung của Engine 1 (Adaptive AI & Feedback).
//
// Cả hai đều là GIÁ TRỊ TẠM do PRD tự đánh dấu (U3/U5) — ship với con số này
// rồi chỉnh lại khi có dữ liệu thật. Giữ ở đây thành hằng số có tên, KHÔNG rải
// literal khắp nơi, đúng vì lý do đó: chỉnh sau là diff một dòng.

import type { Subject } from "@/lib/analytics/constants";

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
 * Môn DUY NHẤT mà định tuyến "Nên luyện gì tiếp theo" (`recommendNextSkill()`
 * qua `getSkillRecommendation()`) xét — quyết định D2, 2026-09-16, khi cây kỹ
 * năng mở rộng ra 7 môn.
 *
 * Vì sao vẫn Toán, có chủ ý chứ không phải chưa kịp làm: (1) thẻ vàng mang
 * một hành động cố định "Tìm đề Toán" và câu cold start "luyện một đề Toán" —
 * gợi ý môn khác với nút ấy là gợi ý sai; (2) heuristic dựa vào ratio 0 cho
 * node CHƯA đụng, nên không lọc thì ngay khi seed môn mới, node chưa đụng của
 * môn khác thắng tie theo id (`anh-…` đứng đầu bảng chữ cái) và mọi học sinh
 * Toán được bảo đi luyện "Ngữ âm"; (3) cạnh tiên quyết — thứ làm heuristic
 * này khác một phép sort — chỉ có nghĩa ở các môn STEM, Văn/Sử ship 0 cạnh.
 * Mở rộng sang môn khác là quyết định SẢN PHẨM (nút/copy theo môn, có thể
 * một thẻ mỗi môn), không phải một hằng số khác. Thống kê "% đúng theo dạng
 * bài" KHÔNG đi qua hằng này — nó hiện đủ 7 môn.
 */
export const ROUTING_SUBJECT: Subject = "Math";

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
// BA trọng số dưới đây là TOÀN BỘ số học có thể chỉnh của thuật toán xếp hạng
// (hai, cho tới khi TD-028 đưa điểm-yếu-theo-môn trở lại — con số trong câu này
// là thứ đếm sai đầu tiên khi có tín hiệu thứ tư, nên nó được viết ra để đếm
// lại chứ không phải để tin).
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

/**
 * Trọng số của tín hiệu ĐIỂM YẾU THEO MÔN — `1 − điểm_trung_bình_môn / 10`
 * tính trên các lượt ĐẠI DIỆN đã có điểm của chính học sinh (∈ [0, 1]), 1 =
 * chưa gỡ được điểm nào ở môn đó.
 *
 * VÌ SAO TÍN HIỆU NÀY TỒN TẠI (TD-028). v1 CỐ Ý bỏ môn khỏi mọi khoá, và lý do
 * được ghi nguyên văn ở đầu `rankExams.ts`: số đo prod 2026-08-16 có 3 đề
 * published và cả 3 đều là Toán, nên môn là một HẰNG SỐ — một tín hiệu hằng
 * không đổi được thứ tự nào, chỉ tốn chỗ. Đo lại prod 2026-08-27: 6 đề
 * published, 4 môn (Toán 3, Hoá 1, Sinh 1, Lý 1), 4 lớp. Tiền đề hết hạn, nên
 * tín hiệu quay lại — không phải vì thiết kế đổi ý, mà vì số đo đổi.
 *
 * VÌ SAO ĐO BẰNG ĐIỂM CHỨ KHÔNG PHẢI `user_skill_mastery`. TD-028 kê hướng
 * "nối `user_skill_mastery` → điểm yếu theo MÔN". Không đi hướng đó ở đây, và
 * lý do là một số đo chứ không phải một sở thích: DAG kỹ năng CỐ Ý chỉ phủ Toán
 * (`skillTaxonomy.ts`), nên mastery không có một dòng nào cho Hoá, Sinh hay Lý
 * — tức đúng ba môn mà tín hiệu này sinh ra để phân biệt sẽ nhận "không biết"
 * vĩnh viễn. `exam_results.total_score` thì có mặt cho MỌI môn, và nó đã nằm
 * sẵn trong lượt đọc mà bộ xếp hạng đang thực hiện: 0 round-trip thêm.
 *
 * 0.5, và con số này chọn theo hai tính chất kiểm chứng được chứ không phải cảm
 * giác — cả hai đều có test ghim:
 *
 *   1. **Môn ĐÈ mới-cũ, nhưng chỉ khi điểm yếu là thật.** Một môn yếu tuyệt đối
 *      (0 điểm ⇒ số hạng 0.5) luôn thắng mọi lợi thế mới-cũ (tối đa 0.25).
 *      Một môn chỉ hơi yếu (số hạng < 0.25) thì nhường cho "mới hơn" — đúng
 *      dạng "nhỏ hơn nhưng không phải bằng 0" mà EXAM_RANK_RECENCY_WEIGHT đã
 *      dùng cho chính nó.
 *   2. **LỚP vẫn đè MÔN, và đây là tính chất an toàn, không phải thứ tự ưu
 *      tiên tuỳ ý.** Với học sinh chỉ làm bài ở MỘT lớp, tỉ trọng lớp là 1.0 /
 *      0, nên affinity tối đa của một đề SAI lớp là 0 + 0.5 + 0.25 = 0.75,
 *      còn affinity tối thiểu của một đề ĐÚNG lớp là 1.0. Một đề lớp 8 không
 *      bao giờ leo lên đầu danh sách của học sinh lớp 12 chỉ vì em ấy yếu
 *      Sinh. Đẩy nội dung sai lớp lên đầu là một kiểu hỏng TỆ HƠN việc gợi ý
 *      một môn em ấy đã vững.
 *
 * KHÔNG ĐỤNG TỚI `band`, có chủ ý. TD-028 kê việc xét lại `band` (cho một đề đã
 * làm điểm rất thấp vượt lên trên đề chưa làm) như một việc RIÊNG, và nó là một
 * câu hỏi SẢN PHẨM: PRD AC-019/D5 phát biểu `band` là khoá cứng, và đổi nó là
 * đổi một tiêu chí nghiệm thu, không phải chỉnh một trọng số. Tín hiệu này làm
 * việc của nó BÊN TRONG băng chưa-làm — tức đúng phần trên cùng của trang, nơi
 * người dùng thật sự nhìn.
 *
 * "KHÔNG BIẾT" KHÔNG PHẢI "BẰNG 0" ở một chỗ và LÀ 0 ở chỗ khác, và ranh giới
 * ấy cố ý: học sinh chưa có lượt nào có điểm ⇒ không có tín hiệu nào cả (mọi
 * đề nhận số hạng 0, cold-start giữ nguyên hành vi AC-022). Học sinh CÓ điểm
 * nhưng chưa đụng môn nào đó ⇒ môn ấy nhận 0, cùng quy ước với tỉ trọng lớp:
 * một môn chưa từng thử không được coi là yếu, vì không có gì nói nó yếu.
 */
export const EXAM_RANK_SUBJECT_WEAKNESS_WEIGHT = 0.5;

// --- Kệ đề ở trang /exams và trang chủ (PRD exam-shelves v1.1, ADR-0021 D4) --
//
// Bốn hằng số dưới đây là NGƯỠNG, không phải trọng số: không cái nào đi vào
// `affinityOf` ở trên — chúng định hình BA kệ (Cần luyện / Nổi nhất / Khám
// phá) chứ không xếp hạng bên trong một kệ. Cùng lý do đặt hằng số chỉnh-được
// ở file này thay vì rải trong `examShelves.ts`: chỉnh sau là diff một dòng.

/**
 * Số đề tối thiểu để một bậc trong "thang nới rộng" của kệ Nổi nhất được coi
 * là đủ đầy — dưới ngưỡng này thì thang nới rộng sang bậc kế (PRD D12/U4,
 * chốt 2026-09-18).
 *
 * 5, không phải 4. Lý do là sản phẩm, không phải kỹ thuật: một hàng 3-4 thẻ
 * đọc như một dải mỏng chứ không phải một lựa chọn có chủ đích, còn 5 thẻ mới
 * lấp đủ một hàng ở khổ 1000px (số đo canvas duyệt trước khi chốt U4). 4 là
 * phương án thay thế mà riêng phép tính gấp hàng ở 1000px ủng hộ, bị bỏ vì lý
 * do thẩm mỹ trên thắng, không phải vì 4 tính sai.
 *
 * So sánh dùng TẠI `examShelves.ts`'s `pickHotShelf` là `pool.length >=
 * HOT_SHELF_MIN_CARDS` — đúng bằng ngưỡng thì DỪNG nới rộng, không phải nới
 * thêm một bậc nữa.
 */
export const HOT_SHELF_MIN_CARDS = 5;

/**
 * Số thẻ tối đa mỗi kệ hiển thị, CẮT ở Node sau khi đã xếp hạng đầy đủ — không
 * bao giờ là một `.limit()`/`.range()` phía SQL (PRD AC-006, ADR-0021 D2 "rank-
 * then-cut" — khoá cứng kế thừa từ ADR-0015 kill criterion (a)).
 *
 * 10 (PRD D6). Ba kệ dùng chung một con số để trang không có ba mật độ khác
 * nhau; đổi số này không đổi thứ tự bên trong kệ, chỉ đổi điểm cắt.
 */
export const SHELF_MAX_CARDS = 10;

/**
 * Độ dài (ngày) của cửa sổ "gần đây" trong thang nới rộng của kệ Nổi nhất —
 * bậc ĐẦU TIÊN, hẹp nhất (PRD AC-019, subtitle `Khối {G}, tuần này` /
 * `Toàn hệ thống, tuần này`).
 *
 * 7 ngày, cỡ theo đúng hàng rủi ro "thưa dữ liệu" mà PRD ghi: ~92 lượt nộp
 * trải trên 7 đề published (đo 2026-08-31) — một cửa sổ 7 ngày trong MỘT lớp
 * có thể dễ dàng ra 0-2 đề, đó là lý do thang phải NỚI RỘNG chứ không dừng ở
 * bậc này, và cũng là lý do subtitle luôn nói rõ bậc nào đã tạo ra kệ thay vì
 * ngầm định "tuần này" cho mọi trường hợp.
 *
 * Số này chỉ định hình MỘT bậc của thang, không tự nó quyết định kệ có hiện
 * hay không — `HOT_SHELF_MIN_CARDS` mới là ngưỡng "đủ đầy" cho từng bậc.
 */
export const HOT_WINDOW_RECENT_DAYS = 7;

/**
 * Độ dài (ngày) của cửa sổ "rộng" trong thang nới rộng của kệ Nổi nhất — bậc
 * THỨ HAI, sau `HOT_WINDOW_RECENT_DAYS` (PRD AC-020, subtitle `Khối {G}, 30
 * ngày qua` / `Toàn hệ thống, 30 ngày qua`).
 *
 * 30 ngày — cùng cỡ rủi ro thưa dữ liệu mà `HOT_WINDOW_RECENT_DAYS` đã ghi:
 * một bậc rộng gấp hơn 4 lần bậc "tuần này" vẫn có thể chưa đủ 5 đề với kho
 * hiện tại, nên thang còn hai bậc nữa (all-time trong lớp, rồi all-time toàn
 * hệ thống) phía sau nó chứ 30 ngày không phải điểm dừng cuối.
 *
 * Tên trường trong `HotCounts` giữ nguyên là `wide` (không phải `wide30`) vì
 * nó đúng bằng cột `p_since_wide` mà `exam_hot_counts` trả về — đổi tên ở đây
 * mà không đổi ở RPC sẽ tạo ra một cặp tên lệch nhau không cần thiết.
 */
export const HOT_WINDOW_WIDE_DAYS = 30;
