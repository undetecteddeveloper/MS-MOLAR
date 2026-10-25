// @vitest-environment jsdom

// AttemptPdfTemplate — Quyết định ràng buộc (history-work-plan-task-08.md):
//  - ADR-0009 (§ Implementation Guidance): style của component này chỉ được phân giải
//    thành hex/rgb(a) thuần — không ghép components/ui/button.tsx,
//    không dùng tiện ích slash-opacity/color-mix của Tailwind, ở bất kỳ đâu trong cây con này.
// Nghĩa vụ chứng minh (AC-006, AC-008): test chốt chặn chứng minh ràng buộc style
// ở mức inline-style của jsdom qua một lần render thật (không có ranh giới mock) cộng
// kiểm tra văn bản nguồn tìm `className`; bằng chứng raster hoá html2canvas đầy đủ
// là Early Verification Point của Task 11, không phải của test này.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AttemptPdfTemplate, type AttemptPdfTemplateProps } from "./AttemptPdfTemplate";

const SOURCE_PATH = join(process.cwd(), "components/pdf/AttemptPdfTemplate.tsx");
const SOURCE_TEXT = readFileSync(SOURCE_PATH, "utf-8");

const BASE_PROPS: AttemptPdfTemplateProps = {
  subject: "Math",
  examTitle: "Mock Exam #3",
  totalScore: 8.5,
  examineeName: "Nguyen Phat",
  submittedDateLabel: "12/07/2026",
  submittedTimeLabel: "09:00",
  correct: 8,
  total: 10,
  // Mặc định KHÔNG có câu tự luận dở dang — ca in dòng chú thích bật cờ này
  // lên tại chỗ, nên nền của mọi ca cũ giữ nguyên hành vi trước tính năng.
  hasIncompleteEssay: false,
};

describe("AttemptPdfTemplate", () => {
  it("renders with all required fields", () => {
    const { container } = render(<AttemptPdfTemplate {...BASE_PROPS} hasIncompleteEssay={false} />);

    expect(container.textContent).toContain("Math");
    expect(container.textContent).toContain("Mock Exam #3");
    expect(container.textContent).toContain("8.5");
    expect(container.textContent).toContain("/10");
    expect(container.textContent).toContain("Nguyen Phat");
    expect(container.textContent).toContain("12/07/2026");
    expect(container.textContent).toContain("09:00");
    // correct=8, total=10 → wrong=2, tính nội bộ (không phải prop của nơi gọi).
    expect(container.textContent).toContain("8");
    expect(container.textContent).toContain("2");
  });

  it("formats totalScore internally via toFixed(1), not pre-formatted by the caller", () => {
    const { container } = render(<AttemptPdfTemplate {...BASE_PROPS} totalScore={10} hasIncompleteEssay={false} />);
    expect(container.textContent).toContain("10.0");
  });

  it("plain-hex/rgb guard (ADR-0009): rendered inline styles never resolve through oklch()/color-mix(), and the source has zero className attributes", () => {
    const { container } = render(<AttemptPdfTemplate {...BASE_PROPS} hasIncompleteEssay={false} />);

    // Đầu ra inline-style của lần render thật — không có ranh giới mock (theo Proof Obligations).
    const renderedHtml = container.innerHTML;
    expect(renderedHtml).not.toContain("oklch(");
    expect(renderedHtml).not.toContain("color-mix(");

    // Kiểm tra văn bản nguồn — component không bao giờ được mang thuộc tính `className`
    // (lớp Tailwind hay khác) ở bất kỳ đâu trong cây con. Chỉ khớp
    // dạng thuộc tính JSX (`className=`), không khớp từ đó xuất hiện trong
    // các comment văn xuôi của chính file này mô tả ràng buộc.
    expect(SOURCE_TEXT).not.toMatch(/className=/);

    // Mẫu đã xác nhận không an toàn của ADR-0009 từ components/ui/button.tsx không bao giờ
    // được import vào hay tái tạo bên trong component này.
    expect(SOURCE_TEXT).not.toMatch(/from ["']@\/components\/ui\/button["']/);
    expect(SOURCE_TEXT).not.toContain("color-mix(");
    expect(SOURCE_TEXT).not.toContain("oklch(");
  });

  it("structural AC-006 guard: AttemptPdfTemplateProps has no field capable of carrying per-question content", () => {
    // Danh sách khoá cố định, đầy đủ, phản chiếu Data Contract của frontend DD
    // (`docs/design/history-frontend-design.md` § Data Contracts). Việc thêm
    // prop về sau (ví dụ `questions`/`answers`) đổi tập này và làm khẳng định hỏng,
    // buộc phải xem xét có chủ đích đối chiếu với AC-006.
    const props: AttemptPdfTemplateProps = BASE_PROPS;
    expect(Object.keys(props).sort()).toEqual(
      [
        "correct",
        "examTitle",
        "examineeName",
        // Task F-B3 (O-8): một BOOLEAN, không phải nội dung. Nó nói "có ít nhất
        // một câu tự luận dừng hẳn ở RS-6", và không mang nổi một câu hỏi hay
        // một câu trả lời nào — nên AC-006 vẫn đứng: template này vẫn không có
        // trường nào chứa được nội dung từng câu.
        "hasIncompleteEssay",
        "subject",
        "submittedDateLabel",
        "submittedTimeLabel",
        "total",
        "totalScore",
      ].sort()
    );
  });

  it("never mounts components/ui/button.tsx (ADR-0009 — confirmed-unsafe color-mix hover state)", () => {
    expect(SOURCE_TEXT).not.toMatch(/import\s+.*Button.*from/);
  });
});


// ═══════════════════════════════════════════════════════════════════════════
// DÒNG CHÚ THÍCH TỰ LUẬN CHƯA HOÀN TẤT (O-8 / AC-058) — Task F-B3
//
// O-8 đã LOẠI cả hai phương án cực đoan: chặn xuất ở RS-6 là chặn VĨNH VIỄN
// một học sinh khỏi kết quả của chính mình vì một sự cố không do họ gây ra;
// còn xuất mà không chú thích thì tệp TRÔNG NHƯ một kết quả đầy đủ và không
// có gì trên đó nói ngược lại. Nên: xuất được, kèm một dòng in TRONG tệp.
// ═══════════════════════════════════════════════════════════════════════════

describe("AttemptPdfTemplate — chú thích tự luận chưa hoàn tất", () => {
  it("hasIncompleteEssay=false ⇒ KHÔNG in dòng nào (hành vi cũ giữ nguyên)", () => {
    const { container } = render(<AttemptPdfTemplate {...BASE_PROPS} />);

    expect(container.textContent).not.toContain("essay");
    // Khẳng định dương: tệp vẫn có nội dung bình thường.
    expect(container.textContent).toContain("Mock Exam #3");
  });

  it("hasIncompleteEssay=true ⇒ in nhãn đã dịch được truyền vào", () => {
    const LABEL = "Đề này có câu tự luận không được chấm tự động.";
    const { container } = render(
      <AttemptPdfTemplate {...BASE_PROPS} hasIncompleteEssay essayIncompleteLabel={LABEL} />
    );

    expect(container.textContent).toContain(LABEL);
  });

  it("hasIncompleteEssay=true không có nhãn ⇒ dùng bản tiếng Anh mặc định", () => {
    // Cùng khuôn với mọi nhãn khác của template: tệp không bao giờ im lặng bỏ
    // dòng ấy chỉ vì người gọi quên truyền chữ.
    const { container } = render(<AttemptPdfTemplate {...BASE_PROPS} hasIncompleteEssay />);

    expect(container.textContent).toContain("not scored automatically");
  });

  it("dòng mới dùng hex literal, KHÔNG token — ràng buộc cứng của ADR-0009", () => {
    // Chỉ khẳng định điều mà ca này SỞ HỮU: dòng mới dùng đúng giá trị hex đã
    // có sẵn trong file, không mang màu mới. Việc "không hàm màu hiện đại nào
    // lọt vào" đã có một rào chắn RIÊNG ở trên trong chính file này — nhân bản
    // nó ở đây chỉ tạo một lời khai thứ hai để trôi lệch.
    // `#4f6656` = `--muted-foreground` của theme "Sân trường" (2026-09-13;
    // trước đó là `#605a52` của theme cũ).
    expect(SOURCE_TEXT).toContain("#4f6656");
    expect(SOURCE_TEXT).not.toMatch(/className=/);
  });

  it("theme 'Sân trường' (2026-09-13): nền trắng, điểm xanh hành động, chữ Lexend qua biến của next/font", () => {
    expect(SOURCE_TEXT).toContain('"#ffffff"');
    expect(SOURCE_TEXT).toContain('"#117a45"');
    expect(SOURCE_TEXT).toContain("var(--font-lexend)");
    // Hai họ chữ của theme cũ không còn được nạp ở app/layout.tsx — gọi tên
    // chúng là rơi về font hệ thống.
    expect(SOURCE_TEXT).not.toContain("Be Vietnam Pro");
    expect(SOURCE_TEXT).not.toContain("Source Serif 4");
  });
});
