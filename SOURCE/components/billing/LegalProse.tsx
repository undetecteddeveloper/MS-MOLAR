// LegalProse — dựng khối cho thân văn bản pháp lý (UI Spec C-04, PRD U3/R11).
//
// VÌ SAO KHÔNG PHẢI MỘT BỘ MARKDOWN: LegalDocument.tsx đã chốt "KHÔNG dùng
// <RichText>" vì đó là đường dành cho UGC KHÔNG TIN CẬY, và vì kéo một bộ phân
// tích markdown vào một trang tĩnh là thêm phụ thuộc cho một việc không cần.
// Quyết định đó vẫn đứng. Cái ở đây KHÔNG phải markdown: nó đọc DUY NHẤT tiền
// tố ĐẦU DÒNG của mỗi dòng, và KHÔNG phân tích gì bên trong dòng — không `**`,
// không liên kết, không mã. Một chuỗi `**` lọt vào nội dung sẽ hiện ra nguyên
// văn hai dấu sao chứ không âm thầm biến thành thẻ, và đó là hành vi ĐÚNG cho
// văn bản pháp lý: cái hiện lên phải bằng đúng cái đã duyệt.
//
// BỐN LOẠI DÒNG, và không có loại thứ năm:
//   "## "  → <h2>     mốc điều hướng cho trình đọc màn hình (WCAG 2.4.10)
//   "- "   → <li>     các dòng "- " liền nhau gộp thành MỘT <ul>
//   "> "   → khối lưu ý, viền trái, dùng cho cảnh báo trọng yếu
//   còn lại → <p>
// Dòng trống chỉ để tách khối trong nguồn; nó không sinh phần tử nào.
//
// KHÔNG CÓ <table>: bản so sánh Free/Premium được viết thành các dòng "- ".
// Một bảng ba cột ở 360px là đúng cái nguy cơ tràn ngang mà UI Spec § Layout
// Constraints bắt phải ĐO, nên ở đây danh sách không phải một sự nhân nhượng —
// nó là dạng đọc được trên điện thoại, nơi phần lớn người dùng thật sẽ đọc.

/** Cắt thân văn bản thành khối. Trả về mảng phần tử đã dựng sẵn. */
function renderBlocks(body: string): React.ReactNode[] {
  const lines = body.split("\n");
  const out: React.ReactNode[] = [];
  // Gom các dòng "- " liền nhau; xả ra thành một <ul> khi gặp dòng khác loại.
  let bullets: string[] = [];

  const flushBullets = () => {
    if (bullets.length === 0) return;
    out.push(
      <ul key={`ul-${out.length}`} className="flex list-disc flex-col gap-2 pl-5">
        {bullets.map((b, i) => (
          <li key={i}>{b}</li>
        ))}
      </ul>
    );
    bullets = [];
  };

  for (const raw of lines) {
    const line = raw.trimEnd();

    if (line.startsWith("- ")) {
      bullets.push(line.slice(2));
      continue;
    }
    flushBullets();

    if (line.trim() === "") continue;

    if (line.startsWith("## ")) {
      out.push(
        <h2 key={`h-${out.length}`} className="mt-2 text-base font-semibold">
          {line.slice(3)}
        </h2>
      );
      continue;
    }

    if (line.startsWith("> ")) {
      out.push(
        <p
          key={`q-${out.length}`}
          className="border-primary text-foreground border-l-2 py-1 pl-4 font-medium"
        >
          {line.slice(2)}
        </p>
      );
      continue;
    }

    out.push(<p key={`p-${out.length}`}>{line}</p>);
  }

  flushBullets();
  return out;
}

export function LegalProse({ body }: { body: string }) {
  return <>{renderBlocks(body)}</>;
}
