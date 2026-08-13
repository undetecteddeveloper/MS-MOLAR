// @vitest-environment jsdom
// No I18nProvider wrapping → useT() renders the "en" default strings.

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
    const textarea = screen.getByLabelText("Message") as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "x" } });
    expect(onChange).toHaveBeenCalledWith("x");
  });

  it("preserves the value verbatim when disabled (readOnly, not native disabled — stays focusable)", () => {
    render(<MessageField value="already typed" onChange={() => {}} error={null} disabled={true} />);
    const textarea = screen.getByLabelText("Message") as HTMLTextAreaElement;
    expect(textarea.value).toBe("already typed");
    expect(textarea.disabled).toBe(false); // native disabled would break focus/AT discoverability
    expect(textarea.readOnly).toBe(true);
  });

  it("renders the validation error as role=alert linked via aria-describedby", () => {
    render(<MessageField value="" onChange={() => {}} error="Please enter a message." disabled={false} />);
    expect(screen.getByRole("alert").textContent).toBe("Please enter a message.");
    const textarea = screen.getByLabelText("Message");
    expect(textarea.getAttribute("aria-describedby")).toBe(screen.getByRole("alert").id);
  });
});
