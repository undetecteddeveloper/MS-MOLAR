# Mission brief — Kho đề theo kệ: Cần luyện / Nổi nhất / Khám phá

Ngày chốt: 2026-09-17. Nhánh làm việc: worktree `worktree-parallel-work` (push lên `feat/exam-shelves`).
Canvas đã duyệt (bản 2): https://claude.ai/artifact/Qw1XnEUYFGnMYEntgFHQxH — hướng A "Kệ cuộn ngang".

## 1. Mục tiêu

Trang `/exams` hôm nay là một lưới phẳng của mọi đề. Thay bằng ba kệ cuộn ngang, mỗi kệ một mục đích,
để học sinh mở trang là thấy ngay việc nên làm, theo cách YouTube/Roblox bày nội dung.
Số đo thành công: **tỉ lệ lượt làm bài bắt đầu từ kệ "Các môn cần luyện"** tăng (đo qua tham số nguồn
trên link thẻ, ví dụ `?from=practice`, ghi vào `exam_attempts` hoặc telemetry hiện có — Design Doc quyết).

## 2. Quyết định sản phẩm đã khoá (không hỏi lại)

| # | Quyết định |
|---|---|
| P1 | `/exams` có đủ ba kệ theo thứ tự **Cần luyện → Nổi nhất → Khám phá**. Nếu Cần luyện không có (chưa có lượt nộp nào) thì kệ ẩn hẳn và Nổi nhất lên đầu. |
| P2 | Bất kỳ tham số `q` / bộ lọc / `sort` / `page` nào trên URL → **ba kệ ẩn**, trang hiện đúng lưới phẳng + phân trang như hôm nay. Ô tìm, hàng chip lọc, phân trang, `ExamPagination` không đổi. |
| P3 | **Cần luyện** = thẻ đề (ExamCard) của môn học sinh có điểm trung bình thấp nhất, tái dùng tín hiệu `buildSubjectWeakness` trong `SOURCE/lib/adaptive/rankExams.ts` (đã ship, hiện chỉ là một số hạng ẩn trong affinity). Phụ đề kệ nêu lý do: "Hoá đang là môn điểm trung bình thấp nhất của bạn". |
| P4 | **Nổi nhất** = đề có **nhiều lượt làm gần đây nhất** (cửa sổ thời gian do Design Doc chọn, đề xuất 7 ngày, thiếu dữ liệu thì nới 30 ngày), **trong khối lớp của học sinh**. Đề đã làm vẫn hiện. Thẻ **hạng 1** mang ruy băng góc "Hot nhất"; các thẻ còn lại không có nhãn. |
| P5 | **Khám phá** = tập chọn lọc cho đa dạng: đề mới đăng, môn/trường học sinh chưa từng làm; loại các đề đã hiện ở hai kệ trên. Cuối kệ có ô "Xem toàn bộ kho đề" dẫn tới lưới phẳng đầy đủ. |
| P6 | Trang chủ: khối cột phải "Đề mới đăng" (`home.newExams`, `app/page.tsx`) đổi **nguồn dữ liệu** thành 3 đề nổi nhất và đổi nhãn thành "Đề nổi nhất"; khung, `layout="stack"`, link "Xem tất cả đề" giữ nguyên. |
| P7 | Bộ icon **giữ Lucide**. Icon kệ: `Target` (Cần luyện), `Flame` (Nổi nhất), `Compass` (Khám phá). |
| P8 | Một đề được phép xuất hiện ở cả Cần luyện lẫn Nổi nhất; Khám phá thì loại trùng (P5). |

## 3. Đặc tả hình ảnh đã duyệt (theo canvas, khớp token `SOURCE/app/globals.css`)

- **Giữ nguyên tuyệt đối**: `SiteHeader`, `HeaderSearch`, `HeaderProfile`, `PageHeader` ("Kho đề"), `ExamFilters` + `Chip`,
  `BottomNav`, `ExamPagination`, `ExamCard` (nhãn môn/lớp, tên đề, `AuthorByline`, phút · câu · trường,
  `DifficultyBadge`, `RateButton` "Đánh giá", viên "Làm đề"). Không xoá, không đổi cỡ bất kỳ phần tử nào.
- **Tiêu đề kệ** (phần tử mới, theo mẫu section header của trang chủ `app/page.tsx:119-130`): icon Lucide 22px
  `text-foreground` + `h2` 20px `font-semibold` + phụ đề 13px `text-muted-foreground`; bên phải link "Xem tất cả"
  kiểu `home.viewAllExams` (`text-primary text-sm font-semibold underline-offset-4 hover:underline`, `min-h-11`).
- **Hàng kệ**: cùng idiom cuộn ngang của hàng chip (`-mx-4 px-4 overflow-x-auto [scrollbar-width:none] sm:-mx-6 sm:px-6`),
  thêm `snap-x snap-mandatory`, `gap-3` (mobile) / `gap-4` (≥1024). Thẻ `snap-start`, bề rộng cố định
  **320px dưới 1024px, 336px từ 1024px** — không hẹp hơn: hàng chân ExamCard cần ~290px lòng thẻ, dưới mức đó tự gãy dòng.
- **Ô "Xem toàn bộ kho đề"** cuối kệ Khám phá: viền nét đứt `border-border` (như `Card variant="outline"`), bo `rounded-card`,
  chữ 14px `font-semibold text-muted-foreground`, icon `Compass` 22px, rộng 150px / 200px.
- **Ruy băng "Hot nhất"** (chỉ thẻ hạng 1 của Nổi nhất): ô góc `absolute top-0 right-0 size-[76px] overflow-hidden
  rounded-tr-card pointer-events-none`; dải `absolute top-4 -right-[30px] w-[124px] rotate-45 text-center` chữ 8.5px
  `font-extrabold uppercase tracking-[.06em]` `bg-sun text-[color:var(--sun-on-solid)] glow-sun`, `py-[3px]`.
  Ruy băng là trang trí (`aria-hidden`); trạng thái "hot nhất" được nói bằng chữ trong phụ đề kệ, không chỉ bằng màu.
  ExamCard nhận một slot/prop tuỳ chọn cho ruy băng; khi không có prop, markup ExamCard **bằng bit** với hôm nay.
- **Không có phần tử mới nào dùng màu vàng ngoài ruy băng** (vàng đã mang nghĩa "vị trí hiện tại" ở BottomNav).
- **Chuyển động**: chỉ dùng từ vựng `.motion-*` / `usePresence` sẵn có; không fade nội dung trang khi tải; không CLS
  (kệ render đủ từ server, không có nội dung nạp muộn chèn vào).
- Tiếng Việt duy nhất; mọi chuỗi mới vào `SOURCE/lib/copy.ts`.

## 4. Sự thật kỹ thuật đã kiểm (để Design Doc không phải tìm lại)

- `SOURCE/app/(exams)/exams/page.tsx` gọi `listExamsRanked(filters, page)` (`features/exams/queries/ranking.ts`) → `rankExamIds`
  với khoá `[band, priorScore, affinity, id]`; affinity = khớp lớp (1.0) + điểm yếu môn (0.5) + mới-cũ (0.25).
  `buildSubjectWeakness` và `buildGradeShares` là hàm **module-private** — cần export hoặc tách helper thuần
  (`lib/adaptive/`, cùng quy ước thuần/tất định/không I/O, test kiểu AC-016).
- `exam_attempts` bị **RLS giới hạn về chính người gọi** (`to authenticated`, quy ước không thêm predicate `user_id`).
  Đếm lượt làm của **mọi** học sinh cho kệ Nổi nhất **không đọc được từ client thường** → cần view/hàm tổng hợp
  DB-side (tiền lệ: view `exams_with_difficulty` của ADR-0008, hàm `security definer`). Đây là **thay đổi schema** →
  đi đúng luồng `schema.sql` → `npm run schema:plan` → hằng fingerprint → file migration → apply dev qua CLI `--file`
  → `verify:schema`; prod kiểm riêng theo Pha 3.5 (so `schema_version.fingerprint` qua Composio trước khi đóng việc).
- ADR-0015 Decision 6: `/exams` có **ngân sách round-trip cấu trúc** khẳng định trong CI — mỗi lượt đọc mới phải được
  cộng vào ngân sách đó có lý do, hoặc gộp vào lượt đọc sẵn có. `Promise.all` cho các lượt đọc song song.
- ADR-0015 kill criterion (a): nếu `listExams` có `.limit()`/`.range()` thì xếp hạng in-process mất hiệu lực — kệ phải
  cắt **sau** khi xếp hạng, không cắt ở DB.
- PRD `docs/prd/exam-recommendation-prd.md` **AC-002 "0 visual change"** và ghi chú "not a widget" (D1) bị thay thế bởi
  mission này cho `/exams`; **AC-016/AC-017** (`?sort` tường minh chạy đúng SQL cũ, các assertion trong
  `features/exams/__tests__/rating.int.test.ts:317-440` giữ **nguyên**) vẫn có hiệu lực. Cần bản sửa đổi PRD (v1.3) ghi rõ
  điều gì thay thế, điều gì giữ.
- `ExamBrowser` có `layout="grid" | "stack"`; trang chủ dùng `stack`. Kệ là một component mới (`ExamShelf`), không nhồi vào `ExamBrowser`.
- Cold start: `buildGradeShares` trả `null` khi chưa có lượt nào → không suy đoán lớp; Nổi nhất khi đó lấy toàn hệ thống.
- Nguồn "khối lớp của học sinh": tỉ trọng lớp của lượt đã nộp (`gradeShareByGrade`), lấy lớp có tỉ trọng cao nhất.

## 5. Ràng buộc quy trình

- Cổng verify 6 trong `SOURCE/`: `npx tsc --noEmit` · `npx eslint --max-warnings 0` · `npx vitest run` · `npm run build` ·
  `npm run test:fixture` · `npm run test:localdb`. Kiểm bằng exit code thật.
- UI audit bằng Playwright CLI (chạy từ trong `SOURCE/`), đo CLS ở 360/768/1024/1280 khi mở trang và khi vuốt kệ.
- Commit theo từng task, không commit lên `main`; deploy preview trước, prod khi engineer bảo.
- Ngoài phạm vi: đổi bộ icon, chế độ sáng, sửa `ExamFilters` ngoài việc thêm giá trị `?sort=` mới nếu Design Doc chọn
  cách đó cho "Xem tất cả" của kệ Nổi nhất (một trục `?sort=` duy nhất theo D002).
