# MS-MOLAR — luật làm việc

> NƠI DUY NHẤT chứa luật chung. Luật theo loại việc: `.claude/workflow/`. Tiến độ: `PROGRESS.md`.
> Sửa luật = sửa TẠI CHỖ nó thuộc về (xem §7), không tạo file mới.

## 1. Vai trò và cách nói chuyện
- Người dùng không làm kỹ thuật. Claude tự quyết MỌI việc kỹ thuật, không hỏi.
- Chỉ hỏi khi có ≥2 hướng SẢN PHẨM/thiết kế khác nhau: dùng AskUserQuestion, tối đa 4 câu/vòng, mỗi câu 2–4 lựa chọn viết bằng kết quả người dùng nhìn thấy được.
- Báo cáo bằng tiếng Việt thường: câu đầu nói chuyện gì xảy ra, rồi một con số để cân nhắc, rồi các lựa chọn. Khi người dùng phải làm gì: chỉ nói LÀM GÌ và Ở ĐÂU, không giải thích cơ chế. Chi tiết kỹ thuật để trong commit message hoặc PROGRESS.md.
- Giao diện, commit message, tài liệu, trả lời: tiếng Việt. Giao diện CHỈ tiếng Việt: khoá DB hay chuỗi tiếng Anh lộ ra màn hình là lỗi, sửa mọi nơi hiển thị trường đó trong một commit `fix(...)` riêng, đi qua bảng nhãn dùng chung (vd `subjectLabel()`).

## 2. Đầu phiên (hook SessionStart đã in sẵn dữ liệu; Claude PHẢI làm)
1. Kiểm công cụ chính, báo MỘT dòng `Công cụ: đủ` hoặc `THIẾU: <tên> — <cách khắc phục>`:
   - Composio MCP: ToolSearch "composio" phải thấy `COMPOSIO_SEARCH_TOOLS`.
   - Cổng kiểm tra: `npx tsc --version`, `npx eslint --version`, `npx vitest --version` chạy được trong `SOURCE/` (chỉ kiểm có chạy được, không chạy cả cổng).
   - Playwright CLI: file `SOURCE/scripts/pw/cli.mjs` còn tồn tại.
2. Báo ≤3 dòng việc dang dở lấy từ phần "Đang mở" của PROGRESS.md, hỏi có tiếp không. Không tự nối việc cũ.

## 3. Phân loại — mọi yêu cầu bắt đầu ở đây
Nói MỘT dòng: "Tôi coi đây là <loại>: <việc>". Chắc chắn thì làm; không chắc thì hỏi người dùng một câu. Rồi ĐỌC file đường TRƯỚC khi làm:

| Loại | Dấu hiệu | File |
|---|---|---|
| Việc vặt | sửa nhỏ, hỏi đáp, đọc code, git, sửa tài liệu | `.claude/workflow/small.md` |
| Bug | báo lỗi, "sai", "không chạy" | `.claude/workflow/bug.md` |
| Giao diện | chỉnh hoặc thiết kế lại trang, animation, bố cục | `.claude/workflow/ui.md` |
| Tính năng | thêm chức năng, đổi hành vi sản phẩm | `.claude/workflow/feature.md` |

Chạm DB/schema/migration → đọc thêm `ops-db.md`. Đo hoặc chụp giao diện → `ops-ui.md`. Shell, git, deploy, lỗi Windows → `ops-env.md` (cùng thư mục).

## 4. Công cụ thiếu hoặc lỗi — KHÔNG ĐƯỢC im lặng bỏ qua
- "Chưa thấy" chưa phải "không có": công cụ nạp muộn nằm trong danh sách deferred → ToolSearch `select:<tên>` hoặc từ khoá; thử lại MỘT lần.
- Vẫn hỏng → báo NGAY một dòng cho người dùng, đánh dấu bước đó CHƯA LÀM, rồi làm tiếp phần KHÔNG phụ thuộc vào nó.
- Composio, hoặc một cổng kiểm tra không chạy được → DỪNG phần liên quan: không đọc/ghi prod, không deploy, không commit như thể cổng đã qua.
- Cấm viết "xong / ổn / đã qua" cho bước chưa chạy thật. Một cổng đỏ: chạy lại trên bản sạch để biết do mình hay đỏ sẵn (ops-env.md).
- Dòng ĐẦU của báo cáo cuối việc: `ĐỦ BƯỚC` hoặc `THIẾU n BƯỚC: <bước> — <lý do> — <người dùng cần làm gì>`.

## 5. Điểm dừng bắt buộc
- Hướng sản phẩm/thiết kế có ≥2 phương án → hỏi (§1).
- Việc không hoàn tác (ghi dữ liệu thật trên prod, xoá file, force-push, reset, bỏ thay đổi chưa commit): nói hệ quả bằng lời thường ("sẽ sửa 340 dòng dữ liệu thật, không khôi phục được") rồi hỏi có/không. Trước đó chạy `git status`: cây làm việc thường có thay đổi chưa commit của người dùng, không `checkout --` / `restore` / `reset` / `clean` lên file đã bẩn từ trước.
- Ngoài hai loại trên Claude tự quyết, kể cả thêm thư viện hay đổi kiến trúc.

## 6. Kết thúc việc
1. Cổng kiểm tra, chạy trong `SOURCE/`, xác nhận bằng exit code thật: việc vặt = `npx tsc --noEmit` + vitest của file liên quan. Bug / giao diện / tính năng chạm code app = đủ 6: `npx tsc --noEmit` · `npx eslint --max-warnings 0` · `npm run build` · `npx vitest run` · `npm run test:fixture` · `npm run test:localdb`. Chỉ sửa tài liệu hoặc luật: bỏ cổng.
2. Commit trên nhánh làm việc (không bao giờ commit thẳng `main`), message tiếng Việt dạng `type(scope): ...`, rồi DỪNG.
3. Push, đưa lên main, deploy: chỉ khi người dùng nói (hook chặn `git push` nếu lượt nhắn gần nhất không có ý đó). Cách đưa lên main: ops-env.md.
4. Cập nhật PROGRESS.md: số đo và LÝ DO, không chỉ liệt kê việc.
5. Đối chiếu một lượt với §4 và §5 trước khi báo, rồi viết dòng đầu `ĐỦ BƯỚC` / `THIẾU`.

## 7. Tự học
Người dùng sửa cùng một lỗi lần thứ hai → Claude sửa luật có sẵn ở đúng file (file này, một file đường, hoặc `ops-*`): thay luật cũ cùng chủ đề, không thêm file. Báo một dòng "Đã ghi luật: …". KHÔNG ghi luật hay nhật ký sự kiện vào auto-memory.

## 8. Bản đồ và công cụ
- Tiến độ: `PROGRESS.md` (chỉ việc đang mở và vừa xong, ≤60 dòng, Claude tự cắt mục cũ — lịch sử đã có trong git log). Nợ kỹ thuật: `TECH-DEBT.md` — rất dài, KHÔNG đọc cả file, tra bằng Grep theo mã `TD-xxx` hoặc từ khoá. Quyết định cũ: `docs/` và git log.
- Supabase, Vercel, Drive: qua Composio MCP (`COMPOSIO_SEARCH_TOOLS` → `COMPOSIO_MULTI_EXECUTE_TOOL`). Supabase dev còn có `npx supabase db query --project-ref <dev>` và `npx tsx supabase/*.ts`. KHÔNG gọi CLI `composio` (không chạy trên Windows, hook chặn).
- Trình duyệt: Playwright CLI `node scripts/pw/cli.mjs` (alias `npm run pw` trong `SOURCE/`). KHÔNG dùng Playwright MCP hay Supabase MCP trực tiếp (hook chặn).
- Hai recipe còn lại, do người dùng gõ: `/recipe-fullstack-implement` (feature.md), `/recipe-diagnose` (bug.md).
- Ứng dụng nằm trong `SOURCE/` (Next.js bản mới — đọc `SOURCE/AGENTS.md` trước khi viết code).
