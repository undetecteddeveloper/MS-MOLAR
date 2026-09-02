# Đề trong website không khớp đề nguyên bản — cấu trúc (Nhóm A) + luật chấm (Nhóm B)

> **Trạng thái:** đã bàn xong 2026-09-01, CHƯA implement dòng nào.
> Phiên bàn chỉ đọc code, không sửa. Cây làm việc sạch.
>
> File này là prompt bàn giao — đọc hết trước khi viết code.

---

## Bối cảnh

Người dùng upload đề Tiếng Anh 12 (THPT Thống Nhất A, Đồng Nai, mã 101, 40 câu)
và gặp 7 lỗi `STEM_TOO_LONG` ở câu 34–40. Truy ra thì trần 2000 ký tự chỉ là
triệu chứng; nguyên nhân sâu hơn là **module upload không tái hiện đúng cấu
trúc đề gốc**, và khi soát tiếp thì lộ thêm một lỗ thứ hai ở **luật chấm điểm**.

Giả định gốc của toàn hệ thống:

> **một câu hỏi = một đơn vị độc lập, tự chứa đủ mọi thứ để trả lời nó**

Toàn bộ pipeline là bản phiên âm của MỘT format: đề chuẩn quốc gia 2025 khối
KHTN/KHXH (PHẦN I trắc nghiệm / PHẦN II đúng-sai 4 ý / PHẦN III trả lời ngắn).
Bằng chứng: prompt trích xuất `lib/ugc/extractQuestions.ts:139-143` và prompt
đáp án `lib/ugc/extractAnswers.ts:100-103` đều mô tả từng loại câu bằng đúng
công thức *"typical of PHẦN I / II / III"*.

---

## LỖI HIỆN TẠI

### Nhóm A — Cấu trúc đề không khớp nguyên bản

Ảnh hưởng: **Tiếng Anh + Ngữ văn**. Đây là hai môn mà đề thường xuyên vi phạm
giả định "câu độc lập". 8 môn còn lại dùng đúng format PHẦN I/II/III nên khớp —
vì format khớp, không phải vì môn đó miễn nhiễm.

| # | Lỗi | Nơi ép | Môn |
|---|-----|--------|-----|
| A1 | **Không có khái niệm ngữ liệu dùng chung.** `stem` là chuỗi riêng của từng câu (`lib/ugc/types.ts`), không có chỗ chứa bài đọc dùng chung cho một NHÓM câu. Hệ quả: đoạn văn bị chép lặp vào stem mỗi câu → chính là 7 lỗi `STEM_TOO_LONG` ở câu 34–40 (một chuỗi 7 câu liên tiếp = đúng một bài đọc). Còn kéo theo: lưu 7 bản, hiện cho học sinh 7 lần lúc làm bài, tốn output token AI 7 lần. | `lib/ugc/types.ts` | Anh, Văn |
| A2 | **Không đựng được câu Đ/S một mệnh đề đơn.** `hasValidSubItemSet` bắt buộc `MIN_SUB_ITEMS = 2`. Cái bẫy nằm ở tên: `true_false` trong codebase KHÔNG có nghĩa "câu đúng/sai" — nó nghĩa là *"khối PHẦN II: một câu dẫn kèm 4 ý a–d, mỗi ý chấm Đ/S riêng"*. AI gặp "Decide whether the following statement is True or False" thì chọn `type: "true_false"` (đúng nghĩa tiếng Anh thông thường) nhưng schema hiểu khác, nên nhét mệnh đề vào `stem` và để `subItems` rỗng. `QuestionEditor.tsx:272` ở chế độ sửa luôn vẽ đủ 4 ô a–d bất kể có bao nhiêu ý thật → 4 ô trống. | `lib/ugc/assembleExam.ts:56-64` | Anh |
| A3 | **`mcq` bắt buộc đúng 4 lựa chọn, id đúng tập {A,B,C,D}.** Không biểu diễn được dạng True/False/Not Given (3 lựa chọn), cũng không được 2 hay 5 lựa chọn. | `lib/ugc/assembleExam.ts:47-53` | Anh |
| A6 | **`MAX_ESSAY_ANSWER: 4000` chật cho hướng dẫn chấm Văn.** Đáp án mẫu một bài nghị luận văn học có biểu điểm chi tiết từng ý vượt 4000 ký tự là bình thường. Đây là bản song sinh của A7. Ngoài ra: câu `essay` KHÔNG có đáp án mẫu thì **chặn publish** (`assembleExam.ts:214` → `ANSWER_MISSING`) — đề Văn mà file đáp án chỉ ghi dàn ý sơ lược sẽ không lên được. | `lib/ugc/limits.ts` | Văn |
| A7 | **`MAX_STEM: 2000` chật cho bài đọc.** Triệu chứng khởi phát. | `lib/ugc/limits.ts:30` | Anh |

**A4 — Listening: KHÔNG XỬ LÝ TRONG ĐỢT NÀY.** Xem mục Lưu ý.

### Nhóm B — Luật chấm điểm không khớp đề nguyên bản

Ảnh hưởng: **cả 10 môn**. Đây là tầng khác hẳn Nhóm A — sửa kiểu dữ liệu không
chạm tới được.

| # | Lỗi | Nơi | Môn |
|---|-----|-----|-----|
| B1 | **Không có khái niệm "câu này đáng mấy điểm".** Điểm tính bằng tỉ lệ `đúng/tổng × 10`, mọi câu cân bằng nhau. Đề Văn thật là 3đ Đọc hiểu + 7đ Làm văn; bài NLVH 5 điểm và bài NLXH 2 điểm hiện được đếm ngang nhau. | `lib/scoring/computeScore.ts` | Văn (nặng), Anh đề trường |
| B2 | **PHẦN II đúng/sai chấm nhị phân cả câu.** Quy chế 2025 chấm theo bậc: đúng 1 ý = 0.1đ, 2 ý = 0.25đ, 3 ý = 0.5đ, 4 ý = 1.0đ. Code dùng `.every()` — sai một ý là mất trắng cả câu. Học sinh đúng 3/4 ý đáng 0.5đ, hệ thống cho **0**. Đã grep cả `lib/scoring/` — không có logic điểm thành phần ở đâu. | `lib/scoring/computeScore.ts:99-110` | Toán, Lý, Hóa, Sinh, Sử, Địa, GDCD, Tin |
| B3 | **Điểm tự luận không vào ô điểm lớn.** Tự luận CÓ được chấm (Groq, ADR-0018) nhưng đi đường riêng: `computeScore.ts:19` ghi rõ *"Dòng CỐ Ý ở lại `scored: false` để nó không vào mẫu số điểm"*, và mỗi câu tự luận tối đa đúng **1 điểm** (`essayLifecycle.ts:67`), cộng thành cặp `earned/max` tách rời. `EssayScoreLine.tsx:22` thừa nhận: *"một lượt thi toàn tự luận hiện `total_score = 0.00`"*. | `computeScore.ts`, `essayLifecycle.ts` | Văn |

#### Ví dụ B1+B3 — con số sai cụ thể

Đề Ngữ văn 10 điểm: Đọc hiểu 4 câu trắc nghiệm (3.0đ) + NLXH (2.0đ) + NLVH (5.0đ).
Học sinh giỏi đọc hiểu, yếu viết: đúng cả 4 câu trắc nghiệm, hai bài văn đều band `0.25`.

- **Điểm thật theo đề:** 3.0 + (2.0 × 0.25) + (5.0 × 0.25) = **4.75/10**
- **Website hiện hiển thị:** ô lớn `10.0/10` (vì 4/4 câu chấm tự động đều đúng,
  hai bài văn không nằm trong mẫu số) + ô nhỏ `0.5 / 2 điểm`

Học sinh nhìn thấy **10.0/10** trên bài đáng 4.75/10.

---

## GIẢI PHÁP ĐÃ CHỐT

### G1 — Chống nhảy số bằng cách hoãn hiện, không bằng cách đóng băng

Vấn đề: band tự luận đáp xuống vài phút sau khi học sinh đã mở trang. Thiết kế
hiện tại giải quyết bằng cách đóng băng ô lớn (`ScoreCard` được đánh dấu
*"VÙNG 0-DIFF — bất kỳ diff nào trong file đó là hồi quy"*), nhưng cái giá là ô
lớn **nói sai sự thật** chứ không phải nói thiếu.

**Chốt:** không hiện con số nào cho tới khi chấm xong. Ô lớn đi từ "đang chấm…"
thẳng sang điểm cuối — từ *chưa có* sang *final*, không có bước nhảy để nhìn thấy.
`EssayGradingPoller` đã có sẵn hạ tầng `router.refresh()`.

**Đánh đổi đã chấp nhận:** đề có tự luận thì học sinh không thấy điểm ngay khi
nộp. Đề thuần trắc nghiệm không đổi gì.

### G2 — Backfill toàn bộ sang luật mới cho đồng bộ

`computeScore()` được gọi **đúng một chỗ** — `app/(layer2)/actions.ts:162`, lúc
nộp bài. Không nơi nào tính lại; mọi chỗ khác chỉ ĐỌC `exam_results.total_score`
(lịch sử làm bài `(HM)/queries.ts:94`, xếp hạng đề gợi ý `rankExams.ts:73`,
analytics). Nên kết quả cũ đóng băng vĩnh viễn ở thang luật cũ.

**Chốt:** tính lại toàn bộ theo luật mới, backfill một lượt. Khả thi vì
`per_question` đã lưu đủ lựa chọn của học sinh từng câu — không cần lượt thi gốc.

**Đánh đổi đã chấp nhận:** điểm cũ hiển thị cho học sinh sẽ thay đổi so với trước.
Đây là cái giá của "đồng bộ", user đã cân nhắc và chọn.

**Lý do không chọn phương án kia:** để nguyên thì hai thang điểm sống chung trong
một cột — lượt thi hôm qua chấm theo tỉ lệ, lượt thi ngày mai trên CÙNG một đề
chấm theo trọng số, cùng đổ vào một biểu đồ, không gì đánh dấu số nào thuộc luật nào.

### G3 — Gộp B1 + B2 + B3 làm MỘT đợt, backfill MỘT lần

Ba lỗi Nhóm B rơi vào cùng chỗ trong code (`computeScore()` và cách
`exam_results.total_score` hình thành). Làm lẻ từng cái = đi qua cùng bộ file
nhiều lần, và mỗi lần lại backfill thêm một lượt → **học sinh thấy điểm mình đổi
nhiều lần**. Không chấp nhận được.

### G4 — Trần ký tự theo môn (A6, A7)

Đã dựng thử phương án "override theo môn" rồi **hoàn tác** trong phiên bàn
(không còn dấu vết trong cây làm việc). Ghi lại để khỏi dò lại:

```ts
// lib/ugc/limits.ts
MAX_STEM: 2000,
MAX_STEM_BY_SUBJECT: { English: 8000 },
// maxStemFor(subject) => MAX_STEM_BY_SUBJECT[subject] ?? MAX_STEM
```

Điểm chạm: `limits.ts`, phép so sánh duy nhất ở `assembleExam.ts:169`, và
`maxLength` của textarea ở `QuestionEditor.tsx:175`.

**Quan trọng:** ở `QuestionEditor` phải dắt `subject` từ `ReviewScreen` →
`AssembledQuestionList` → `QuestionEditor`, **không dùng `q.topic`** — `topic`
là bản chụp môn học lúc assemble, không theo kịp khi tác giả đổi dropdown môn
ngay tại màn review.

Hai tình huống biên đã biết: (1) chế độ Automatic `subject` có thể là sentinel
`""` (ADR-0007) → dùng trần mặc định cho tới khi tác giả chọn môn; (2) đổi đề từ
English sang môn khác có thể làm câu đang hợp lệ bỗng lỗi lại.

**Vẫn CHƯA chốt:** override theo môn (G4) hay nâng trần toàn cục cho mọi môn.
Xem mục Quyết định còn mở.

---

## LƯU Ý

1. **KHÔNG đụng phần Listening của Tiếng Anh.** Hệ thống hiện không có audio ở
   bất kỳ đâu (đã grep toàn repo, sạch) — câu "Listen to part of a news report"
   trên web là câu vĩnh viễn không trả lời được. Đây không phải chuyện nới ràng
   buộc mà là tính năng thiếu hẳn: cần upload audio, lưu trữ, player, đồng bộ
   với câu hỏi. **Là quyết định sản phẩm, user sẽ bàn riêng.** Đừng tự ý mở
   phạm vi sang đây.

2. **Phiên bàn không sửa gì.** Mọi thay đổi thử nghiệm đã hoàn tác. Trước khi
   bắt đầu, `git status` để xác nhận — cây làm việc có sẵn thay đổi CHƯA COMMIT
   của user (snapshot test `RichText.regression.test.tsx.snap`), đừng revert nhầm.

3. **DB không phải thủ phạm ở Nhóm A.** Bảng `questions` đã khá mở:
   `correct_answer` đã `drop not null` (`schema.sql:423`), `question_type` nhận
   đủ 4 giá trị, có sẵn `sub_answers` jsonb. Sự cứng nhắc nằm ở tầng app. Đừng
   migrate thứ không cần migrate.

4. **`questions.content` KHÔNG có ràng buộc độ dài trong Postgres** — chỉ là
   `text not null` (`schema.sql:70`). Khác `attempt_answers.answer` vốn có
   `length(answer) <= 4000` và bị `npm run verify:schema` canh. Nên A7 không cần
   migration, không cần đụng cổng verify.

5. **Copy lỗi đã nhận tham số `{max}`** (`ugcError.stemTooLong` ở cả `en.ts` và
   `vi.ts`) — đổi số truyền vào là câu chữ song ngữ tự đúng, không phải sửa dịch.

6. **`ScoreCard` là chỗ đắt nhất của Nhóm B.** File đang được đánh dấu *"VÙNG
   0-DIFF: bất kỳ diff nào trong file đó là hồi quy"*, ràng bởi **AC-057**
   (`sai = tổng − đúng` phải suy được) và **AC-012** (dòng ghi cũ giữ nguyên
   từng byte). Sửa nó = phải đàm phán lại hai AC đó một cách tường minh, không
   sửa lén được.

7. **Cờ `ESSAY_GRADING_ENABLED` mặc định TẮT**, và chỉ `"true"` chữ thường mới
   bật (`lib/env/checkEnv.ts:278`). Kiểm cờ trước khi kết luận "tự luận không
   được chấm".

8. **Những thứ đã soát và LOẠI TRỪ** — đừng điều tra lại:
   - Dấu phẩy thập phân `"1,04"` vs `"1.04"` ở PHẦN III: đã xử lý đúng
     (`computeScore.ts:78`)
   - Câu dẫn chung + 4 ý a–d của PHẦN II: đây chính là thứ `true_false` sinh ra
     để đựng, khớp tốt
   - Hình dùng chung nhiều câu: mỗi câu crop bản riêng — tốn kém chứ không sai

9. **Ghi tiến độ vào Notion database MS-MOLAR**
   (`3b378ba6-ae12-803c-8500-c572b6fc745f`) qua Composio MCP, không đổ thêm vào
   file lịch sử trong repo. Thân page ghi **số đo và lý do**. Bọc identifier
   `snake_case` trong backtick, nếu không Notion sẽ in nghiêng và làm hỏng tên hằng.

---

## QUYẾT ĐỊNH CÒN MỞ - hỏi user

1. **A7/A6 — trần ký tự: override theo môn hay nâng toàn cục?**
   Khuyến nghị của phiên bàn: override theo môn (G4). Lý do cân nhắc phương án
   toàn cục: trần 2000 không bảo vệ DB (không có CHECK) cũng không phải giới hạn
   token (`extractQuestions` chạy `maxOutputTokens: 65536`) — nó chỉ chặn AI
   phiên âm lỗi tràn lan, nên một số cao hơn cho mọi môn cũng hợp lý và tránh
   được hai tình huống biên ở G4.

2. **B2 — xác nhận thang điểm bậc PHẦN II.** Con số 0.1 / 0.25 / 0.5 / 1.0 là
   theo quy chế Bộ GD&ĐT 2025 do phía Claude nêu, **user cầm đề thật cần xác
   nhận lại** trước khi đóng cứng vào code.

3. **B1 — `points` đến từ đâu?** AI đọc "(2,0 điểm)" in trên đề, hay tác giả
   nhập tay ở màn review, hay cả hai (AI đọc rồi tác giả sửa)? Ảnh hưởng tới
   việc có phải sửa `extractQuestions.ts` + schema trích xuất hay không.

4. **B1 — quy tắc mặc định cho câu hỏi cũ.** Đề xuất `points = 1` cho mọi dòng
   sẵn có: khi đó với đề thuần trắc nghiệm, tổng có trọng số **rút gọn về đúng
   công thức hiện tại**, số cũ và số mới trùng khít. Codebase đã dùng đúng lối
   lập luận này hai lần (`schema.sql:490-492`: `question_type` mặc định `'mcq'`,
   `part_number` mặc định `1`, kèm ghi chú *"row cũ tự đúng, không cần backfill"*).
   Nhưng nó **không cứu được đề hỗn hợp có tự luận**, vì bản thân việc câu tự
   luận có mặt trong mẫu số hay không mới là thứ thay đổi — và đó chính là lý do
   G2 chọn backfill toàn bộ.

5. **Nhóm A hay Nhóm B trước?** Chưa chốt thứ tự giữa hai nhóm.

---

## BẢN ĐỒ FILE

**Nhóm A — cấu trúc**
- `lib/ugc/types.ts` — `AssembledQuestion`, `ExtractedQuestion`, `UgcErrorParams`
- `lib/ugc/limits.ts` — `MAX_STEM`, `MAX_ESSAY_ANSWER`, `MIN_SUB_ITEMS`
- `lib/ugc/assembleExam.ts` — `hasValidChoiceSet:47`, `hasValidSubItemSet:56`,
  `validateAssembledExam:150`, so sánh stem `:169`
- `lib/ugc/extractQuestions.ts` — `QUESTIONS_SCHEMA:44`, `PROMPT:135`,
  `mapQuestionsPayload:196`
- `lib/ugc/extractAnswers.ts` — `PROMPT:93`
- `lib/ugc/errorCopy.ts` — `message():36`, `formatUgcError():131`
- `app/(layer4)/_components/QuestionEditor.tsx` — stem `:175`, true_false `:270`
- `app/(layer4)/_components/AssembledQuestionList.tsx` — hai call site QuestionEditor
- `app/(layer4)/_components/ReviewScreen.tsx` — `:134` validate live, `:268` list
- `app/(layer4)/actions.ts` — `:581` upload, `:856` gate lưu, `:999` gate publish
- `types/question.ts` — contract runtime
- `supabase/schema.sql` — `questions:68`, `questions_type_check:463`

**Nhóm B — chấm điểm**
- `lib/scoring/computeScore.ts` — `isScored:45`, `isTrueFalseCorrect:99`,
  nhánh chấm `:147`, chia thang 10 `:176`
- `lib/scoring/essayLifecycle.ts` — `ESSAY_BANDS:63`, `ESSAY_MAX_POINTS:67`,
  tổng hợp `:264`
- `lib/scoring/wrongTwice.ts`
- `app/(layer2)/actions.ts:162` — call site DUY NHẤT của `computeScore()`
- `app/(layer2)/_components/EssayScoreLine.tsx`, `EssayGradingPoller.tsx`
- `app/(layer2)/exams/[id]/attempt/[attemptId]/result/page.tsx` + `result/detail/page.tsx`
- `lib/supabase/service-role.ts:67` — `p_total_score`
- `supabase/schema.sql` — `exam_results:129`, `record_essay_grade():1130`
  (**hiện chỉ update `per_question` ở `:1169`, KHÔNG đụng `total_score`** — đây
  là mấu chốt khiến điểm tự luận không bao giờ vào ô lớn)
- Đọc `total_score`: `app/(HM)/queries.ts:94`, `app/(layer2)/queries.ts:370`,
  `lib/adaptive/rankExams.ts:73`

**Test/cổng phải chạy**
- `lib/ugc/__tests__/assembleExam.test.ts:194` — biên `MAX_STEM` pass/+1 fail
- `lib/ugc/__tests__/validateInput.test.ts`
- `lib/scoring/__tests__/computeScore.test.ts`
- `app/(layer2)/_components/__tests__/EssayGradingPoller.test.tsx`
- `npm run verify:schema` — ghim trần DB thật với hằng trong mã
- Cổng project đầy đủ (typecheck/lint/test/build) TRƯỚC khi commit
