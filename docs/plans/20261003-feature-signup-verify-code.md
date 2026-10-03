# Nhập mã xác minh email khi đăng ký (`/?auth=verify`)

Nhánh `feat/signup-verify-code`, 2026-10-03. KHÔNG đổi schema. Quy mô: vừa.

## Yêu cầu (người dùng chốt 2026-10-03)
- Thêm view con của trang chủ để người đăng ký bằng email/mật khẩu nhập mã xác minh. Google/Facebook ("đăng nhập nhanh") KHÔNG đi qua view này.
- Mail chỉ chứa mã (không link). Địa chỉ `/?auth=verify`. Mã đúng → vào thẳng `/exams`.
- Có: nút Gửi lại mã (đếm ngược 60 giây), nút Đổi email, email tự điền từ bước đăng ký.

## Quyết định kỹ thuật
| # | Quyết định | Lý do |
|---|---|---|
| D1 | View `verify` là chế độ thứ ba của `AuthForm` (cùng chỗ view "Quên mật khẩu"), tách thành `VerifyCodeForm.tsx` | AuthForm đã ~390 dòng; `HomeStage`/`page.tsx` chỉ thêm giá trị `verify` + `?email=` |
| D2 | `signUp` chưa có session → `redirect("/?auth=verify&email=<email>")`; bỏ câu tiếng Anh cũ | Email trên URL chỉ để điền ô; email đã đăng ký rồi vẫn đi đường này (Supabase không báo lỗi) nên không dò được email tồn tại |
| D3 | `verifySignupCode` = `verifyOtp({email, token, type:"signup"})`; `resendSignupCode` = `resend({type:"signup", email})` | API chuẩn của Supabase; session do cookie của server client giữ |
| D4 | Action trả KHOÁ bảng nhãn (`auth.verify.*`), nhánh rate limit trả `profile.error.rateLimited:{giây}` | Cùng luật changePassword: không để `error.message` tiếng Anh của provider ra màn hình |
| D5 | Rate limit theo email chuẩn hoá: `verifySignupCode` 8/giờ, `resendSignupCode` 5/giờ (nhóm chặn lạm dụng) | Người gọi chưa đăng nhập; đánh đổi: biết email người khác là khoá được việc xác minh của họ tới hết giờ |
| D6 | Mã 6–10 chữ số, bỏ khoảng trắng/gạch khi dán | Độ dài do cấu hình Auth quyết định (dev 6, mặc định 8) — không ghim cứng |
| D7 | Lỗi 4xx (trừ 429) → "Mã sai hoặc đã hết hạn"; 429/5xx → câu chung | Supabase trả `otp_expired` cho cả mã sai lẫn hết hạn nên không tách được |

## Task (đã xong trừ T7)
1. `lib/auth/verifyCode.ts` + test — hàm thuần.
2. `RATE_LIMITS` + phân nhóm trong `rateLimit.test.ts`.
3. `actions.ts`: sửa `signUp`, thêm hai action; `verifyActions.int.test.ts` (Supabase giả, 14 ca).
4. `copy.ts` khoá `auth.verify.*`.
5. `VerifyCodeForm.tsx` + `AuthForm`/`HomeStage`/`page.tsx`; test component (5 ca).
6. Đo giao diện bằng Playwright CLI: 360/768/1280, tràn ngang, vùng chạm, mã sai trên dev.
7. **CHƯA LÀM — chặn bởi Supabase:** đổi mẫu mail xác nhận sang `{{ .Token }}`.

## Chặn T7 (số đo)
- Dev (`hynwleaxtbtjzkvpjsug`) đọc 2026-10-03: `smtp_host = null` (dùng mail mặc định), `rate_limit_email_sent = 2` mail/giờ cho cả project, mẫu xác nhận chỉ có `{{ .ConfirmationURL }}`.
- `PATCH /config/auth` đổi mẫu → 400 "Email template modification is not available for free tier projects using the default email provider".
- Đã đổi trên dev: `mailer_otp_length` 8 → 6 (các khoá khác đọc lại: không đổi). Prod CHƯA đọc/đổi.
- Hết chặn khi: gắn SMTP riêng (hoặc nâng gói) cho dev và prod, rồi đổi mẫu (xem PROGRESS.md).

## Kiểm
- Chưa chạy được thật: mail có mã tới hộp thư + `verifyOtp` thành công (cần T7). Test chỉ chứng minh tham số gọi, redirect, khoá lỗi, không log mã/email.
- Không thử đăng ký thật trên dev để khỏi tốn 2 mail/giờ.
