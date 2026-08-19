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
import userEvent from "@testing-library/user-event";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
  // plan Task 4.5 runs the REAL `checkout/page.tsx`, which redirects a guest.
  // These cases are signed in, so a call here would be a defect rather than a
  // path — and it THROWS, exactly as the real one does, instead of returning.
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  },
}));
vi.mock("@/lib/billing/orderActions", () => ({ recheckOrder: vi.fn() }));

// ── plan Task 4.5 — the request-scoped edges of the real checkout page ──────
// Stubbed: the auth read, the order read, the locale cookie and `server-only` —
// the same four every page test in this repository stubs, none of which the
// legal gate is a function of. NOT stubbed, deliberately: the dictionary, the
// predicate, C-15 itself, and both legal pages. Mocking any of those would
// remove exactly the drift protection this task exists to install.
const { getCurrentUserMock, getMyOrderMock, cookieGetMock } = vi.hoisted(() => ({
  getCurrentUserMock: vi.fn(),
  getMyOrderMock: vi.fn(),
  cookieGetMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: cookieGetMock }) }));
vi.mock("@/lib/auth/getCurrentUser", () => ({ getCurrentUser: getCurrentUserMock }));
vi.mock("@/app/(billing)/queries", () => ({ getMyOrder: getMyOrderMock }));

import { recheckOrder } from "@/lib/billing/orderActions";
import { en } from "@/lib/i18n/dictionaries/en";
import { LegalContentPending } from "@/components/billing/LegalDocument";
import { isPaidTierEnabled } from "@/lib/billing/paidTier";
import { renderServerTree } from "../../../me/orders/__tests__/renderServerTree";
import RefundPolicyPage from "../../../refund-policy/page";
import TermsPage from "../../../terms/page";
import CheckoutPage from "../page";
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

    // …and they are those keys THEMSELVES, not look-alikes. The two lines above
    // also accept `billing.terms.bodyText`, and a predicate wired to a key PRD
    // U3 will never add is false FOREVER — the gate then never opens, and while
    // neither key exists no behavioural case can tell the two apart (added by
    // plan Task 4.5 after that mutant survived every case in this file).
    // Comments are stripped first: this file's own prose quotes the real keys.
    const pageCode = files.page.replace(/\/\*[\s\S]*?\*\//g, "");
    expect(pageCode).toMatch(/"billing\.terms\.body"/);
    expect(pageCode).toMatch(/"billing\.refund\.body"/);

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

// ═══════════════════════════════════════════════════════════════════════════
// plan Task 4.5 — the displaced proof obligation for R-9.
//
// WHY THE CASES BELOW RUN THE REAL PAGE INSTEAD OF PASSING A LITERAL PROP. The
// cases above prove what C-15 does with a `legalContentReady` it is HANDED. R-9
// is not about that: it is about where that boolean COMES FROM. A wrong wiring
// — `legalContentReady = isPaidTierEnabled()` — produces exactly the same
// `false` today as the correct one, so no amount of prop-level testing can tell
// them apart. The only place the two differ is inside `checkout/page.tsx`, so
// that is what these cases execute.
//
// AND THE PROP VALUE IS READ, NOT RE-DERIVED. `elementsOfType()` walks the
// page's UNRENDERED element tree and reads the `legalContentReady` the shipped
// page actually passes to C-15. Recomputing `KEYS.every((k) => k in en)` in the
// test would assert the test against itself and survive every mutant here.
// ═══════════════════════════════════════════════════════════════════════════

type ConfirmProps = Parameters<typeof PaymentConfirm>[0];

/** Every element of `type` in an unrendered tree, in document order.
 *
 *  Returns a LIST, and every caller asserts its length, because "no match" and
 *  "the match I meant" are indistinguishable once a `?.props` read is taken: a
 *  renamed component or a moved mount would otherwise quietly turn every
 *  assertion below into an assertion about `undefined`. */
function elementsOfType<P>(node: ReactNode, type: unknown): ReactElement<P>[] {
  if (Array.isArray(node)) {
    return node.flatMap((child: ReactNode) => elementsOfType<P>(child, type));
  }
  if (!isValidElement(node)) return [];
  const here = node.type === type ? [node as unknown as ReactElement<P>] : [];
  const { children } = node.props as { children?: ReactNode };
  return [...here, ...elementsOfType<P>(children, type)];
}

/** `status: "pending"` because that is the only status under which `page.tsx`
 *  mounts C-15 at all (`isPayable()`, C-13). The other seven fields are the
 *  `CheckoutOrder` contract; none of them touches the legal gate. */
const PENDING_ORDER = {
  orderCode: ORDER_CODE,
  amountVnd: 39000,
  status: "pending",
  pendingUntil: "2099-11-30T23:59:59.000Z",
  qrPayload: "00020101021238570010A00000072701270006970422",
  accountNumber: "0123456789",
  accountName: "TRANG NGUYEN DIGI",
  memo: `MSM${ORDER_CODE}`,
};

/** The real page, with only its request-scoped edges stubbed. */
async function renderCheckoutPage() {
  return CheckoutPage({ searchParams: Promise.resolve({ order: String(ORDER_CODE) }) });
}

function confirmMountedBy(tree: ReactNode): ConfirmProps {
  const mounts = elementsOfType<ConfirmProps>(tree, PaymentConfirm);
  // Exactly one, asserted before anything is read off it.
  expect(mounts.length).toBe(1);
  return mounts[0].props;
}

describe("C-15 legal gate — R-9, where the predicate COMES FROM (plan Task 4.5)", () => {
  beforeEach(() => {
    getCurrentUserMock.mockResolvedValue({ id: "00000000-0000-4000-8000-000000000001" });
    getMyOrderMock.mockResolvedValue(PENDING_ORDER);
    // `en` explicitly rather than by default, so the placeholder strings the
    // page half compares against are the ones this test names.
    cookieGetMock.mockReturnValue({ value: "en" });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // ==========================================================================
  // THE REQUIRED COMBINED CASE (frontend DD § Test Boundaries, C-15 row; § C-15
  // "Required unit case"). Both halves live in ONE test body, and that is the
  // whole point: split into two, each half keeps passing while the predicate
  // and the pages drift apart — precisely R-9's failure shape.
  //
  // It goes red on EITHER direction of the drift:
  //   • the two body keys land in `en.ts` while the pages still render the
  //     placeholder ⇒ the predicate flips to true, half one fails;
  //   • the pages ship real content while the keys never land ⇒ half two fails.
  // Rejects, today: a predicate hard-coded `true`; a predicate reading any key
  // other than the two the design names; a legal page that has quietly stopped
  // rendering `LegalContentPending` while the gate stayed shut.
  // ==========================================================================
  it("the shipped predicate is false AND both legal pages still render LegalContentPending", async () => {
    // ── half one: the predicate, as the shipped page actually passes it ─────
    const props = confirmMountedBy(await renderCheckoutPage());
    expect(props.legalContentReady).toBe(false);

    // ── half two: the two real pages, rendered ──────────────────────────────
    const terms = await TermsPage();
    const refund = await RefundPolicyPage();

    // Component identity first: `LegalContentPending` itself, not "some node
    // that happens to carry the placeholder text". Real legal content would
    // replace this element, and that must be what makes this test red.
    expect(elementsOfType(terms, LegalContentPending).length).toBe(1);
    expect(elementsOfType(refund, LegalContentPending).length).toBe(1);

    // …then the rendered DOM, because "present in the tree" and "reaches the
    // page" are different claims (a `return null` inside would satisfy only
    // the first). `toEqual([…])` pins the COUNT as well as the text.
    const placeholders = (container: HTMLElement) =>
      Array.from(container.querySelectorAll('[role="status"]')).map((node) =>
        (node.textContent ?? "").trim()
      );

    const termsDom = await renderServerTree(terms);
    const refundDom = await renderServerTree(refund);
    expect(placeholders(termsDom.container)).toEqual([en["billing.terms.pending"]]);
    expect(placeholders(refundDom.container)).toEqual([en["billing.refund.pending"]]);

    // AC-040's sentence is a product fact, not a legal clause, so it ships
    // ahead of PRD U3 — and its presence must not be mistaken for content.
    expect(refundDom.container.textContent ?? "").toContain(en["billing.noAutoRenew"]);
  });

  // ==========================================================================
  // THE R-9 KILL, and the one state that does not exist today: the paid tier
  // switched ON with the legal content still missing. `legalContentReady =
  // isPaidTierEnabled()` is indistinguishable from the shipped predicate in
  // every other world — both are false — and it flips to `true` right here,
  // mounting C-10 and handing a user a working "I have transferred" button
  // while /terms and /refund-policy are still placeholders.
  //
  // The live control is mounted from the props the REAL page produced, not
  // from a literal `false`. That is what couples the interactive half to the
  // wiring: a page that opened the gate mounts C-10 here, the click reaches
  // `recheckOrder()`, and the invocation count stops being zero.
  // ==========================================================================
  it("keeps the gate shut with the paid tier ON, and the shut control stays reachable and inert", async () => {
    vi.stubEnv("GEMINI_PAID_TIER_ENABLED", "1");
    // The `canPurchase === true` world is asserted, not assumed: without this
    // line the case could be passing against a flag that never turned on.
    expect(isPaidTierEnabled()).toBe(true);

    const props = confirmMountedBy(await renderCheckoutPage());
    expect(props.legalContentReady).toBe(false);

    const { container } = render(<PaymentConfirm {...props} />);
    const button = container.querySelector("button");
    if (!(button instanceof HTMLButtonElement)) throw new Error("C-15 rendered no button");

    // Announced, never blocked.
    expect(button.getAttribute("aria-disabled")).toBe("true");
    expect(button.hasAttribute("disabled")).toBe(false);
    expect(button.disabled).toBe(false);

    // TAB-REACHABLE, proven by a real Tab rather than by the absence of one
    // attribute: `tabindex="-1"`, `disabled`, `display:none` and an `inert`
    // ancestor each remove a present control from the tab order.
    expect(document.activeElement).toBe(document.body);
    await userEvent.tab();
    expect(document.activeElement).toBe(button);

    // NO-OP ACTIVATION, asserted as an INVOCATION COUNT. `aria-disabled`
    // announces; it does not stop a click, and a rendered attribute is not
    // evidence that nothing happened. Pointer and keyboard both, because a
    // focusable control is reached by keyboard first.
    await userEvent.click(button);
    await userEvent.keyboard("{Enter}");
    await userEvent.keyboard(" ");
    fireEvent.click(button);

    expect(mockRecheck.mock.calls.length).toBe(0);
    expect(refresh.mock.calls.length).toBe(0);
    // Nothing was set in motion either: C-10's busy state never appears,
    // because in this branch C-10 is not mounted at all.
    expect(container.querySelector("[aria-busy='true']")).toBeNull();
  });
});
