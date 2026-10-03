# Đường: Việc vặt

Gồm: sửa nhỏ, hỏi đáp, đọc/giải thích code, thao tác git, sửa tài liệu.

1. Làm thẳng. Không brief, không prototype, không bảng tiến độ.
2. Hỏi đáp: trả lời ngắn, nêu file và dòng. Sửa code: sửa đúng chỗ, không dọn lan sang file khác.
3. Giữa chừng thấy việc lớn hơn dự kiến (nhiều màn hình, schema, đổi hành vi sản phẩm): dừng, nói "việc này lớn hơn dự kiến, tôi chuyển sang đường <bug/ui/feature>", rồi đọc file đường đó.
4. Kết thúc: nếu có sửa code thì `npx tsc --noEmit` + vitest của file liên quan (bắt buộc); commit nếu có sửa; chỉ ghi PROGRESS.md khi việc này mở ra một việc dang dở.
5. Báo cáo: dòng đầu `ĐỦ BƯỚC` / `THIẾU …`, rồi 2–4 dòng: đã làm gì, kết quả.
