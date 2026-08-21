// @vitest-environment jsdom

// ExplainStepAffordance — trạng thái PAYWALL (hết hạn mức kỳ).
// UI Spec: docs/ui-spec/subscription-ui-spec.md — C-05, UI-D2, UI-D3.
// PRD: docs/prd/subscription-prd.md — AC-014, AC-015, AC-041.
//
// Vì sao là file riêng chứ không thêm vào ExplainStepAffordance.test.tsx: file
// kia thuộc Engine 1 và mang ngân sách test riêng của tính năng đó cùng phần
// đầu giải thích ranh giới mock của nó. Trộn vào sẽ làm một tính năng khác gánh
// các ca của tính năng này, và làm mờ mất khẳng định hồi quy quan trọng nhất ở
// đây — rằng pha này KHÔNG đụng gì tới hành vi cũ.
//
// Ranh giới mock giống hệt file kia: chỉ mock Server Action `explainStep`.
// Không có setup file nên không có matcher jest-dom; đọc thẳng DOM và bám
// `container` của từng lần render.

import { render, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ExplainStepAffordance } from "./ExplainStepAffordance";
import { EntitlementProvider } from "@/lib/billing/entitlement";
import { FREE_FALLBACK, type Entitlement } from "@/lib/billing/types";

vi.mock("@/app/(layer2)/tutorActions", () => ({
  explainStep: vi.fn(),
}));

import { explainStep } from "@/app/(layer2)/tutorActions";

const mockExplainStep = vi.mocked(explainStep);

const ATTEMPT_ID = "attempt-fixture-333";
const QUESTION_ID = "question-fixture-444";

const IDLE_LABEL = "Explain this step"; // tutor.explainThisStep (en)
const EXHAUSTED_COPY = "You've used all your tutor hints for this period."; // billing.quota.tutorExhausted
const UPGRADE_LABEL = "See plans"; // billing.quota.upgradeLink
const GENERIC_ERROR = "Couldn't load a hint. Try again."; // tutor.error (en)

function renderWith(entitlement: Entitlement) {
  return render(
    <EntitlementProvider value={entitlement}>
      <ExplainStepAffordance attemptId={ATTEMPT_ID} questionId={QUESTION_ID} />
    </EntitlementProvider>
  );
}

const exhausted = (plan: "free" | "premium", limit: number): Entitlement => ({
  ...FREE_FALLBACK,
  plan,
  tutor: { state: "known", used: limit, limit, resetsAt: "2026-09-15T00:00:00.000Z" },
});

describe("hết hạn mức kỳ → không có nút, không có lời gọi nào", () => {
  it("Free đã dùng 5/5: hiện lý do + lối nâng cấp, KHÔNG có nút gia sư (AC-014)", () => {
    const { container } = renderWith(exhausted("free", 5));
    const q = within(container);

    expect(q.queryByRole("button")).toBeNull();
    expect(q.getByText(EXHAUSTED_COPY)).toBeTruthy();

    const link = q.getByRole("link", { name: UPGRADE_LABEL });
    expect(link.getAttribute("href")).toBe("/pricing");
  });

  it("KHÔNG gọi explainStep lần nào ở ca bị chặn — 0 request tới Gemini (AC-014)", () => {
    mockExplainStep.mockClear();
    renderWith(exhausted("free", 5));
    // Đây là nửa mà PRD đếm được: chặn ở UI phải chặn TRƯỚC lời gọi, không phải
    // hiển thị đẹp hơn sau khi đã tiêu một request.
    expect(mockExplainStep).not.toHaveBeenCalled();
  });

  it("Premium vượt 500 nhận CÙNG một trạng thái, không phải một thông điệp riêng (AC-015)", () => {
    const { container } = renderWith(exhausted("premium", 500));
    const q = within(container);
    expect(q.queryByRole("button")).toBeNull();
    expect(q.getByText(EXHAUSTED_COPY)).toBeTruthy();
  });

  it("thông điệp hết lượt KHÁC HẲN chuỗi lỗi chung (AC-041)", () => {
    const { container } = renderWith(exhausted("free", 5));
    // Cốt lõi của AC-041: hôm nay "hết lượt" và "hệ thống hỏng" trông y hệt
    // nhau. Sau thay đổi này thì không.
    expect(within(container).queryByText(GENERIC_ERROR)).toBeNull();
    expect(EXHAUSTED_COPY).not.toBe(GENERIC_ERROR);
  });

  it("vùng chạm của lối nâng cấp đạt sàn 44px", () => {
    const { container } = renderWith(exhausted("free", 5));
    const link = within(container).getByRole("link", { name: UPGRADE_LABEL });
    // Không có size nào của Button đạt 44px nên mọi đích chạm trong repo đều
    // phải override — ghim lại để lần refactor sau không đánh rơi.
    expect(link.className).toContain("min-h-11");
  });
});

describe("hạn mức `unknown` KHÔNG được chặn ai (UI-D2 — hướng fail-OPEN)", () => {
  it("FREE_FALLBACK (trạng thái của mọi người trong pha UI) vẫn render nút bình thường", () => {
    const { container } = renderWith(FREE_FALLBACK);
    const button = within(container).getByRole("button");
    expect(button.textContent).toContain(IDLE_LABEL);
    // Khẳng định hồi quy quan trọng nhất của cả pha: stub quyền lợi KHÔNG được
    // phép tắt gia sư Engine 1 đang chạy. Nếu `unknown` bị quy về 0 "cho an
    // toàn" thì test này đỏ — và nó nên đỏ.
    expect(container.textContent).not.toContain(EXHAUSTED_COPY);
  });

  it("không có provider (ca unit test của component khác) cũng không chặn", () => {
    const { container } = render(
      <ExplainStepAffordance attemptId={ATTEMPT_ID} questionId={QUESTION_ID} />
    );
    expect(within(container).getByRole("button").textContent).toContain(IDLE_LABEL);
  });

  it("còn lượt (4/5) thì vẫn là nút, không phải trạng thái chặn", () => {
    const { container } = renderWith({
      ...FREE_FALLBACK,
      tutor: { state: "known", used: 4, limit: 5, resetsAt: "2026-09-15T00:00:00.000Z" },
    });
    expect(within(container).getByRole("button").textContent).toContain(IDLE_LABEL);
  });
});

describe("không dùng `disabled` gốc ở bất kỳ trạng thái nào", () => {
  it("trạng thái chặn không dựng một nút bị disabled — nó không dựng nút nào cả", () => {
    const { container } = renderWith(exhausted("free", 5));
    // Con bug đã phải sửa hai lần trong repo (RateButton, ActionButton): nút
    // `disabled` rơi khỏi thứ tự tab nên người dùng bàn phím không tới được để
    // ĐỌC lý do. Ở đây giải bằng cách không có nút — lý do là văn bản thường,
    // và lối đi tiếp là một liên kết thật, focus được.
    expect(container.querySelector("button[disabled]")).toBeNull();
    const link = within(container).getByRole("link", { name: UPGRADE_LABEL });
    link.focus();
    expect(document.activeElement).toBe(link);
  });
});
