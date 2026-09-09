# Design — Tìm đề theo tên trên header

**Ngày:** 2026-09-08 · **Nhánh:** `feat/exam-search` (tách từ `design/ui-refactor-san-truong`) · **ADR:** [ADR-0020](../adr/ADR-0020-exam-title-search-in-postgres.md) · **Row Notion:** "Tìm đề theo tên trên header"
**Trạng thái:** đang thực hiện.

## 1. Yêu cầu (engineer chốt 2026-09-08)

Thanh tìm kiếm ở khu header (logo + tài khoản, cạnh trên trên điện thoại), tìm đề theo TÊN, có chức năng đầy đủ. Năm điểm đã chốt:

1. Gõ là hiện gợi ý (tối đa 6 tên đề, bấm là tới đề); Enter mở Kho đề đã lọc theo tên, có chip "Tìm: …" và nút bỏ.
2. Dưới 1024px: nút kính lúp cạnh ô tài khoản, bấm thì ô tìm phủ trọn hàng header, tự lấy tiêu điểm. Từ 1024px: ô thường trực giữa dãy liên kết và tài khoản.
3. Khách chưa đăng nhập: không hiện ô tìm (kho đề nằm sau RLS `to authenticated`).
4. Khớp không dấu, không phân biệt hoa thường; engineer yêu cầu chọn search engine chịu được khi kho đề lớn dần → ADR-0020 (`pg_trgm` + `unaccent` trong Postgres).
5. Nhánh riêng, tách từ nhánh refactor vì header mới nằm ở đó.

## 2. Đường dữ liệu

```
HeaderSearch (client)  ──debounce 250ms──▶ GET /api/exams/search?q=   ──▶ searchExamTitles()  ──▶ rpc search_exams (SECURITY INVOKER, RLS)
        │ Enter / "Xem tất cả"                                                                     └─ exams.title_search (cột sinh) + GIN trigram
        └────────────────────────────────▶ /exams?q=…  ──▶ listExamsRanked({ q })  ──▶ fetchExamRows: .ilike("title_search", "%term%") ──▶ xếp hạng (ADR-0015) ──▶ cắt trang
```

- **Một phép chuẩn hoá, hai bản**: `public.search_normalize(text)` (SQL, immutable) và `normalizeSearch()` (`lib/search/normalize.ts`). Thường hoá → bỏ dấu → đ→d → mọi ký tự không phải chữ/số thành dấu cách → gộp. Chuỗi ra chỉ còn `[a-z0-9 ]`, nên không có ký tự đặc biệt nào của LIKE hay của bộ lọc PostgREST lọt vào mẫu. Làn localdb so hai bản trên cùng chuỗi tiếng Việt.
- **Kho đề lọc DB-side trước xếp hạng**: `?q=` chỉ hẹp tập ứng viên, thứ tự vẫn do ADR-0015; đúng cả khi kho vượt cửa sổ 500 dòng của `readBounded`.
- **API**: 401 với khách; từ khoá dưới 2 ký tự sau chuẩn hoá → `[]` mà không chạm rate limit lẫn DB; rate limit `searchExams` 120/phút/người (nhóm tốn-DB); RPC hỏng → 500 với mã lý do, ô tìm vẫn cho Enter ra Kho đề.
- **Migration** `20260908000000_exam_title_search_eab3b6e1534a.sql`: 2 extension, hàm chuẩn hoá, cột sinh `exams.title_search`, chỉ mục GIN trigram, dựng lại view `exams_with_difficulty` (`e.*` đóng băng lúc tạo), RPC `search_exams` + grant. Áp lên dev 2026-09-08 và tự kiểm bằng truy vấn thật; **prod chưa áp** — phải áp (so vân tay `4ecb67741520` → `eab3b6e1534a`) trước khi deploy nhánh này.

## 3. Giao diện

- **HeaderSearch** (`components/layout/HeaderSearch.tsx`, client, chỉ render khi đã đăng nhập). Một trạng thái, hai hình dạng:
  - ≥1024px: ô viên thuốc nền surface cao 40px, kính lúp trái, nút xoá phải, `w-44` (`w-56` từ 1280px). Bảng gợi ý thả xuống dưới ô, rộng 20rem, cùng lớp vỏ popover với menu tài khoản (trắng, viền mảnh, bo 14px).
  - <1024px: nút kính lúp 44px (`ghost`, icon). Bấm → thanh phủ `absolute inset-0` trên hàng header (nút đóng + ô nhập trải hết bề ngang, tự lấy tiêu điểm); bảng gợi ý trải hết bề ngang dưới header. Thanh phủ neo vào khung header (`relative`) chứ không vào `<nav>` để phủ cả logo.
  - Tên tài khoản (HeaderProfile) nay chỉ hiện từ 1024px (trước: từ 768px): ở 768px nút kính lúp chiếm đúng phần dư của hàng và tên co còn "A…" (đo 2026-09-08: ô tài khoản 93px); avatar vẫn định danh.
- **Bảng gợi ý**: mỗi dòng = tên đề (một dòng, cắt "…") + "Toán, lớp 10"; dòng cuối luôn là "Xem tất cả kết quả cho “q”" (lối ra không phụ thuộc RPC). Đang tìm / lỗi / không có kết quả là ba câu nhỏ phía trên danh sách.
- **Trợ năng**: combobox ARIA 1.2 (`role="combobox"`, `aria-expanded`, `aria-controls`, `aria-activedescendant`), `role="listbox"/"option"`, mũi tên lên/xuống (vòng), Enter mở dòng đang chọn hoặc Kho đề, Escape đóng thứ đang nhìn thấy (danh sách trước, thanh phủ sau), vùng `aria-live` đọc số gợi ý. Chỉ MỘT bảng gợi ý trong DOM tại một thời điểm (bảng của thanh phủ thay bảng của ô thường trực khi thanh phủ mở) — không trùng id.
- **Kho đề**: chip "Tìm: “q”" đứng đầu hàng chip, bấm là bỏ đúng từ khoá; "Xoá lọc" xoá cả từ khoá; trạng thái rỗng nhắc lại từ khoá ("Không tìm thấy đề nào cho “q”"). Ô tìm trên header đồng bộ với `?q=` khi đang ở /exams.
- **Trạng thái suy ra, không đặt trong effect**: `hits`/`loading`/`failed` suy từ (từ khoá hiện tại, kết quả cuối cùng); effect chỉ lên lịch fetch và huỷ (`AbortController`). Kết quả chỉ hiện khi thuộc đúng từ khoá đang gõ — gõ nhanh không thấy danh sách cũ nhảy lên sau.

## 4. Kiểm thử

| Làn | File | Chứng minh |
|---|---|---|
| vitest | `lib/search/__tests__/normalize.test.ts` | chuẩn hoá chữ Việt hai dấu, đ, NFC/NFD, ký tự đặc biệt, trần độ dài |
| vitest | `features/exams/__tests__/rating.int.test.ts` (describe mới) | `q` → đúng một `.ilike("title_search", "%term%")`, rỗng/ngắn → không có |
| vitest | `app/api/exams/search/__tests__/route.test.ts` | thứ tự chi phí: 401 → [] → 429 (Retry-After) → 500 mã lý do |
| vitest (jsdom) | `components/layout/__tests__/HeaderSearch.test.tsx` | combobox: gọi API sau debounce với từ khoá chuẩn hoá, mũi tên + Enter, bấm dòng, Escape, lỗi, rỗng, đồng bộ `?q=`, thanh phủ điện thoại |
| vitest | `lib/security/rateLimit.test.ts`, `lib/schema/__tests__/*` | `searchExams` xếp nhóm tốn-DB; vân tay + migration ↔ schema.sql (ngoại lệ mới: câu ghi vân tay phải khớp tên file của chính nó) |
| localdb | `tests/e2e/service/exam-search.service.e2e.test.ts` | SQL ≡ JS trên chuỗi Việt; khớp không dấu/hoa thường/lỗi gõ; chỉ đề published; anon 42501; view có cột `title_search` |
| verify:schema | `supabase/verify-schema.ts` | `search_exams`: authenticated gọi được, anon 42501; vân tay DB = git |

## 5. Số đo (dev, Playwright, 2026-09-08)

| Bề rộng | Header | Ghi chú |
|---|---|---|
| 360 | không tràn ngang; nút kính lúp 44px; ô tài khoản 68px (avatar) | thanh phủ + bảng gợi ý trải hết bề ngang, 7 dòng cho "hoa hoc" (6 gợi ý + xem tất cả) |
| 768 | không tràn ngang; ô tài khoản 68px | tên tài khoản ẩn ở dải này (trước khi ẩn: 93px, tên bị cắt "A…") |
| 1024 | không tràn ngang; ô tìm 176px; tên "AnhPhat" đủ chỗ (135px) | |
| 1280 | ô tìm 224px, còn 24px dư cạnh tài khoản | |

CLS (PerformanceObserver, chỉ tính dịch chuyển KHÔNG trong cửa sổ 500ms sau thao tác) ở 360/768/1024/1280, sau hai lần sửa:

| Thao tác | Trước | Sau |
|---|---|---|
| Tải /exams | 0 (768: 0,0018) | 0 |
| Mở ô tìm | 0 | 0 |
| Gợi ý về | 0,012 / 0,008 / 0,003 / 0,002 (dòng "Xem tất cả" bị đẩy xuống) | 0 (danh sách trống khi đang tìm, hiện trọn một lần) |
| Enter → Kho đề `?q=` | 0,49 / 0,29 / 0,19 / 0,13 (thẻ đề và chip cũ dịch chỗ sau round-trip) | 0 (`key` lưới đề theo bộ lọc + trang, `key` hàng chip theo từ khoá) |
| Bỏ chip từ khoá | — | 0 |

Hai chỗ sửa cuối là cùng bệnh với danh sách Lịch sử (design doc refactor §3): điều hướng bằng `router.push` trả nội dung sau cửa sổ 500ms nên phần tử cũ dời chỗ bị tính là dịch chuyển; coi kết quả mới là cây mới thì không còn gì "dời".

Cơ sở dữ liệu (dev, sau migration): `search_normalize('Đề KIỂM TRA Hóa Học lớp 10 — Ứng dụng: ấ ế ộ ơ ư ữ')` = `de kiem tra hoa hoc lop 10 ung dung a e o o u u`; `search_exams('nguyen han')` trả "Đề nguyên hàm (sai)" đầu tiên (lỗi gõ); `search_exams('Toán')` trả hai đề Toán; `verify:schema` xanh với vân tay `eab3b6e1534a` và hai probe `search_exams` (authenticated gọi được, anon 42501).
