// @vitest-environment jsdom
// Không bọc I18nProvider → useT() render các chuỗi mặc định "en".

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MessageField } from "@/components/support/MessageField";
import { LIMITS } from "@/lib/ugc/limits";

afterEach(cleanup);

describe("MessageField", () => {
  it("renders the live {count}/{max} counter reflecting the current value", () => {
    render(<MessageField value="hello" onChange={() => {}} error={null} disabled={false} />);
    expect(screen.getByText(`5/${LIMITS.MAX_SUPPORT_MESSAGE}`)).toBeDefined();
  });

  it("typing calls onChange with the new value", () => {
    const onChange = vi.fn();
    render(<MessageField value="" onChange={onChange} error={null} disabled={false} />);
    const textarea = screen.getByLabelText("Nội dung") as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "x" } });
    expect(onChange).toHaveBeenCalledWith("x");
  });

  it("preserves the value verbatim when disabled (readOnly, not native disabled — stays focusable)", () => {
    render(<MessageField value="already typed" onChange={() => {}} error={null} disabled={true} />);
    const textarea = screen.getByLabelText("Nội dung") as HTMLTextAreaElement;
    expect(textarea.value).toBe("already typed");
    expect(textarea.disabled).toBe(false); // `disabled` gốc sẽ làm mất khả năng focus/khám phá bằng công nghệ hỗ trợ
    expect(textarea.readOnly).toBe(true);
  });

  it("renders the validation error as role=alert linked via aria-describedby", () => {
    render(<MessageField value="" onChange={() => {}} error="Vui lòng nhập nội dung." disabled={false} />);
    expect(screen.getByRole("alert").textContent).toBe("Vui lòng nhập nội dung.");
    const textarea = screen.getByLabelText("Nội dung");
    expect(textarea.getAttribute("aria-describedby")).toBe(screen.getByRole("alert").id);
  });
});
