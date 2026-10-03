# Gợi ý dạng bài còn yếu cho mọi môn + Kho đề lọc theo dạng bài (2026-10-03)

Nhánh `feat/weak-skill-suggestions`. Không đổi schema (không bảng/cột/migration mới).

## Yêu cầu của người dùng
Hoàn thiện bảng gợi ý dạng bài còn yếu ở trang Thống kê: đề xuất cho TẤT CẢ các môn; bấm nút "Tìm đề" thì ExamBrowser phải hiện đúng các đề có dạng bài mà học sinh được báo là cần cải thiện.

## Quyết định sản phẩm (người dùng chốt 2026-10-03)
1. **Bố cục**: thẻ vàng "Nên luyện gì tiếp theo" có hàng chip môn; mỗi lần hiện gợi ý của MỘT môn.
2. **Thế nào là yếu**: dạng bài học sinh ĐÃ làm và đúng dưới 70% (`MASTERY_CLEARED_THRESHOLD`). Dạng chưa làm KHÔNG tính.
3. **Tiếng Anh, Lịch sử** (0/66 câu có dạng bài trên prod): gắn dạng bài bằng `tagQuestionSkills.ts` rồi hiện như các môn. Ghi prod → hỏi có/không ngay trước khi `--apply`.
4. **Không có gì để luyện** + lý do riêng cho từng trường hợp (thẻ không có nút): (a) đề duy nhất chứa dạng yếu là đề đã làm; (b) không đề nào chứa dạng yếu; (c) không yếu dạng nào; (d) môn chưa có câu nào được gắn dạng mà học sinh đã làm (suy ra từ 2: chưa làm thì chưa có gợi ý dạng).

## Số đo (prod, SELECT chỉ đọc, 2026-10-03; 14 đề published)
| Môn | Đề | Câu gắn dạng / tổng | Dạng có đề / tổng dạng |
|---|---|---|---|
| Toán | 2 | 4/9 | 3/20 |
| Lý | 2 | 23/37 | 2/15 |
| Hoá | 3 | 18/70 | 4/15 |
| Sinh | 3 | 40/90 | 4/16 |
| Văn | 2 | 7/12 | 4/6 |
| Anh | 1 | 0/40 | 0/9 |
| Sử | 1 | 0/26 | 0/10 |

Mỗi dạng có tối đa 1 đề. Vì dạng yếu luôn là dạng đã làm, đề chứa nó thường chính là đề vừa làm → trạng thái (a) sẽ gặp thường; đó là lý do người dùng chọn "báo không có gì để luyện" thay vì dẫn tới lưới chỉ có đề cũ.

## Thiết kế
**Nguồn "yếu"**: `skillBreakdownByRange.all` (đã tính sẵn ở `getAnalyticsByRange`, cộng dồn từ `per_question`, cùng số với thẻ "Kết quả theo dạng bài") — không đọc `user_skill_mastery` nữa vì nó chỉ có từ lúc nộp bài theo thẻ có lúc đó và không có mốc thời gian (xem đầu `lib/analytics/skillBreakdown.ts`). Thẻ luôn là "toàn thời gian", không theo chip Tuần/Tháng (như trước).

**Đề chứa dạng X**: `questions.skill_node_id = X` → `exams.question_ids && {id câu}` (`status = 'published'`), nối trong Node bằng 2–3 lượt đọc song song (không RPC/migration; `question_ids` là mảng, không có `exam_id` trên `questions`). Câu id chia lô 100 (cùng `QUESTION_ID_CHUNK`) để URL PostgREST không quá dài.

**Chữ ký**
- `lib/exams/skillExams.ts` (mới; ở lib/ vì luật B4 cấm tính năng import nhau, mà cả `features/analytics` lẫn `features/exams` cần): `readExamsBySkill(supabase, skillIds): Promise<Map<skillId, {id; subject}[]>>`.
- `features/exams/queries/skill.ts` (mới, server-only): `listExamIdsBySkill(supabase, skillId): Promise<string[]>`; `getSkillLabel(skillId): Promise<string | null>`.
- `lib/analytics/weakSkillSuggestions.ts` (mới, thuần): `suggestWeakSkills(breakdownAll, examsBySkill, doneExamIds): SubjectSuggestion[]` — luôn đủ 7 phần tử theo `SUBJECT_ORDER`.
  `SubjectSuggestion` = `{kind:"suggest", subject, skillNodeId, skillLabel, correct, total, openExamCount}` | `{kind:"none", subject, reason:"no-data"|"no-weak"}` | `{kind:"none", subject, reason:"all-done"|"no-exam", skillLabel, correct, total}`.
  Luật: dạng yếu xếp yếu nhất trước (thứ tự sẵn của reducer); chọn dạng yếu ĐẦU TIÊN có ≥1 đề published CÙNG MÔN chưa nộp; không dạng nào có → `all-done` nếu có dạng yếu nào có đề (nhãn = dạng yếu nhất có đề), còn không `no-exam` (nhãn = dạng yếu nhất).
- `ExamFilters.skill?: string` ở `catalogue.ts`: `fetchExamRows` lấy `listExamIdsBySkill` rồi `.in("id", ids)`; rỗng → trả `[]` không gọi tiếp.
- `AnalyticsPageData.suggestions: SubjectSuggestion[]`; trang dashboard bỏ `getSkillRecommendation`.
- `BROWSE_PARAM_KEYS` thêm `"skill"` (11 khoá). `skill` hợp lệ khi khớp `/^[a-z0-9-]{1,64}$/`, sai → bỏ như không có.

**Bỏ engine cũ khỏi trang**: xoá `getSkillRecommendation`, `recordRouteTelemetry`, `SkillRecommendation` (types/adaptive.ts), `ROUTING_SUBJECT`, test int tương ứng; `lib/adaptive/route.ts` (+ test) không còn nơi gọi → ghi TECH-DEBT. Hệ quả nhìn thấy: sự kiện telemetry `adaptive_route` ngừng ghi; lời giải thích "Vì sao là kỹ năng này?" (3 mã lý do) thay bằng một dòng số: "Đúng a/b câu (p%) ở dạng này".

## Tiêu chí chấp nhận
- **AC-01** Hàng chip đủ 7 môn (nhãn tiếng Việt, thứ tự `SUBJECT_ORDER`); mặc định chọn môn đầu tiên ở trạng thái gợi ý, không có thì môn đầu tiên có dạng yếu/đã có dữ liệu, không có thì Toán.
- **AC-02** Mỗi môn đúng một trong 5 trạng thái: gợi ý / no-data / no-weak / all-done / no-exam; bốn trạng thái "không có gì để luyện" mỗi cái một câu lý do riêng, KHÔNG có nút.
- **AC-03** Dạng yếu = có nhãn (bỏ "Chưa phân loại") và accuracy < 0,7, cộng dồn mọi thời gian.
- **AC-04** Với môn nhiều dạng yếu, gợi ý là dạng yếu nhất MÀ có đề chưa làm; thẻ ghi nhãn, "Đúng a/b câu (p%)", số đề chưa làm.
- **AC-05** Nút "Tìm đề" chỉ ở trạng thái gợi ý; href `/exams?subject=<Môn>&skill=<id>`; mọi thẻ ở lưới đó chứa ≥1 câu thuộc dạng đó và đúng môn; số thẻ chưa làm trong lưới = `openExamCount` trên thẻ vàng.
- **AC-06** `?skill=` xuống lưới phẳng (không ra kệ); phân trang giữ `skill`; đổi bộ lọc khác giữ `skill`; có chip "Dạng bài: <nhãn>" với nút bỏ; "Xoá lọc" xoá cả `skill`.
- **AC-07** `skill` lạ hoặc không đề nào chứa → trạng thái rỗng thường của Kho đề, không ném lỗi. Giới hạn đã biết: khách chưa đăng nhập mở link này thấy lưới rỗng (RLS `questions`/`skill_nodes` chỉ cho `authenticated`); thẻ vàng chỉ có trên trang cần đăng nhập nên không ảnh hưởng đường dùng chính.
- **AC-08** Đổi chip môn không gọi mạng, không nhảy bố cục (CLS 0 do đổi chip); chip ≥44px; 360/768/1280 không tràn ngang.
- **AC-09** Sau gắn dạng bài trên prod, Anh và Sử mỗi môn có ≥1 dạng có ≥1 đề (đo lại bằng SELECT chỉ đọc). Chưa đạt → ghi THIẾU, không nói xong.
- **AC-10** Không còn chuỗi tiếng Anh/khoá DB lộ ra màn hình (qua `subjectLabel`, `t()`).

## Task (mỗi task một commit)
1. `feat(exams)`: `skill.ts` + lọc `skill` ở `fetchExamRows` + `browseParams` + trang `/exams` + `ExamPagination` + chip ở `ExamFilters` (+ test).
2. `feat(analytics)`: `weakSkillSuggestions.ts` + test thuần; nối vào `getAnalyticsByRange`.
3. Prototype giao diện (Artifact, theo `ui.md`) → người dùng chọn → `feat(analytics)`: viết lại `SkillRecommendationCard` (client, chip), copy, dashboard; bỏ engine cũ; test.
4. Dữ liệu: dry-run `tagQuestionSkills.ts --subject=English|History` trên prod → đọc report → hỏi có/không → `--apply --from-report`. Không là commit code.
5. Cổng 6 bước, đo Playwright CLI (đăng nhập tài khoản test), cập nhật PROGRESS.md + TECH-DEBT.md, commit, dừng.
