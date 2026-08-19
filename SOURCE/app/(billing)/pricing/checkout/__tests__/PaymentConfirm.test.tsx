// @vitest-environment jsdom

// C-15 `PaymentConfirm` — plan Task 4.3.
// UI Spec:  docs/ui-spec/subscription-ui-spec.md § Component: `PaymentConfirm` — C-15
// Design:   docs/design/subscription-frontend-design.md § C-15, Decision (E2),
//           FE-AC-18, Risk R-9
//
// WHAT THIS FILE IS FOR, IN ONE SENTENCE: `GEMINI_PAID_TIER_ENABLED` is off and
// the legal content is missing, both locks are closed today, and the ONLY way
// to tell the two apart is to check that the legal gate holds on its own. R-9
// is the highest-consequence guess in the frontend design: wire the predicate
// to `isPaidTierEnabled()` and the legal gate disappears at the exact moment
// the flag is switched on.
//
// THE GATE IS ASSERTED ON WHAT A USER CAN DO, NOT ON AN ATTRIBUTE. `aria-disabled`
// ANNOUNCES; it does not block a DOM click. So the load-bearing assertion below
// is the INVOCATION COUNT of the action after a real click — zero.
//
// Native `disabled` is forbidden in every state (frontend DD, Applicable
// Standards): a user must be able to REACH the control to learn why it is
// unavailable. Hence the shipped assertion pair — `hasAttribute("disabled")`
// AND `.disabled` — plus a real focus check.
//
// Mock boundary: only the action module and `next/navigation`. The dictionary,
// `Button` and C-10 itself run for real.
//
// The combined "predicate is false for the shipped dictionary AND both legal
// pages still render LegalContentPending" case belongs to plan Task 4.5 and is
// deliberately NOT written here.

import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/lib/billing/orderActions", () => ({ recheckOrder: vi.fn() }));

import { recheckOrder } from "@/lib/billing/orderActions";
import { en } from "@/lib/i18n/dictionaries/en";
import { PaymentConfirm } from "../_components/PaymentConfirm";

const mockRecheck = vi.mocked(recheckOrder);
const ORDER_CODE = 3100000000002;

function mount(props: { legalContentReady: boolean; status?: string }) {
  const { container } = render(
    <PaymentConfirm
      orderCode={ORDER_CODE}
      status={props.status ?? "pending"}
      legalContentReady={props.legalContentReady}
    />
  );
  const button = container.querySelector("button");
  if (!(button instanceof HTMLButtonElement)) throw new Error("C-15 rendered no button");
  return { container, button };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRecheck.mockResolvedValue({ settled: false, reason: "not_paid_yet" });
});

afterEach(cleanup);

describe("C-15 PaymentConfirm — the legal gate is CLOSED (TBD-02 / BU-1 open)", () => {
  // ==========================================================================
  // FE-AC-18, the whole obligation in one case. Rejects: an implementation
  // that mounts C-10 regardless of the gate (the user could then confirm a
  // payment while /terms and /refund-policy are placeholders); one that uses
  // native `disabled` (the control drops out of the tab order and the user
  // never reads the reason — a bug this repository has already fixed twice);
  // one that hides the control entirely (nothing left to read).
  // ==========================================================================
  it("renders a control that is announced disabled, still focusable, and does nothing", () => {
    const { button } = mount({ legalContentReady: false });

    // ANNOUNCED, not blocked: the string "true", never the boolean attribute.
    expect(button.getAttribute("aria-disabled")).toBe("true");
    expect(button.hasAttribute("disabled")).toBe(false);
    expect(button.disabled).toBe(false);
    expect(button.getAttribute("tabindex")).not.toBe("-1");

    // Reachable: a real focus, checked through document.activeElement.
    button.focus();
    expect(document.activeElement).toBe(button);

    // THE LOAD-BEARING ASSERTION: activation performs NO action.
    fireEvent.click(button);
    fireEvent.click(button);
    expect(mockRecheck).toHaveBeenCalledTimes(0);
    expect(refresh).toHaveBeenCalledTimes(0);
  });

  // ==========================================================================
  // Rejects: a gate that goes silent — an inert control with no stated reason
  // is indistinguishable from a broken page. The reason is asserted by its
  // TEXT and by the `aria-describedby` wiring, because either half alone can
  // be satisfied while the user learns nothing.
  // ==========================================================================
  it("says why, in words, and binds the sentence to the control", () => {
    const { container, button } = mount({ legalContentReady: false });

    const describedBy = button.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    const reason = container.querySelector(`#${describedBy}`);
    if (reason === null) throw new Error("aria-describedby points at no element");
    expect((reason.textContent ?? "").trim()).toBe(en["billing.confirm.legalPending.reason"]);

    // The reason is on the screen, not only in the accessibility tree: a
    // sighted user has to be able to read it too.
    expect(container.textContent ?? "").toContain(en["billing.confirm.legalPending.reason"]);
    // And the control still says what it WOULD do.
    expect(button.textContent).toContain(en["billing.confirm.action"]);
  });

  // ==========================================================================
  // TWO INDEPENDENT LOCKS. Rejects: a gated branch that borrows C-10's
  // terminal-status reason ("this order is already closed") — a true sentence
  // about a different fact, which would tell a user with a perfectly live
  // order that their order is dead.
  // ==========================================================================
  it("gives the legal reason, not the closed-order reason, even on a closed order", () => {
    const { container } = mount({ legalContentReady: false, status: "paid" });
    const text = container.textContent ?? "";

    expect(text).toContain(en["billing.confirm.legalPending.reason"]);
    expect(text).not.toContain(en["billing.recheck.notPending"]);
  });
});

describe("C-15 PaymentConfirm — the legal gate is OPEN", () => {
  // ==========================================================================
  // The complement, and it is what makes the gated case mean something: with
  // the gate open the control is C-10 itself and it really does act. Rejects:
  // a permanently inert control that would pass every assertion above while
  // never letting anybody pay; a wrapper that issues its own "I paid" mutation
  // instead of delegating to active reconciliation (ADR-0014).
  // ==========================================================================
  it("delegates to the re-check control, which performs the real action", () => {
    const { button } = mount({ legalContentReady: true });

    expect(button.getAttribute("aria-disabled")).toBe("false");
    expect(button.textContent).toContain(en["billing.confirm.action"]);

    fireEvent.click(button);
    expect(mockRecheck).toHaveBeenCalledTimes(1);
    expect(mockRecheck).toHaveBeenCalledWith(ORDER_CODE);
  });

  // ==========================================================================
  // The `status` prop is forwarded, not invented. Rejects: a wrapper that drops
  // it — C-10 would then treat a settled order as activatable and fire a
  // pointless provider round trip; and one that hard-codes it to "pending",
  // which is the same defect wearing a literal.
  // ==========================================================================
  it("forwards the row's status so a terminal order stays inert", () => {
    const { button } = mount({ legalContentReady: true, status: "paid" });

    expect(button.getAttribute("aria-disabled")).toBe("true");
    expect(button.hasAttribute("disabled")).toBe(false);

    fireEvent.click(button);
    expect(mockRecheck).toHaveBeenCalledTimes(0);
  });

  // ==========================================================================
  // …and an UNRECOGNISED status is NOT terminal (FE-AC-10): re-checking is the
  // only action that can resolve it. Rejects: a wrapper that gates on
  // `status !== "pending"`, which would lock the one control that can fix it.
  // ==========================================================================
  it("leaves an unrecognised status activatable", () => {
    const { button } = mount({ legalContentReady: true, status: "refunded" });

    expect(button.getAttribute("aria-disabled")).toBe("false");
    fireEvent.click(button);
    expect(mockRecheck).toHaveBeenCalledTimes(1);
  });
});

describe("C-15 PaymentConfirm — R-9: the two locks stay independent", () => {
  // ==========================================================================
  // The failure this case exists for cannot be observed at runtime today,
  // because both locks are closed at once — which is precisely why R-9 calls it
  // the highest-consequence guess in the design. So it is asserted on source
  // text, at BOTH ends of the wire: the control must not reach for the release
  // flag, and the page that computes the predicate must not derive it from one.
  //
  // Anchors are asserted to MATCH FIRST; otherwise a renamed file would make
  // every prohibition below pass against nothing.
  // ==========================================================================
  it("names the release flag nowhere in C-15 or in the page that computes the predicate", () => {
    const files = {
      confirm: readFileSync(
        join(import.meta.dirname, "..", "_components", "PaymentConfirm.tsx"),
        "utf8"
      ),
      page: readFileSync(join(import.meta.dirname, "..", "page.tsx"), "utf8"),
    };

    expect(files.confirm).toContain("export function PaymentConfirm");
    expect(files.page).toContain("legalContentReady");

    for (const [name, src] of Object.entries(files)) {
      const code = src
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .split("\n")
        .filter((line) => !line.trimStart().startsWith("//"))
        .join("\n");
      expect(`${name}:${code}`).not.toContain("isPaidTierEnabled");
      expect(`${name}:${code}`).not.toContain("paidTier");
      expect(`${name}:${code}`).not.toContain("GEMINI_PAID_TIER_ENABLED");
      expect(`${name}:${code}`).not.toContain("process.env");
    }

    // The predicate is the two dictionary keys and nothing else (C-15's rule).
    expect(files.page).toContain("billing.terms.body");
    expect(files.page).toContain("billing.refund.body");

    // BOTH keys, not either — and behaviour alone cannot enforce that today.
    // While NEITHER key exists, `every` and `some` return the same false, so
    // swapping them is an equivalent mutation no black-box case can kill. They
    // diverge in exactly one situation: the half-landed state where PRD U3 has
    // added ONE of the two bodies. `some` would open the payment gate there,
    // with one legal page still a placeholder — so the rule is asserted
    // directly, the same way the route's parse asserts "never parseInt".
    expect(files.page).toMatch(/LEGAL_BODY_KEYS\.every\(/);
    expect(files.page).not.toMatch(/LEGAL_BODY_KEYS\.some\(/);
  });
});
