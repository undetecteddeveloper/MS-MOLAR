# Cú đá Maxwell (2026-10-17)

## Yêu cầu
Ở trang ẩn Maxwell, nhấn vào mô hình 3D thì Maxwell bị đá văng ra đằng sau, rơi khỏi bục, có vật lý như game, và chỉ nhấn được MỘT lần.

## Quyết định (người dùng chốt 2026-10-17)
| # | Quyết định | Lý do |
|---|---|---|
| D1 | Maxwell bị hất văng, KHÔNG có vật nào hiện ra để đá (không chân, không giày, không chữ "BỐP!"). | Người dùng chọn phương án 1. |
| D2 | Có SÀN dưới bục: Maxwell rơi xuống sàn và nằm yên ở đó, không rơi vô hạn. | Người dùng yêu cầu thêm. |
| D3 | "Một lần" = một lần mỗi lần tải trang. Tải lại là Maxwell về lại bục, không nhớ gì trên máy. | Người dùng chọn. |

## Quyết định kỹ thuật
| # | Quyết định | Lý do |
|---|---|---|
| T1 | Vật lý tự viết (`scene/kickPhysics.ts`, ≈250 dòng, hàm/lớp thuần dùng toán của `three`), KHÔNG thêm cannon-es/rapier. | Chỉ một vật (hộp bao 1,6×0,89×1,03) rơi lên hai bề mặt (sàn phẳng, cột bục tròn). Không kéo thư viện vào chunk; test chạy trong node không cần WebGL. |
| T2 | Hộp bao rắn, bước cố định 1/240 s, 8 đỉnh va chạm sàn + cột bục, xung va chạm + ma sát Coulomb, nằm yên (sleep) sau 0,3 s đủ chậm. Cạnh hộp chạm mép bục mà không có đỉnh nào lọt vào thì bị bỏ qua. | Đủ "giống game" (nảy, lộn, trượt, nằm yên); cạnh-mép không nhìn thấy được khi vật đang lộn. |
| T3 | Hướng hất: lùi ra sau (−z) + CHÉO sang một bên (|push| ≥ 0,65). Nhấn lệch trái thì bị hất sang phải; nhấn gần giữa hoặc bằng phím thì bốc thăm bên. | Đo 2026-10-17: ném thẳng ra sau thì Maxwell hạ cánh ở z ≈ −3,7, bị chính cột bục che và nhỏ như hạt gạo. Camera nhìn xuống 29° nên chỉ hạ cánh chéo mới thấy rõ cú rơi. |
| T4 | Bục thành cột cao 0,6 trên sàn; sàn là đĩa bán kính 9 mờ dần ra mép (alphaMap), thêm vệt sáng rộng trên sàn, bóng mềm dưới chân Maxwell, và đèn phụ sáng dần trong 0,5 s SAU cú đá (cường độ 0 cho tới lúc đó). | Chỗ hạ cánh nằm ngoài chùm đèn rọi; thiếu sáng + bóng thì Maxwell chìm vào nền đen hoặc trông như lơ lửng. Đèn phụ tắt từ đầu để Maxwell trên bục trông y như bản đã duyệt. |
| T5 | Bắt nhấn bằng một `<button>` trong suốt phủ canvas (`MaxwellStage`), không lắng nghe sự kiện trên canvas. `event.detail === 0` (Enter/Space) → `scene.kick()`; chuột/chạm → `scene.kickAt(x, y)` (raycast, trúng mô hình mới tính). Đá xong nút biến mất; nhãn khung đổi + một dòng đọc cho trình đọc màn hình. | Bàn phím và trình đọc màn hình cũng đá được (WCAG 2.1.1); nhấn trượt thì không có gì xảy ra; `touch-action: pan-y` giữ nguyên cuộn dọc trên điện thoại. |
| T6 | Rê chuột trên mô hình đổi con trỏ thành bàn tay (raycast mỗi lần `pointermove`). | Gợi ý nhẹ cho người dùng máy tính; điện thoại không có hover. |

## File
- `features/maxwell/scene/kickPhysics.ts` (+ `__tests__/kickPhysics.test.ts`) — `KickBody`, `kickLaunch`, `kickPush`.
- `features/maxwell/scene/createMaxwellScene.ts` — bục cột, sàn, đèn phụ, bóng; API `kickAt` / `kick` / `isOverModel`.
- `features/maxwell/components/MaxwellStage.tsx` (+ test) — nút đá, trạng thái `kicked`.
- `lib/copy.ts` — `maxwell.kick`, `maxwell.sceneLabelKicked`.

## Kiểm
Test hàm thuần (rơi + nằm yên trong ≤ 6 s, không lún sàn, 15 tổ hợp hướng/ngẫu nhiên đều kết thúc trên sàn, đầu vào NaN); test `MaxwellStage`; đo trình duyệt thật 390 / 768 / 1280 (nằm yên trên sàn cạnh bục, thấy được), Tab → Enter, CLS 0, console không lỗi mới.
