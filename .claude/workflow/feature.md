# Đường: Tính năng

Chạm schema → đọc `ops-db.md`. Có giao diện → đọc `ui.md` và `ops-ui.md`.

1. Hỏi hướng SẢN PHẨM trước (AskUserQuestion, ≤4 câu/vòng): chỉ chỗ có ≥2 hướng khác nhau. Mọi quyết định kỹ thuật Claude tự quyết.
2. Tài liệu theo độ lớn. Viết vừa đủ để code (PRD/Design Doc ≈150–250 dòng): GIỮ tiêu chí chấp nhận đánh số, bảng quyết định, hợp đồng/chữ ký, danh sách file, bước kiểm; BỎ nền, so sánh, tiểu luận lý do, đoạn mô tả lại code có sẵn. Bản nháp dài thì ra lệnh cắt, không nhận.
   - **Nhỏ** (vài file, không schema, không hành vi mới): không tài liệu, làm như việc vặt nhưng đủ 6 cổng.
   - **Vừa**: một brief ≤150 dòng ở `docs/plans/<yyyymmdd>-<slug>.md` (yêu cầu + quyết định + danh sách task).
   - **Lớn** (nhiều lớp, có schema, nhiều màn hình): PRD + Design Doc, tách task, chạy `/recipe-fullstack-implement` — NGƯỜI DÙNG gõ. Claude chuẩn bị brief rồi đưa đúng dòng lệnh. Gõ mà vẫn bị chặn (`disable-model-invocation`, đã gặp 2026-09-25 và 09-27) → báo "recipe bị chặn", dừng và hỏi; KHÔNG chép lại quy trình bằng tay trừ khi người dùng bảo.
3. Duyệt thiết kế: bắt người kiểm soi 3 chỗ hay lọt: (a) bảng mới — grant so với policy theo hai mẫu trong `schema.sql` (bảng người dùng ghi: giữ grant mặc định + policy; bảng chỉ RPC/server: `revoke all`, không policy; trộn hai mẫu = mọi lần ghi bị từ chối); (b) thành phần có sẵn mà thiết kế mở rộng — kiểm chế độ server/client và props hiện tại; (c) trường jsonb/mảng "chỉ nêu hợp đồng" — đối chiếu với MỌI tiêu chí render từng phần tử từ nó, và với hàm anh em đã có (vd `exam_answer_key()`). PRD/UI Spec lệch Design Doc: cái người dùng THẤY thắng; ghi sửa đổi vào Design Doc.
4. Vòng thực thi: mỗi task một commit (task-executor → quality-fixer → commit); subagent đặt `model: "sonnet"` rõ ràng; trước khi giao lại task cho subagent bị cắt giữa chừng, chạy `git status`. Sau mỗi 2–3 task đã commit, in bảng tiến độ trong chat (cột: task, tên, lớp, trạng thái, hash; pha hiện tại mở đủ, pha khác gộp một dòng đếm; tổng N/M).
5. Schema: theo `ops-db.md`. Ghi prod = CLAUDE.md §5. Tính năng có bảng/cột mới CHỈ được coi là xong khi `schema_version.fingerprint` của prod (đọc qua Composio) khớp dev. Composio thiếu → báo THIẾU, không nói xong.
6. Kết thúc: đủ 6 cổng (exit code thật); cập nhật PROGRESS.md (số đo + lý do + việc còn lại); commit; báo cáo dòng đầu `ĐỦ BƯỚC` / `THIẾU …`.
