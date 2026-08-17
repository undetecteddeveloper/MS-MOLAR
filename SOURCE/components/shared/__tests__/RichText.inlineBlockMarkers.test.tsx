// @vitest-environment jsdom

// Nhãn lựa chọn ngắn không được bị markdown nuốt mất (bug prod 2026-08-17).
//
// Vì sao test này tồn tại: lựa chọn đáp án thường CHỈ là một con số — đề Sinh
// học 12 có câu mà cả 4 lựa chọn là "1." "2." "3." "4.", đề Vật lí 11 câu 21 có
// B = "1." bên cạnh $\sqrt{2}$. Markdown đọc "1." ở đầu chuỗi là MARKER của
// danh sách đánh số, nên parse ra <ol><li></li></ol> rỗng: nội dung biến mất
// hoàn toàn trên màn làm bài, mà DB vẫn lưu đúng và validate EMPTY_CHOICE vẫn
// pass (chuỗi có ký tự). Hình dạng im lặng — chỉ lộ khi làm bài thật.
//
// Behavior: RichText(text, inline) phải giữ nguyên chữ cho MỌI marker khối
// (danh sách đánh số/gạch đầu dòng, heading, blockquote) vì ở ngữ cảnh inline
// (nhãn lựa chọn, ý a–d) không có khái niệm "khối".
// @category: core-functionality
// @dependency: none — real RichText, no mocks

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RichText } from "../RichText";

describe("RichText inline — marker khối không được nuốt nội dung", () => {
  it.each(["1.", "2.", "3.", "4.", "10.", "1)", "- 5", "+ 2", "# 3", "> 7"])(
    "giữ nguyên chữ cho lựa chọn %o",
    (text) => {
      const { container } = render(<RichText text={text} inline />);
      expect(container.textContent?.trim()).toBe(text);
    }
  );

  it("không tạo <ol>/<ul> từ nhãn lựa chọn ngắn", () => {
    const { container } = render(<RichText text="1." inline />);
    expect(container.querySelector("ol")).toBeNull();
    expect(container.querySelector("ul")).toBeNull();
  });

  it("vẫn render math trong lựa chọn hỗn hợp số + công thức", () => {
    const { container } = render(<RichText text="$\\sqrt{2}$." inline />);
    expect(container.querySelector(".katex")).not.toBeNull();
  });

  it("vẫn giữ định dạng inline (đậm/nghiêng) trong lựa chọn", () => {
    const { container } = render(<RichText text="**Đúng** với mọi x" inline />);
    expect(container.querySelector("strong")?.textContent).toBe("Đúng");
  });

  it("KHÔNG đụng tới chế độ block: thân câu hỏi vẫn dựng được danh sách", () => {
    const { container } = render(<RichText text={"1. Một\n2. Hai"} />);
    expect(container.querySelectorAll("ol li")).toHaveLength(2);
  });
});
