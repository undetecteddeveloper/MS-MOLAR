// LegalDocument — UI Spec C-04. Khung cho trang văn bản dài.
//
// Repo KHÔNG có trang prose nào từ trước (16 route page.tsx, không trang nào là
// văn bản dài) và KHÔNG có @tailwindcss/typography, nên bề rộng và nhịp chữ ở
// đây là quyết định phải tự chốt chứ không kế thừa được.
//
// Bề rộng: PageContainer size="small" = --scaffold-small = 42rem = 672px.
// .claude/MEMORY.md:96 đặt trần CỨNG 720px cho khối text dài; trong ba nấc
// scaffold (42/48/72rem = 672/768/1152px) chỉ `small` nằm dưới trần đó —
// `default` 768px đã vượt.
//
// KHÔNG dùng <RichText>: nó tồn tại để render UGC KHÔNG TIN CẬY qua bộ
// sanitize. Đẩy văn bản pháp lý của chính mình qua đường dành cho nội dung
// không tin cậy là mô tả sai mức tin cậy của nội dung, và kéo thêm một bộ phân
// tích markdown vào một trang tĩnh.

import { PageContainer } from "@/components/layout/PageContainer";

export function LegalDocument({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-background min-h-dvh">
      <PageContainer as="main" size="small" className="flex flex-col gap-6">
        {/* Tiêu đề trang bỏ khỏi UI nhìn thấy được (điều hướng đã đủ ngữ
            cảnh, và ba trang dùng khung này đều tới từ liên kết CÓ NHÃN —
            footer/legal link — chứ không phải điều hướng mù); h1 sr-only
            giữ mốc cho trình đọc màn hình, cùng quy ước với /exams. */}
        <h1 className="sr-only">{title}</h1>
        {/* Nhịp chữ theo mẫu lặp nhiều nhất trong repo (`text-sm
            leading-relaxed`), không phải một thang mới. h2/h3 tự nhận
            font-serif từ globals.css:263-269. */}
        <section className="flex flex-col gap-4 text-sm leading-relaxed">{children}</section>
      </PageContainer>
    </div>
  );
}

/** Chỗ giữ chỗ dùng khi nội dung pháp lý thật CHƯA có (PRD U3).
 *
 *  U3 nói rõ: nội dung pháp lý là quyết định kinh doanh/pháp lý của engineer và
 *  "KHÔNG được để agent tự soạn" — một trang điều khoản bịa ra còn tệ hơn không
 *  có trang nào. Nên khung trang ship được, còn câu chữ thì chờ người.
 *
 *  Ràng buộc đi kèm, và nó là một cổng chứ không phải lời nhắc: chừng nào phần
 *  này còn hiện ra thì nút xác nhận thanh toán KHÔNG được bật (AC-039 đòi liên
 *  kết phải trỏ tới nội dung thật). Hôm nay nút đó vốn đã bị khoá bởi một cổng
 *  độc lập khác (GEMINI_PAID_TIER_ENABLED, AC-054), nên hai cổng cùng đóng. */
export function LegalContentPending({ message }: { message: string }) {
  return (
    <p
      role="status"
      className="border-border text-muted-foreground rounded-lg border border-dashed px-4 py-3"
    >
      {message}
    </p>
  );
}
