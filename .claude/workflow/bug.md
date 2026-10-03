# Đường: Bug

Mặc định Claude tự tìm nguyên nhân, tự sửa, rồi báo lại — không chờ duyệt.

1. Tái hiện trước: viết test đỏ (hoặc lệnh/phép đo cụ thể) cho thấy lỗi. Không tái hiện được → báo, đừng đoán rồi sửa.
2. Tìm NGUYÊN NHÂN, không vá triệu chứng. Trước khi kết luận một cổng đỏ là do mình, đối chiếu các sự cố đã biết trong `ops-env.md`.
3. Sửa tối thiểu: test đỏ → xanh. Nếu cùng nguyên nhân còn ở nơi khác (Grep) thì sửa cùng đợt và nêu trong báo cáo.
4. Nguyên nhân chưa rõ sau lần điều tra đầu → đưa người dùng dòng `/recipe-diagnose <mô tả>` để gõ. Gõ mà bị chặn (lỗi `disable-model-invocation`) → báo "recipe-diagnose bị chặn", KHÔNG tự chép lại quy trình bằng tay trừ khi người dùng bảo.
5. Chỉ dừng hỏi khi: cách sửa đổi điều người dùng THẤY (≥2 hướng), hoặc phải ghi dữ liệu thật trên prod (CLAUDE.md §5). Bug dính prod: đọc prod qua Composio, chỉ đọc; sửa dữ liệu prod = hỏi.
6. Kết thúc: đủ 6 cổng nếu chạm code app; commit `fix(scope): ...`. Báo cáo: dòng đầu `ĐỦ BƯỚC` / `THIẾU …`; nguyên nhân MỘT câu; đã sửa gì; số đo trước/sau.
