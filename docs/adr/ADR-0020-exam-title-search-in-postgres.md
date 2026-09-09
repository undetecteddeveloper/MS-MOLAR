# ADR-0020 Tìm đề theo tên: chạy trong Postgres bằng `pg_trgm` + `unaccent`, không dùng dịch vụ tìm kiếm ngoài

## Status

**Accepted — 2026-09-08.** Engineer chốt 5 điểm hành vi cùng ngày (gợi ý khi gõ + Enter ra Kho đề đã lọc; nút kính lúp trên điện thoại, ô thường trực từ 1024px; ẩn với khách; khớp không dấu và không phân biệt hoa thường; nhánh `feat/exam-search` tách từ `design/ui-refactor-san-truong`) và yêu cầu chọn hướng "chịu được khi kho đề lớn dần".

- Liên quan: **ADR-0008** (đọc catalog qua view `exams_with_difficulty`), **ADR-0015** (xếp hạng cá nhân hoá — tìm kiếm chỉ HẸP tập ứng viên, không đổi thứ tự), TD-005 (schema.sql + vân tay), TD-026 (phân trang trên cửa sổ xếp hạng).
- Schema: `SOURCE/supabase/schema.sql` § "Tìm đề theo tên"; migration `20260908000000_exam_title_search_*.sql`.

## Bối cảnh

Học sinh cần tìm một đề theo tên từ mọi trang (ô tìm trên header). Kho đề hôm nay rất nhỏ (12 đề dev, 6 đề published prod, đo 2026-09-08) nhưng UGC v2 cho mọi người dùng tải đề lên, nên phải chọn hướng không cần làm lại khi có vài nghìn đề. Ba ràng buộc thật:

1. **Tiếng Việt có dấu, người gõ thường không dấu.** "toan 10" phải ra "Toán 10", "Hoa hoc" phải ra "Hóa Học". Bàn phím điện thoại thường tắt Telex.
2. **Kho đề nằm sau đăng nhập** (RLS `exams_select_visible` chỉ cho `authenticated`). Mọi đường tìm kiếm phải đi qua cùng RLS đó — một chỉ mục ngoài Postgres là một bản sao dữ liệu nằm ngoài tầm RLS.
3. **Tên đề ngắn** (dưới ~80 ký tự, vài chục âm tiết). Không có "tài liệu dài" để xếp hạng theo tần suất từ; thứ cần là khớp chuỗi con, khớp đầu từ và chịu lỗi gõ.

## Các hướng đã cân nhắc (nghiên cứu 2026-09-08)

| Hướng | Hợp với 1–3? | Vì sao không chọn / chọn |
|---|---|---|
| **Postgres FTS** (`tsvector` + GIN, `textSearch()` của supabase-js — [Supabase: Full Text Search](https://supabase.com/docs/guides/database/full-text-search)) | Một phần | Không có từ điển stem tiếng Việt, chỉ dùng được cấu hình `simple`; khớp theo TỪ nguyên vẹn (cần `:*` cho tiền tố), không chịu lỗi gõ; thế mạnh (stem, `ts_rank` trên văn bản dài) không dùng tới với tên đề ngắn. |
| **PGroonga** ([Supabase: PGroonga](https://supabase.com/docs/guides/database/extensions/pgroonga), [pgroonga.github.io](https://pgroonga.github.io/)) | Có | Có sẵn trên cả hai project (3.2.5). Mạnh cho CJK và n-gram mọi ngôn ngữ, nhưng là một kiểu chỉ mục riêng với normalizer riêng; bỏ dấu tiếng Việt trong normalizer NFKC của Groonga không có tài liệu rõ; đội chưa quen. Chi phí học và vận hành không đổi lấy được gì với tên đề ngắn. Để dành nếu có ngày tìm trong NỘI DUNG câu hỏi. |
| **`pg_trgm` + `unaccent`** ([PostgreSQL: pg_trgm](https://www.postgresql.org/docs/current/pgtrgm.html), [PostgreSQL: unaccent](https://www.postgresql.org/docs/current/unaccent.html)) | **Có — chọn** | Cả hai có sẵn trên dev lẫn prod (1.6 / 1.1). Trigram trên chuỗi đã bỏ dấu cho đúng ba thứ cần: chuỗi con (`ILIKE`, chỉ mục GIN `gin_trgm_ops` tăng tốc), đầu từ, và chịu lỗi gõ (`word_similarity`, toán tử `<%`). `unaccent.rules` mặc định có các chữ Việt nhiều dấu từ PostgreSQL 10 ([commit "Extend the default rules file for contrib/unaccent with Vietnamese characters"](https://www.postgresql.org/message-id/E1di5IH-0002ii-Pa%40gemulon.postgresql.org)); `đ` được đổi tường minh trong hàm chuẩn hoá để không phụ thuộc bảng quy tắc. Chỉ mục GIN trigram phục vụ tốt tới hàng trăm nghìn dòng — xa hơn mọi dự phóng của kho đề. |
| **Dịch vụ ngoài** — Algolia, Meilisearch, Typesense ([so sánh 2026](https://www.meilisearch.com/blog/algolia-vs-typesense), [bảng giá 06/2026](https://www.buildmvpfast.com/api-costs/search)) | Không | Chịu lỗi gõ và tốc độ rất tốt, nhưng thêm một hệ thống phải đồng bộ (ETL từ Postgres, xoá đề phải xoá khỏi chỉ mục), một bản sao dữ liệu ngoài RLS, và chi phí/hạ tầng riêng (Algolia miễn phí 10k tìm/tháng rồi trả theo lượt; Typesense Cloud từ $29.99/tháng; Meilisearch tự host cần máy chủ). Đổi lấy tính năng mà Postgres đã làm được cho cỡ kho này. Xem lại khi kho vượt ~50k đề hoặc tìm kiếm mở rộng sang nội dung câu hỏi. |
| **Tìm ngữ nghĩa** (`pgvector`, hybrid — [Supabase: Hybrid search](https://supabase.com/docs/guides/ai/hybrid-search)) | Không | Cần embedding cho từng đề (một nhà cung cấp AI nữa, hạn ngạch, chi phí) để trả lời một câu hỏi người dùng không hỏi: họ gõ TÊN đề, không mô tả ý. |

## Quyết định

1. **Một hàm chuẩn hoá duy nhất, `public.search_normalize(text)`**, `immutable`: `lower` → `unaccent` (từ điển gọi ĐÍCH DANH `extensions.unaccent`, nên kết quả không đổi theo `search_path` — điều kiện để khai `immutable` an toàn) → `đ/Đ` → `d/D` → mọi ký tự không phải chữ/số thành dấu cách → gộp khoảng trắng. **Bản JS `normalizeSearch()` (`lib/search/normalize.ts`) làm đúng cùng các bước** để bộ lọc `ILIKE` của Kho đề gửi đúng chuỗi mà cột chuẩn hoá lưu; làn localdb có ca so hai bản trên cùng một chuỗi tiếng Việt.
2. **Cột sinh `exams.title_search`** = `search_normalize(title)`, `stored`, chỉ mục `gin (title_search extensions.gin_trgm_ops)`. Cột sinh chứ không phải trigger: không có đường ghi nào quên được nó.
3. **View `exams_with_difficulty` dựng lại** để phơi `title_search` (view `e.*` đóng băng cột lúc tạo — cùng lý do migration 2026-09-01). Bộ lọc Kho đề (`?q=`) là một vị từ `ILIKE '%term%'` trên cột này, chạy DB-side TRƯỚC xếp hạng — tìm kiếm chỉ hẹp tập ứng viên, ADR-0015 giữ nguyên; và vì lọc ở DB nên đúng cả khi kho vượt cửa sổ 500 dòng của `readBounded`.
4. **RPC `public.search_exams(q, max_results)`** cho gợi ý khi gõ: `security invoker` (RLS của `exams` áp lên người gọi — khách không thấy gì), `stable`, trả `id, title, subject, grade` của đề `published`, điều kiện `LIKE '%term%'` HOẶC `term <% title_search` (word_similarity, chịu lỗi gõ), xếp: bắt đầu bằng từ khoá → đầu một từ → chứa từ khoá → `word_similarity` giảm dần → mới nhất; tối đa 20. `revoke` khỏi `anon`, `grant execute` cho `authenticated` và `service_role`.
5. **Đường gọi**: `GET /api/exams/search?q=` (đăng nhập bắt buộc, rate limit `searchExams` nhóm tốn-DB, 120 lượt/phút/người) → `searchExamTitles()` → RPC. Kho đề đọc `?q=` qua `fetchExamRows` như mọi bộ lọc khác.

## Hệ quả

- **Phải áp lên CẢ dev lẫn prod** (TD-005, đã nổ bốn lần): migration đổi vân tay schema; `verify:schema` thêm probe `search_exams` (authenticated gọi được, anon bị 42501). Chừng nào prod chưa áp, deploy production sẽ kêu ở `instrumentation.ts` (lệch vân tay) và ô tìm trả lỗi — không âm thầm.
- Đổi cách chuẩn hoá về sau = **dựng lại cột sinh** (drop/add `title_search`) chứ không chỉ sửa hàm; JS phải đổi cùng lúc. Ca localdb so JS–SQL là cổng bắt lệch.
- Trigram không hiểu ngữ nghĩa: "giữa kì" và "giữa học kì" là hai chuỗi khác nhau, chỉ khớp qua chuỗi con. Chấp nhận cho tên đề.
- Kho đề vẫn đọc trọn tập ứng viên trong biên `LIST_ROW_CEILING` rồi xếp hạng ở JS (ADR-0015/TD-026); tìm kiếm không đổi điều đó, chỉ làm tập ấy nhỏ đi.
