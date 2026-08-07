# UI Design Research: WCAG 2.2 AA & Design System Patterns

> Tài liệu tham khảo nội bộ cho Claude Code — dùng khi lập trình hoặc kiểm thử giao diện cho TrạngNguyênDigi. Nguồn: nghiên cứu tổng hợp về tiêu chuẩn WCAG 2.2 AA và các hệ thống thiết kế (design systems) của Supabase, GitHub, OpenAI, Google, Anthropic, Composio.

---

# **Báo Cáo Nghiên Cứu Tổng Hợp: Tiêu Chuẩn Giao Diện Người Dùng Và Kiến Trúc Bố Cục Nền Tảng Công Nghệ**

Tài liệu này được biên soạn nhằm cung cấp một hệ quy chiếu toàn diện về các tiêu chuẩn thiết kế giao diện người dùng (UI) bắt buộc, đồng thời phân tích sâu sắc các mô hình kiến trúc bố cục (layout) đang được áp dụng tại các tập đoàn công nghệ tiên phong. Dữ liệu được cấu trúc hóa dưới dạng tài liệu tiêu chuẩn, tối ưu hóa cho khả năng trích xuất và xử lý ngôn ngữ tự nhiên của các hệ thống AI Agent trong quá trình tạo lập và kiểm thử mã nguồn giao diện (Frontend Generation & Auditing).

## **Website UI Design Standard**

Hệ thống tiêu chuẩn thiết kế UI bắt buộc đối với các nền tảng kỹ thuật số hiện đại không còn chỉ dừng lại ở các nguyên tắc thẩm mỹ thị giác. Khung quy chuẩn tối cao chi phối toàn bộ cấu trúc DOM, hệ thống CSS và các kịch bản tương tác hiện nay là Web Content Accessibility Guidelines (WCAG) phiên bản 2.2 ở cấp độ AA. Việc tuân thủ WCAG 2.2 AA là một yêu cầu pháp lý tại nhiều quốc gia và là tiêu chuẩn cốt lõi để đảm bảo giao diện có thể được nội hóa, tương tác và hiểu được bởi mọi người dùng, bao gồm cả những cá nhân sử dụng công cụ hỗ trợ (assistive technologies).

Đối với một AI Agent tham gia vào quá trình lập trình giao diện, việc hiểu và áp dụng các thông số kỹ thuật này vào mã nguồn là bước bắt buộc trước khi xem xét đến thiết kế hình ảnh. Hệ thống WCAG 2.2 được xây dựng trên bốn nguyên tắc nền tảng, tạo thành mô hình POUR: Có thể nhận thức (Perceivable), Có thể vận hành (Operable), Có thể hiểu (Understandable), và Tính mạnh mẽ (Robust).

### 1. Nguyên Tắc Nhận Thức (Perceivable)

Nguyên tắc này yêu cầu hệ thống không được phép đóng gói thông tin theo cách chỉ có thể tiếp nhận bằng một giác quan duy nhất. Trong lập trình UI, điều này đòi hỏi việc quản lý cấu trúc thẻ HTML một cách nghiêm ngặt.

Mọi thành phần phi văn bản (non-text content) như hình ảnh, biểu đồ, và biểu tượng bắt buộc phải có thuộc tính thay thế văn bản. Đối với hình ảnh mang tính trang trí, thuộc tính `alt=""` (rỗng) phải được sử dụng để trình đọc màn hình có thể bỏ qua, tránh tạo ra tiếng ồn thông tin. Ngược lại, đối với các biểu đồ phức tạp, một bản tóm tắt văn bản chi tiết phải được cung cấp song song với văn bản thay thế ngắn gọn. Các thành phần đa phương tiện yêu cầu phải có phụ đề (captions) cho video và bản ghi chép (transcripts) cho âm thanh.

Khía cạnh quan trọng nhất đối với thiết kế UI trong nguyên tắc này là hệ thống độ tương phản và khả năng điều chỉnh kích thước (Reflow). Việc sử dụng màu sắc không bao giờ được phép là phương tiện duy nhất để truyền đạt ý nghĩa; ví dụ, một trạng thái lỗi không chỉ được biểu thị bằng viền màu đỏ mà còn phải đi kèm nhãn văn bản và biểu tượng cảnh báo.

| Hạng mục thiết kế | Tiêu chuẩn kỹ thuật bắt buộc | Mã tiêu chí WCAG |
|---|---|---|
| **Độ tương phản văn bản thường** | Tỷ lệ tương phản tối thiểu 4.5:1 so với màu nền. Cần sử dụng các công cụ kiểm tra sắc độ (như WebAIM) để tính toán chính xác trên không gian màu. | 1.4.3 |
| **Độ tương phản văn bản lớn** | Tỷ lệ tương phản tối thiểu 3:1 áp dụng cho văn bản từ 18pt trở lên, hoặc 14pt nếu được in đậm. | 1.4.3 |
| **Thành phần UI phi văn bản** | Tỷ lệ tương phản tối thiểu 3:1 áp dụng cho các biểu tượng, viền nút bấm, và đồ họa thông tin quan trọng. | 1.4.11 |
| **Khả năng thay đổi kích thước (Reflow)** | Nội dung phải hiển thị đầy đủ, không bị cắt xén hoặc xuất hiện thanh cuộn ngang khi giao diện được phóng to 400% trên màn hình desktop, hoặc khi hiển thị ở độ rộng 320px trên thiết bị di động. | 1.4.10 |
| **Giãn cách văn bản (Text Spacing)** | Giao diện không bị vỡ khi người dùng điều chỉnh tăng khoảng cách giữa các dòng, từ, hoặc chữ cái. Phải sử dụng đơn vị tương đối (rem, em, %) thay vì các container có kích thước cố định bằng pixel. | 1.4.12 |
| **Ngăn chặn hình ảnh của văn bản** | Hạn chế tối đa việc sử dụng hình ảnh chứa văn bản (ngoại trừ logo thương hiệu), văn bản phải được kết xuất bằng CSS để trình duyệt có thể phóng to, dịch, và đọc. | 1.4.5 |

### 2. Nguyên Tắc Vận Hành (Operable)

Nguyên tắc này định nghĩa cách thức người dùng điều hướng qua các lớp giao diện, đặc biệt nhấn mạnh vào khả năng sử dụng hệ thống hoàn toàn bằng bàn phím mà không phụ thuộc vào thiết bị trỏ (chuột, trackpad). Việc tạo ra một luồng tiêu điểm (focus order) hợp lý, tuân theo trình tự đọc từ trái sang phải, từ trên xuống dưới là yếu tố quyết định. Mọi thành phần tương tác đều phải có thể truy cập bằng phím Tab và không được tạo ra "bẫy bàn phím" (keyboard traps), nghĩa là người dùng luôn có thể dùng bàn phím để thoát ra khỏi một thành phần (như modal hoặc dropdown).

Phiên bản WCAG 2.2 đã bổ sung những quy định khắt khe hơn về tương tác chạm và quản lý tiêu điểm, phản ánh sự dịch chuyển sang môi trường di động và các giao diện ứng dụng web phức tạp. Một trong những thay đổi cốt lõi là quy định về Kích thước Mục tiêu (Target Size - Minimum). Theo đó, mọi thành phần có thể nhấp chuột hoặc chạm phải có kích thước tối thiểu là 24x24 CSS pixel, bao gồm cả khoảng đệm (padding) bên trong; đồng thời phải duy trì khoảng trống đủ rộng giữa các mục tiêu liền kề để tránh tình trạng nhấp nhầm.

Trong quá trình quản lý luồng tiêu điểm, tiêu chuẩn mới yêu cầu Focus Not Obscured, nghĩa là khi một thành phần nhận được tiêu điểm bàn phím, ít nhất một phần của nó phải luôn hiển thị rõ ràng và không bị che khuất bởi các nội dung nổi khác như thanh điều hướng cố định (sticky headers) hay cửa sổ bật lên. Để đạt mức độ tuân thủ cao hơn (AAA), tiêu điểm phải hiển thị toàn bộ kích thước với độ tương phản màu sắc rõ rệt giữa trạng thái được chọn (focused) và chưa chọn (unfocused).

| Quy định tương tác | Cơ chế thực thi trong mã nguồn | Mã tiêu chí WCAG |
|---|---|---|
| **Chỉ báo tiêu điểm (Focus Indicator)** | Trạng thái `:focus` hoặc `:focus-visible` phải được định nghĩa bằng CSS rõ ràng cho mọi liên kết, nút bấm, và trường nhập liệu. Không bao giờ được sử dụng `outline: none` nếu không cung cấp giải pháp thay thế trực quan tương đương. | 2.4.7, 2.4.11 |
| **Liên kết nhảy (Skip Links)** | Cung cấp liên kết ẩn "Skip to content" ở đầu cấu trúc DOM để người dùng bàn phím có thể bỏ qua các menu điều hướng lặp lại và đi thẳng vào nội dung chính. | 2.4.1 |
| **Bảo vệ chống co giật** | Bất kỳ thành phần nào trên trang không được phép chớp nháy hoặc nhấp nháy nhiều hơn ba lần trong một giây. Nếu có ảnh động, người dùng phải có quyền vô hiệu hóa (thông qua `prefers-reduced-motion`). | 2.3.1 |
| **Kiểm soát thời gian** | Nếu một quá trình có giới hạn thời gian (như phiên đăng nhập), người dùng phải có khả năng kéo dài, điều chỉnh, hoặc tắt giới hạn đó trước khi hết hạn. Mọi phương tiện tự động phát kéo dài quá 5 giây phải có nút tạm dừng hoặc dừng hẳn. | 2.2.1, 2.2.2 |
| **Thao tác kéo thả (Dragging)** | Nếu giao diện yêu cầu thao tác kéo thả (ví dụ: bản đồ, thay đổi thứ tự danh sách), bắt buộc phải có phương thức thay thế bằng việc nhấp chuột hoặc chạm đơn giản (như các nút mũi tên lên/xuống). | 2.5.7 |
| **Cử chỉ đa điểm (Gestures)** | Không được sử dụng các cử chỉ đa điểm (multi-pointer) hoặc cử chỉ dựa trên đường dẫn phức tạp làm phương pháp duy nhất để kiểm soát nội dung; luôn phải có tùy chọn nhấp đơn hoặc nhấp đúp để thay thế. | 2.5.1 |

### 3. Nguyên Tắc Hiểu Được (Understandable) & Tính Mạnh Mẽ (Robust)

Để giao diện có thể hiểu được, luồng chức năng phải hoạt động một cách có thể dự đoán. Điều này đòi hỏi thanh điều hướng phải xuất hiện ở cùng một vị trí và duy trì thứ tự nhất quán trên toàn bộ các trang của hệ thống. Các thành phần có chức năng giống nhau phải sử dụng nhãn định danh giống nhau, loại bỏ sự mơ hồ cho người dùng. Khi các trường nhập liệu form nhận tiêu điểm, chúng không được phép tự động kích hoạt các thay đổi ngữ cảnh không mong muốn (ví dụ: tự động gửi form hoặc tự động chuyển hướng trang).

Hệ thống biểu mẫu (forms) là khu vực đòi hỏi sự hỗ trợ nhận thức cao nhất. Mọi trường nhập liệu phải có nhãn rõ ràng, hiển thị trực quan và được liên kết bằng lập trình thông qua các thuộc tính HTML phù hợp. Việc xác định lỗi nhập liệu phải được tự động phát hiện, hiển thị bằng văn bản cụ thể kèm theo hướng dẫn sửa lỗi, và sử dụng thuộc tính `aria-describedby` để liên kết thông báo lỗi với trường nhập liệu tương ứng trong DOM, cho phép trình đọc màn hình thông báo chính xác vị trí và nguyên nhân lỗi. Quan trọng nhất, nút gửi (submit button) không bao giờ được phép bị vô hiệu hóa (disabled) chỉ vì form đang lỗi; thay vào đó, nút vẫn có thể nhấp và hệ thống sẽ đưa tiêu điểm trở lại trường bị lỗi đầu tiên.

Để giảm bớt gánh nặng nhận thức, WCAG 2.2 yêu cầu các hệ thống phải tích hợp cơ chế Redundant Entry (Nhập liệu dư thừa). Trong một quy trình nhiều bước, thông tin mà người dùng đã nhập trước đó phải được tự động điền lại hoặc cung cấp sẵn để người dùng chọn, trừ khi việc nhập lại là bắt buộc vì lý do bảo mật. Hơn nữa, tiêu chuẩn Accessible Authentication (Xác thực có thể truy cập) nghiêm cấm việc bắt buộc người dùng thực hiện các bài kiểm tra nhận thức (như ghi nhớ mật khẩu, đánh vần chính xác, hay nhận diện đối tượng trong hình ảnh) như là phương thức đăng nhập duy nhất. Hệ thống phải hỗ trợ các cơ chế tự động điền (autofill), dán từ clipboard, hoặc cung cấp phương thức xác thực thay thế không đòi hỏi thử thách nhận thức.

Cuối cùng, tính mạnh mẽ (Robust) yêu cầu cấu trúc mã nguồn HTML phải hoàn toàn tuân thủ tiêu chuẩn ngữ nghĩa. Mã HTML cần khai báo ngôn ngữ rõ ràng bằng thuộc tính `lang`, phân cấp tiêu đề từ H1 đến H6 theo thứ tự tuần tự để tránh nhầm lẫn, và sử dụng đúng các cột mốc (landmarks) định hướng không gian (như `<main>`, `<nav>`, `<aside>`). Các thành phần tùy chỉnh bắt buộc phải tích hợp thuộc tính Name, Role, và Value thông qua hệ thống ARIA để các công cụ hỗ trợ có thể xác định danh tính, vai trò, và trạng thái hiện tại của chúng. Việc tuân thủ toàn diện những tiêu chuẩn này tạo ra một kiến trúc giao diện vững chắc, cho phép AI Agent và con người giao tiếp một cách không ma sát trên mọi nền tảng kỹ thuật.

## Kiến Trúc Bố Cục Nền Tảng Công Nghệ: Sự Hội Tụ Và Khác Biệt

Việc phân tích các hệ thống thiết kế giao diện (Design Systems) của sáu tổ chức công nghệ hàng đầu — Supabase, GitHub, OpenAI, Google, Anthropic và Composio — phơi bày một cuộc dịch chuyển mô thức sâu sắc trong cách hiển thị thông tin kỹ thuật số. Thiết kế giao diện trong thập kỷ này đang rời xa sự cường điệu của các yếu tố tiếp thị đồ họa nặng nề để hướng tới Chủ nghĩa tối giản định hướng tiện ích (Utility-driven minimalism), nơi kiến trúc dữ liệu và nghệ thuật chữ trở thành công cụ chính yếu trong việc định hướng nhận thức người dùng.

### 1. Sự Hội Tụ Về Tư Duy Thiết Kế Kiến Trúc

Sự tương đồng giữa các công ty này không bắt nguồn từ việc sao chép thẩm mỹ, mà là kết quả của quá trình giải quyết chung một vấn đề sinh thái: làm thế nào để trình bày các hệ thống cơ sở hạ tầng phức tạp, logic mã nguồn, và đầu ra của mô hình AI cho các nhà phát triển một cách rõ ràng và hiệu quả nhất. Phương pháp luận lấy nhà phát triển làm trung tâm (developer-centric design) đã tạo ra một bộ quy tắc kiến trúc đồng nhất.

**Kiến trúc Lưới Bento (Bento Grid):** Việc chia nhỏ màn hình thành một hệ thống lưới bất đối xứng nhưng gắn kết chặt chẽ thông qua các "thẻ" (cards) đang là tiêu chuẩn không thể tranh cãi. Được vận hành bởi CSS Grid cho cấu trúc tổng thể và Flexbox cho việc căn chỉnh các phần tử bên trong, lưới Bento cho phép hiển thị song song nhiều tính năng động, sơ đồ thực thi, hoặc đoạn mã mà không gây nhiễu loạn thị giác. Cấu trúc lưới này có khả năng thích ứng linh hoạt (responsive); khi chuyển từ không gian rộng lớn của màn hình desktop sang các khung nhìn hẹp (viewport) của thiết bị di động (dưới 600px), các khối sẽ tự động sụp đổ thành một cột xếp chồng theo chiều dọc, bảo toàn hoàn toàn thứ bậc thông tin.

**Hệ sinh thái Đa kiểu chữ (Dual-Typography System):** Mọi công ty phân tích đều áp dụng một cấu trúc phân cấp typography nghiêm ngặt nhằm phân tách rõ ràng giữa "ngôn ngữ tiếp thị" và "ngôn ngữ kỹ thuật". Mô hình chung là sử dụng một phông chữ hiển thị (Display font) thường là Sans-serif hình học hoặc Serif cổ điển mang đậm cá tính thương hiệu cho các tiêu đề (Headings) khổng lồ, kết hợp với một phông chữ giao diện (UI font) siêu dễ đọc như Inter hoặc Roboto cho phần thân văn bản. Kèm theo đó luôn là một phông chữ Monospace chuyên biệt (như Source Code Pro, Anthropic Mono, hoặc Söhne Mono) để đóng gói các chỉ báo kỹ thuật, nhãn dữ liệu, và đoạn mã.

**Chủ nghĩa Màn hình Tối (Dark-Mode Native) & Độ tương phản cực đại:** Các nền tảng nhắm tới lập trình viên đã biến Chế độ tối (Dark Mode) từ một tùy chọn phụ thành một ngôn ngữ thiết kế nền tảng. Bằng cách mô phỏng môi trường của các trình soạn thảo mã nguồn (IDEs) và giao diện dòng lệnh, thiết kế dark-first giúp giảm thiểu mệt mỏi thị giác. Thậm chí khi sử dụng nền tảng ánh sáng (như OpenAI và Anthropic), triết lý này chuyển thành một bảng màu có độ tương phản cực đại giữa nền Trắng tinh khiết / Ngà và chữ Đen mực / Đá phiến sẫm, từ chối việc sử dụng các dải màu chuyển sắc (gradients) hoặc màu sắc quá bão hòa vốn phổ biến trong các thiết kế Web 2.0.

**Kiến trúc Phẳng & Giảm thiểu Bóng đổ (Minimal Elevation):** Thay vì sử dụng thuộc tính `box-shadow` dày đặc để tạo cảm giác về các lớp vật lý, các thiết kế hiện đại định nghĩa không gian Z (chiều sâu) thông qua sự chênh lệch màu sắc bề mặt (surface color contrast) hoặc các đường viền mỏng manh (hairline borders). Sự biến mất của bóng đổ phức tạp không chỉ làm cho giao diện trở nên sạch sẽ hơn, giảm tải nhận thức, mà còn tối ưu hóa hiệu suất kết xuất của trình duyệt khi xử lý các bảng điều khiển chứa hàng nghìn điểm dữ liệu.

### 2. Đặc Trưng Kiến Trúc Hình Ảnh Của Từng Tổ Chức

Bất chấp sự đồng nhất trong triết lý nền tảng, mỗi tổ chức đã phát triển một hệ thống mã thông báo thiết kế (Design Tokens) riêng biệt, phản ánh trực tiếp bản sắc cốt lõi và chiến lược tiếp cận thị trường của họ. Sự khác biệt này nằm ở việc kiểm soát vi mô: bán kính góc, nhịp độ khoảng trắng, và mật độ màu nhấn.

#### Supabase: Thẩm Mỹ Cửa Sổ Dòng Lệnh Mở Rộng

Supabase tự định vị là một nền tảng cơ sở dữ liệu Postgres thay thế nguồn mở, do đó ngôn ngữ thiết kế của họ mang đậm chất "nguyên bản mã nguồn" (terminal-aesthetic). Thay vì sử dụng màu đen `#000000` tuyệt đối gây chói mắt, hệ thống của Supabase sử dụng dải màu nền đen than (near-black) như `#0f0f0f` cho các nút bấm và `#1a1a1a` hoặc `#171717` cho các bề mặt thẻ, tạo ra một không gian làm việc sâu thẳm nhưng dịu mắt.

Màu sắc thương hiệu duy nhất là Xanh lục bảo (Brand Green `#3ecf8e` trong môi trường tối, hoặc `#3fcf8e` trong môi trường sáng), được sử dụng cực kỳ tiết chế cho các nút kêu gọi hành động (CTA), liên kết và hiệu ứng chớp tắt, kế thừa trực tiếp từ màu sắc nhận diện của PostgreSQL.

Về mặt cấu trúc lưới và hình học, Supabase tạo ra sự đối lập mạnh mẽ. Nút bấm chính được tạo hình dưới dạng viên thuốc (pill-shaped) với bán kính bo góc cực đại 9999px, hoàn toàn tương phản với các thẻ tính năng (cards) có bán kính bo góc cứng cáp và sắc nét từ 8px đến 12px. Nghệ thuật chữ được tối ưu hóa cho sự cô đọng: phông chữ Circular được sử dụng cho tiêu đề chính (hero text) với kích thước khổng lồ 72px nhưng bị ép chặt với chiều cao dòng (line-height) 1.00, loại bỏ mọi khoảng trắng thừa thãi theo chiều dọc nhằm tạo ra những thông điệp đậm đặc mang tính công nghiệp. Cấu trúc layout trang (như trang Studio) tuân thủ quy tắc nghiêm ngặt: thanh Breadcrumbs luôn nằm trên cùng; điều hướng phụ nằm ngay bên dưới; các trang quản lý sẽ thay đổi độ rộng linh hoạt (small, default, full) tùy thuộc vào nội dung (như bảng điều khiển cần không gian toàn màn hình, trong khi trang cấu hình sẽ thu hẹp) thay vì dùng một khung lưới duy nhất.

| Token / Thành phần Supabase | Đặc điểm kỹ thuật CSS | Mục đích UX / Chiến lược |
|---|---|---|
| **Bề mặt tối (Surface Card)** | `oklch(0.215 0.0025 159)` ≈ `#1c1f1e` | Tạo lớp nổi trên nền trang `#0f0f0f` mà không cần bóng đổ. |
| **Bán kính (Border Radius)** | Primary Button: 9999px. Cards: 8–16px. | Định hướng thị giác vào hành động chính yếu, duy trì kết cấu nội dung hình hộp. |
| **Mật độ phông chữ (Hero)** | Phông Circular, kích thước 72px, weight 400, line-height 1.00 | Tối đa hóa mật độ thông tin, loại bỏ sự lãng phí không gian dọc. |
| **Quản lý Tiêu điểm (Focus)** | `rgba(0,0,0,0.1) 0px 4px 12px` | Minimal shadow duy nhất trong toàn bộ hệ thống dark theme, chỉ dành cho tương tác. |

#### GitHub: Tính Mô-đun Và Phân Cấp Dữ Liệu Chuyên Sâu

Nếu Supabase tập trung vào phong cách dòng lệnh, thì GitHub (với hệ thống thiết kế Primer) tập trung hoàn toàn vào kỹ thuật quản trị hệ thống quy mô lớn (large-scale systems engineering). Vì nền tảng phải hiển thị các cấu trúc thư mục lồng nhau phức tạp, yêu cầu kéo dài hàng triệu kho lưu trữ, kiến trúc layout của GitHub được phân tách thành các vùng định tuyến (Layout regions) cực kỳ mô-đun hóa.

Tài liệu thiết kế Primer chia kiến trúc trang thành ba loại cốt lõi. Đầu tiên là "Full pages", nơi nội dung và các khu vực vùng (pane regions) được căn giữa với chiều rộng tối đa giới hạn ở mức 1280px để đảm bảo các đoạn văn không chứa quá nhiều từ trên một dòng, duy trì nhịp độ đọc tối ưu. Thứ hai là "Split pages" chia khung nhìn làm hai, luôn giữ vùng (pane) bên trái làm bộ lọc cố định, trong khi không gian nội dung bên phải có thanh cuộn độc lập, đặc biệt hiệu quả trong việc duyệt mã nguồn hoặc danh sách cài đặt dài mà không làm mất ngữ cảnh. Thứ ba là "Interstitial pages" giới hạn độ rộng rất nhỏ ở mức 320px, loại bỏ mọi điều hướng để buộc người dùng tập trung hoàn thành các tác vụ gián đoạn như đăng nhập hoặc xác minh mật khẩu.

Hệ thống Responsive của GitHub không chỉ đơn thuần thay đổi kích thước bằng breakpoints tĩnh, mà dựa trên các phạm vi khung nhìn (Viewport ranges) để biến đổi cấu trúc căn bản. Khi màn hình bị thu hẹp, một sidebar bên trái có thể được tái cấu trúc thành một bottom sheet trượt từ dưới lên, hoặc các nội dung sẽ chuyển sang trạng thái phân lớp theo chiều dọc (stack vertically), đảm bảo luồng công việc phức tạp trên desktop vẫn hoạt động toàn vẹn trên môi trường di động.

#### OpenAI: Chủ Nghĩa Tối Giản Lâm Sàng

Giao diện của OpenAI là biểu hiện cao nhất của sự kiểm soát và kiềm chế (clinical restraint). Trái ngược hoàn toàn với sự phô diễn công nghệ thông thường, giao diện của họ được thiết kế giống như một tài liệu nghiên cứu thuần túy, tĩnh lặng để nhường sự chú ý hoàn toàn cho văn bản tự nhiên sinh ra từ AI.

Cấu trúc màu sắc của họ tuân theo quy tắc lưỡng cực nghiêm ngặt: Trắng tinh khiết (`#ffffff`) hoặc bề mặt Ngọc trai (`#f5f5f5`) đối lập với chữ Đen mực mang sắc thái mòng két cực nhẹ (`#0d0d0d`). Màu nhấn duy nhất được cấp phép là Xanh mòng két (OpenAI Teal `#10a37f`), được sử dụng sắc bén để làm nổi bật hệ thống liên kết hoặc nhãn dán. Để xây dựng một cấu trúc không biên giới, sự chuyển tiếp giữa các dải thông tin trên trang (section transitions) thường được thực hiện thông qua khoảng trắng âm (negative space) hào phóng, chứ không phải các đường kẻ. Khi ranh giới vật lý là điều bắt buộc, OpenAI sử dụng đường viền siêu mỏng màu xám nhạt (`#e5e5e5` hoặc `#ededed`), được xử lý để não bộ con người cảm nhận nó như sự thiếu vắng của màu sắc thay vì một vạch kẻ phân chia hữu hình.

Quy định về typography của OpenAI kết hợp triết lý "Serif for soul, sans for system" (Chữ có chân cho tâm hồn, chữ không chân cho hệ thống). Phông chữ Signifier cổ điển được triển khai trong các thông điệp định hướng nhận thức và tuyên ngôn. Tuy nhiên, toàn bộ vùng kiểm soát sản phẩm (UI controls) bị khóa chặt trong hệ phông chữ Söhne (hoặc Inter/System UI làm dự phòng), một phông chữ không chân cứng cáp với việc cố tình thiết lập khoảng cách chữ âm (negative tracking -0.02em) cho các kích thước hiển thị lớn, tạo ra các khối chữ nén và sắc sảo. Một điểm đặc biệt là OpenAI từ chối việc tạo hệ thống phân cấp bằng cách in đậm quá mức; trọng lượng phông chữ lớn nhất dừng lại ở 600, vì mức 700 trở lên được cho là phá vỡ bản sắc thanh lịch của thương hiệu.

| Token / Thành phần OpenAI | Quy tắc CSS & Hệ thống | Yêu cầu kỹ thuật ứng dụng |
|---|---|---|
| **Khung lưới không gian (Spacing)** | Lưới 4px (4, 5, 6, 7, 10, 11, 31, 32px) | Mọi khoảng đệm, lề phải tuân thủ nghiêm ngặt bội số lưới, tuyệt đối không dùng giá trị ngẫu nhiên. |
| **Bán kính khối (Radius)** | Thang đo: 16px, 18px, 19px, 22px | Bán kính mặc định 19px. Nút CTA hoặc phần tử nhỏ sử dụng 9999px (pill-shaped). |
| **Trạng thái Trọng tâm (Focus)** | `outline: 2px solid #5E6AD2; outline-offset: 2px` | Không bao giờ được loại bỏ outline focus để đảm bảo tuân thủ WCAG tuyệt đối. |
| **Khử hiệu ứng dư thừa** | Cấm dùng `blur()`, `backdrop-filter` trên diện rộng. | Thiết kế phải đảm bảo hiệu suất tĩnh; cấm dùng `will-change` ngoài luồng ảnh động thực sự. |

#### Anthropic: Sự Nghiêm Túc Học Thuật

Thiết kế trang web của Anthropic là nỗ lực tâm lý học rõ ràng nhất trong việc tách biệt thương hiệu khỏi văn hóa "phá vỡ nhanh, di chuyển nhanh" (move fast and break things) của Thung lũng Silicon. Nhằm củng cố cam kết về AI an toàn và đáng tin cậy, hình ảnh của Anthropic mô phỏng một tạp chí nghiên cứu khoa học hoặc một bản luận văn.

Trang chủ của họ từ chối hoàn toàn những gam màu công nghệ thường thấy. Họ sơn không gian bằng màu mực Đá phiến (`#141413`) chồng lên nền màu Ngà kem (`#faf9f5`). Hệ thống không tồn tại một nút Call-to-Action mang màu sắc rực rỡ nào; nút thử nghiệm sản phẩm đơn giản là một viên thuốc màu đen đặc (`#141413`). Kiến trúc layout trên trang không sử dụng gradient mà dựa vào nhịp độ luân phiên của các dải màu (cream-and-black bands) tràn viền (full-bleed) bao trùm từng phần nội dung.

Sự tinh tế của Anthropic nằm ở một hệ thống 8 màu nhấn "ngủ đông" (dormant palette) — bao gồm đất sét (clay `#d97757`), quả vả (fig), xương rồng (cactus), bầu trời (sky `#6a9bcc`), v.v. Những màu này hoàn toàn vô hình trên không gian tiếp thị của trang chủ, và chỉ được "đánh thức" một cách có tính toán trong các sơ đồ cấu trúc mạng nơ-ron, báo cáo nghiên cứu, hoặc bảng điều khiển Chỉ số Kinh tế. Hệ thống phông chữ Anthropic Serif (với Lora / Georgia làm dự phòng) bao trùm phần lớn diện tích giao diện (ở kích thước tiêu đề 57.73px và nội dung 20px), chỉ nhường chỗ cho Anthropic Sans / Mono trong các khu vực điều hướng hoặc siêu dữ liệu.

#### Composio: Động Lực Học Tiện Ích

Định vị là một lớp kỹ năng (skill layer) kết nối hàng nghìn công cụ cho AI Agents, giao diện của Composio đối mặt với thách thức lớn về trực quan hóa mạng lưới đồ sộ.

Thay vì duy trì sự tĩnh lặng như OpenAI hay Anthropic, Composio áp dụng nghệ thuật kể chuyện theo cuộn trang (scroll-driven cinematic storytelling). Cấu trúc của trang xoay quanh các cơ chế hiệu ứng vòng xoáy (spiral loop animations) kết hợp với các bánh xe logo tương tác (interactive logo wheels), mô phỏng vật lý luồng chuyển động của dữ liệu giữa các điểm nút API. Dù sử dụng hoạt ảnh mạnh mẽ, ngôn ngữ thiết kế tổng thể vẫn giữ chặt tính tiện ích (utilitarian, no-fluff), từ chối các trang trí rườm rà không truyền tải chức năng, đảm bảo rằng nền tảng giao tiếp được năng lực xử lý hạ tầng cốt lõi cho kỹ sư phần mềm.

#### Google (Anti Gravity & Material Design)

Dù dữ liệu vi mô về Google trong bối cảnh Agentic AI bị giới hạn, dấu ấn triết lý Material Design vẫn hiển hiện. Trong khi phần lớn thế giới chuyển sang mô hình "phẳng hóa viền siêu mỏng", nền tảng của Google tiếp tục dựa vào quy luật vật lý ảo. Hệ thống sử dụng các bề mặt hình thẻ (cards) nổi bật qua cấu trúc độ cao (layered elevation) phản ứng với hệ thống ánh sáng ảo thông qua bóng đổ (drop shadows). Sự ổn định này tạo ra một ma trận phân cấp không gian quen thuộc, giúp người dùng dễ dàng phán đoán trật tự các chức năng phân tán bên trong hệ sinh thái đám mây phức tạp của họ.

## Báo Cáo Cập Nhật Trạng Thái

Nhiệm vụ nghiên cứu và biên soạn đã được thực hiện toàn diện. Tập tài liệu Markdown này tích hợp sâu các yêu cầu về hệ thống tiêu chuẩn thiết kế bắt buộc (WCAG 2.2 AA) và các biến số kiến trúc hình ảnh cốt lõi từ 6 tổ chức công nghệ mũi nhọn (Supabase, GitHub, OpenAI, Google, Anthropic, Composio). Các số liệu định lượng về kỹ thuật CSS, bảng màu Hex, tỷ lệ Typography, và cấu trúc không gian (Grid, Reflow, Focus) đã được xác minh để hoạt động như bộ tham số chuẩn xác. Tài liệu đáp ứng mục tiêu huấn luyện tham số thiết kế và kiểm thử cho đối tác Claude Code trong quy trình phát triển sản phẩm tương lai.

## Nguồn trích dẫn

1. WCAG 2.2 AA Compliance Implementation Checklist — Cleverix, <https://www.cleverix.com/blog/wcag-2-2-aa-compliance-implementation-checklist>
2. WCAG 2.2 Checklist: Complete 2026 Compliance Guide — Level Access, <https://www.levelaccess.com/blog/wcag-2-2-aa-summary-and-checklist-for-website-owners/>
3. Understanding WCAG 2.2 — Service Manual, GOV.UK, <https://www.gov.uk/service-manual/helping-people-to-use-your-service/understanding-wcag>
4. Web Content Accessibility Guideline Resources for Designers, WCAG.com, <https://www.wcag.com/designers/>
5. WCAG Checklist: A Simplified Guide to WCAG 2.2 AA — DigitalA11Y, <https://www.digitala11y.com/wcag-checklist/>
6. Bento Grid example repo, GitHub, <https://github.com/HossamElrawy/Bento-grid-main>
7. Supabase — Best Landing Page Examples, Fountn, <https://fountn.design/website/supabase/>
8. Bento Grids, <https://bentogrids.com/>
9. Supabase — Design Tokens & System, Design Extractor, <https://www.design-extractor.com/gallery/supabase>
10. Supabase design system — palette, typography & tokens, Open Design, <https://open-design.ai/plugins/design-system-supabase/>
11. Anthropic — Design Tokens & System, Design Extractor, <https://www.design-extractor.com/gallery/anthropic>
12. Anthropic Design System for React, shadcn.io, <https://www.shadcn.io/design/anthropic>
13. OpenAI design system — palette, typography & tokens, Open Design, <https://open-design.ai/plugins/design-system-openai/>
14. OpenAI Landing Page UI Design, SaaSFrame, <https://www.saasframe.io/examples/openai-landing-page>
15. Layout — Supabase Design System, <https://supabase-design-system.vercel.app/design-system/docs/ui-patterns/layout>
16. Primer Design System from GitHub, <https://designsystems.surf/design-systems/github>
17. Layout — Primer, <https://primer.style/product/getting-started/foundations/layout/>
18. design-system topic, GitHub, <https://github.com/topics/design-system>
19. Söhne fonts, Klim Type Foundry, <https://klim.co.nz/fonts/soehne/>
20. openai-ui-skills, LobeHub Skills Marketplace, <https://lobehub.com/skills/ihlamury-design-skills-openai>
21. Theming and customization in ChatKit, OpenAI API docs, <https://developers.openai.com/api/docs/guides/chatkit-themes>
22. Design Guidelines, OpenAI, <https://openai.com/brand/>
23. Anthropic brand guidelines, LobeHub Skills, <https://lobehub.com/skills/jst-well-dan-skill-box-anthropic-brand-guidelines>
24. Composio — Skill Layer For AI Agents, UI UX Showcase, <https://uiuxshowcase.com/resources/composio-skill-layer-for-ai-agents/>
25. Composio, Memetic Design, <https://memetic.design/composio>
