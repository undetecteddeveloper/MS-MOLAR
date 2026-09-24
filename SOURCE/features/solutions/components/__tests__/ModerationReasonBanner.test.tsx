// @vitest-environment jsdom

// ModerationReasonBanner — biến thể `status` (task 08, hành vi giữ nguyên) và
// biến thể `alert` mới (task 10, AC-083): `role="alert"`, nguyên văn
// `solutions.hiddenBanner`, và `id` gắn được để `SolutionSettingsPanel`'s
// `lockReasonId` trỏ vào.

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ModerationReasonBanner } from "@/features/solutions/components/ModerationReasonBanner";

afterEach(cleanup);

describe("ModerationReasonBanner — variant mặc định (status, task 08 không đổi)", () => {
  it("role=status, nguyên văn 'đã bị gỡ'", () => {
    render(<ModerationReasonBanner reason="spam" />);
    const el = screen.getByRole("status");
    expect(el.textContent).toBe("Bài giải của bạn đã bị gỡ: spam");
  });
});

describe("ModerationReasonBanner — variant alert (task 10, AC-083)", () => {
  it("role=alert, nguyên văn hiddenBanner, mang id truyền vào", () => {
    render(<ModerationReasonBanner variant="alert" reason="ngôn từ không phù hợp" id="lock-1" />);
    const el = screen.getByRole("alert");
    expect(el.textContent).toBe("Bài giải của bạn đã bị ẩn bởi quản trị viên. Lý do: ngôn từ không phù hợp");
    expect(el.id).toBe("lock-1");
  });
});
