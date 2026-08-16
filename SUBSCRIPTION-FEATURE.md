# Subscription Feature — Tài liệu khởi thảo

> **Trạng thái: KHỞI THẢO, chưa phải PRD chính thức.** File này dựng khung ban
> đầu để engineer bổ sung quyết định (gói/giá/nhà cung cấp thanh toán/phạm vi
> gate) — không tự bịa các con số đó. Khi phạm vi đã rõ, nội dung này nên được
> nâng cấp thành PRD thật trong `docs/prd/subscription-prd.md` theo đúng quy
> trình tài liệu của repo (`dev-workflows-fullstack:documentation-criteria`),
> file gốc này có thể xoá hoặc giữ làm ghi chú lịch sử.

## 1. Vì sao nghĩ tới tính năng này

**Động lực trực tiếp — trần chi phí AI của Engine 1 (2026-08-16).** Rà Final
Phase của `docs/plans/engine1-adaptive-ai-work-plan.md` phát hiện: key Gemini
đang dùng cho gia sư "Giải thích bước này" (`lib/tutor/callTutor.ts`) bị giới
hạn **20 request/NGÀY, cho TOÀN BỘ dự án** (`quotaId:
GenerateRequestsPerDayPerProjectPerModel-FreeTier`, đo trực tiếp từ thân lỗi
429 — xem `docs/plans/tasks/engine1-adaptive-ai-work-plan-phase6-completion.md`
mục Q-1). Cùng key này còn dùng cho trích xuất câu hỏi từ PDF khi user upload
đề (`lib/ugc/gemini.ts`). Hạn mức theo NGÀY, không phải theo giờ/phút — và
`RATE_LIMITS.explainStep` hiện là 20/giờ/người dùng, nghĩa là một học sinh có
thể tiêu hết ngân sách cả ngày của toàn dự án chỉ trong một giờ.

Đây không phải lỗi kỹ thuật có thể vá bằng code — nó là **giới hạn của gói
miễn phí**. Hai hướng ra: nâng gói trả phí cho Gemini (chi phí vận hành tăng,
không có ai trả), hoặc dùng doanh thu subscription để tài trợ hạn mức đó —
tức bó tính năng gia sư AI (và có thể cả upload UGC không giới hạn) vào một
gói trả phí.

**Bối cảnh sản phẩm hiện tại (từ `PROJECT_OVERVIEW.md`):** TrangNguyenDigi
đang là sản phẩm **100% miễn phí, không có tầng thanh toán nào** — không có
dependency Stripe/Paddle/nhà cung cấp thanh toán nào trong `package.json`,
không có bảng `subscriptions`/`plans` nào trong `schema.sql`. Đây sẽ là hạ
tầng thanh toán ĐẦU TIÊN của dự án, không phải mở rộng một cái đã có.

## 2. Vấn đề cần giải (đóng khung, chưa giải)

- Chi phí AI (gia sư Socratic, và có thể cả trích xuất UGC) đang chạm trần
  gói miễn phí của nhà cung cấp, và trần đó là mức TOÀN DỰ ÁN chứ không co
  giãn theo số người dùng.
- Sản phẩm chưa có cơ chế nào để một phần người dùng "trả nhiều hơn" để đổi
  lấy quyền truy cập nhiều hơn — mọi tính năng hiện tại (làm đề, xem kết quả,
  lịch sử, phân tích Layer 3, gia sư AI) đều mở như nhau cho mọi tài khoản đã
  đăng nhập.
- Đối tượng người dùng là học sinh THCS/THPT Việt Nam trên thiết bị tầm
  trung, mạng không ổn định (`PROJECT_OVERVIEW.md` §1) — khả năng chi trả và
  phương thức thanh toán khả dụng (thẻ quốc tế hiếm, ví điện tử/QR phổ biến
  hơn) là ràng buộc thật, không phải chi tiết UI.

## 3. Việc CHƯA quyết định — cần engineer trả lời trước khi viết PRD thật

Đây là phần cốt lõi của file khởi thảo này. Không có câu trả lời nào ở đây là
X vì Claude nghĩ vậy — đây là danh sách câu hỏi mở.

- [ ] **Gate cái gì?** Chỉ gia sư AI (Engine 1)? Cả upload UGC không giới
      hạn? Đề "cao cấp" (đề độc quyền/chất lượng cao hơn)? Bỏ quảng cáo (hiện
      chưa có quảng cáo nào, không rõ có định thêm không)? Giới hạn số đề
      làm/ngày cho tài khoản free?
- [ ] **Bao nhiêu gói, giá bao nhiêu?** Một gói Premium duy nhất, hay nhiều
      bậc (Free / Plus / Pro)? Giá theo VNĐ hay USD? Theo tháng, theo năm,
      hay theo "gói ôn thi" (vd trọn kỳ ôn thi THPT Quốc gia)?
- [ ] **Nhà cung cấp thanh toán nào khả thi cho thị trường VN?** Thẻ quốc tế
      (Stripe) có phù hợp đối tượng học sinh không có thẻ riêng không? Có cần
      tích hợp ví/QR nội địa (MoMo, ZaloPay, VNPay...) không — các nhà cung
      cấp đó có SDK/tích hợp sẵn trên Vercel Marketplace hay phải tự viết?
- [ ] **Ai trả tiền — học sinh hay phụ huynh?** Ảnh hưởng trực tiếp tới luồng
      UX thanh toán (một tài khoản tự thanh toán, hay có luồng "tặng/mua hộ"
      giống một số app học tập khác).
- [ ] **Có cần một mô hình dữ liệu "gói đang hoạt động" trong `schema.sql`
      không**, hay dùng thẳng trạng thái subscription từ nhà cung cấp qua
      webhook + cache một cột `plan`/`plan_expires_at` trên `profiles`?
- [ ] **Việc này có giải quyết Q-1 không, hay là hai việc song song?** Nếu
      mục tiêu chính là tài trợ hạn mức Gemini, cần biết: nâng gói Gemini tốn
      bao nhiêu, cần bao nhiêu subscriber trả phí để hoà vốn — hay quyết định
      đơn giản hơn là tạm hạ `RATE_LIMITS.explainStep` xuống một mức toàn-dự-
      án-an-toàn trong lúc chờ subscription, tách rời khỏi tính năng này.

## 4. Việc CHƯA làm (nhắc lại để không quên)

- Chưa chọn nhà cung cấp thanh toán, chưa cài dependency nào.
- Chưa thiết kế schema (bảng `subscriptions`/cột `plan` trên `profiles`,
  RLS cho nó).
- Chưa quyết định danh sách tính năng nào bị gate.
- Chưa có PRD/ADR/Design Doc chính thức — theo quy trình tài liệu của repo
  này (`dev-workflows-fullstack`), bước tiếp theo hợp lý SAU KHI mục 3 có câu
  trả lời là chạy `recipe-design`/`prd-creator` để dựng `docs/prd/
  subscription-prd.md` đúng khuôn, chứ không viết PRD ngay từ file khởi thảo
  này.

## 5. Việc engineer cần làm tiếp

Bổ sung câu trả lời cho mục 3 (có thể trả lời trực tiếp trong file này, hoặc
nói lại trong phiên làm việc kế tiếp) — trước khi bất kỳ dòng code hay quyết
định kiến trúc nào được viết cho tính năng này.

## Tham chiếu

- Động lực gốc: `docs/plans/tasks/engine1-adaptive-ai-work-plan-phase6-completion.md`
  mục **Q-1** (trần Gemini 20 request/ngày).
- Bối cảnh sản phẩm: `PROJECT_OVERVIEW.md` §1 (đối tượng người dùng), §4
  (tech stack — chưa có tầng thanh toán).
- Quy trình tài liệu chuẩn của repo khi phạm vi đã rõ: skill
  `dev-workflows-fullstack:documentation-criteria` + `recipe-design`.
