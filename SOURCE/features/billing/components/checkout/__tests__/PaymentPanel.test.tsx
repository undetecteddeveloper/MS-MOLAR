// @vitest-environment jsdom

// C-13 `PaymentPanel` — plan Task 4.3.
// UI Spec:  docs/ui-spec/subscription-ui-spec.md § Component: `PaymentPanel` — C-13
//           (Empty/Partial sets as amended at v1.6, plan Task 0.6 — LO-01/LO-02)
// Design:   docs/design/subscription-frontend-design.md § C-13, § Affordances,
//           FE-AC-15 / FE-AC-19 / FE-AC-21
//
// THE ONE CLAIM THAT MOVES MONEY: every money-moving affordance is gated on
// `status === "pending"` and on NOTHING ELSE. Showing transfer instructions for
// a settled, dead or not-understood order invites a SECOND payment, so the
// Partial table below carries all four non-pending cases — including a status
// this specification does not recognise, which is the case a `status !== "paid"`
// style predicate silently gets wrong.
//
// THE SECOND CLAIM: the screen stays completable with the QR ABSENT. ADR-0018
// is open, so C-12 renders nothing today — and this file asserts the four
// transfer pairs are there anyway. Any implementation that hides the text block
// with the QR has already failed AC-028.
//
// `pendingUntil` is an instant on a DIFFERENT CALENDAR DAY in UTC (18 Aug
// 17:30Z) than in ICT (19 Aug 00:30). Recorded limitation: this machine sits in
// Asia/Saigon, the zone `lib/format/datetime.ts` pins, so this fixture cannot
// by itself distinguish a pinned formatter from an unpinned one HERE — the
// past-deadline case below is what makes the value provably the ROW's.
//
// C-10 and C-09 are real client components inside the tree; only `useRouter()`
// is stubbed, exactly as the shipped S-06 page test does it.

import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import { renderServerTree } from "@/app/(billing)/me/orders/__tests__/renderServerTree";
import type { CheckoutOrder } from "@/lib/billing/checkoutOrder";
import { en } from "@/lib/i18n/dictionaries/en";
import { isPayable, PaymentPanel } from "@/features/billing/components/checkout/PaymentPanel";

// All eight fields carry DIFFERENT values; the four text fields are four
// distinguishable strings, so a swap between any two of them is visible.
const ORDER: CheckoutOrder = {
  orderCode: 3100000000002,
  amountVnd: 39000,
  status: "pending",
  pendingUntil: "2026-08-18T17:30:00.000Z", // 19/08/2026 00:30 in ICT
  qrPayload: "00020101021238QRPAYLOAD5802VN",
  accountNumber: "19001234567890",
  accountName: "CONG TY MS MOLAR",
  memo: "MSMOLAR3100000000002",
};

async function render(order: CheckoutOrder) {
  const { container } = await renderServerTree(await PaymentPanel({ order }));
  return { container, text: container.textContent ?? "" };
}

describe("C-13 isPayable — the single gate", () => {
  // ==========================================================================
  // Rejects: `status !== "paid"`, `!TERMINAL.has(status)`, and every other
  // predicate that agrees with the rule on the three known closed statuses and
  // disagrees on an unrecognised one — the row FE-AC-19 exists to protect.
  // ==========================================================================
  it("admits `pending` and nothing else", () => {
    expect(isPayable("pending")).toBe(true);
    for (const closed of ["paid", "expired", "cancelled", "refunded", "PENDING", "", " pending "]) {
      expect(isPayable(closed)).toBe(false);
    }
  });
});

describe("C-13 PaymentPanel — Default (a pending order)", () => {
  // ==========================================================================
  // FE-AC-15 / AC-028, the proof obligation of this task: the encoder is
  // absent, so C-12 renders nothing — and the screen is STILL payable from
  // text. Rejects: a panel that throws when the QR is missing; one that hides
  // the transfer block together with the QR; one that renders a broken image.
  // ==========================================================================
  it("renders the whole transfer block while the QR renders nothing", async () => {
    const { container, text } = await render(ORDER);

    // The QR side: absent, and absent QUIETLY. Selected by the QR's own
    // `role="img"` rather than by tag name — a decorative lucide icon is an
    // <svg> too, and counting tags would make this assertion mean something
    // else the moment a button appears in the tree.
    expect(container.querySelectorAll('svg[role="img"]')).toHaveLength(0);
    expect(container.querySelectorAll("img")).toHaveLength(0);

    // The text side: all four values, unabbreviated.
    for (const value of ["19001234567890", "CONG TY MS MOLAR", "39,000 VND", "MSMOLAR3100000000002"]) {
      expect(text).toContain(value);
    }
    expect(container.querySelectorAll("dl")).toHaveLength(1);
    expect(container.querySelectorAll("dd")).toHaveLength(4);
    expect(text).toContain(en["billing.checkout.memoWarning"]);
  });

  // ==========================================================================
  // AC-026 + the C-08 reference contract. Rejects: a grouped, abbreviated or
  // localised order code — the user reads this number aloud to support.
  // ==========================================================================
  it("prints the order code as a raw digit string", async () => {
    const { text } = await render(ORDER);

    expect(text).toContain("3100000000002");
    for (const grouped of ["3,100,000,000,002", "3.100.000.000.002", "3 100 000 000 002", "3.1e+12"]) {
      expect(text).not.toContain(grouped);
    }
  });

  // ==========================================================================
  // FE-AC-21: an ABSOLUTE time taken from the ROW. Rejects: a live countdown
  // (a per-second region is precisely what must never be announced); a raw ISO
  // string dumped on screen; `created_at + 30 min` recomputed on the screen.
  // ==========================================================================
  it("renders the row's deadline as an absolute time, not a countdown", async () => {
    const { container, text } = await render(ORDER);

    expect(text).toContain("19/08/2026 00:30");
    expect(text).not.toContain("2026-08-18T17:30:00.000Z");
    // No live region anywhere on this screen (frontend DD § Accessibility).
    expect(container.querySelectorAll("[aria-live]")).toHaveLength(0);
  });

  // ==========================================================================
  // THE DEADLINE IS THE ROW'S, AND THIS IS THE CASE THAT PROVES IT. A panel
  // that computed "now + 30 minutes" would render a FUTURE time here; a panel
  // that hid the payment surface once the deadline passed would render nothing.
  // The UI Spec states the consequence explicitly: a screen left open past
  // `pendingUntil` keeps showing the offer, and the re-check control is the
  // resolution.
  // ==========================================================================
  it("keeps rendering a past deadline verbatim instead of restarting it", async () => {
    const { text } = await render({ ...ORDER, pendingUntil: "2020-01-01T17:30:00.000Z" });

    expect(text).toContain("02/01/2020 00:30");
    expect(text).toContain("19001234567890"); // still payable from text
    expect(text).not.toContain("19/08/2026");
  });
});

describe("C-13 PaymentPanel — Partial (every non-pending status)", () => {
  const PARTIAL: Array<{ status: string; word: string; why: string }> = [
    { status: "paid", word: en["billing.status.paid"], why: "a settled order must never invite a second payment" },
    { status: "expired", word: en["billing.status.expired"], why: "the QR is no longer offered" },
    { status: "cancelled", word: en["billing.status.cancelled"], why: "the order is dead" },
    {
      status: "refunded",
      word: en["billing.status.unrecognised"],
      why: "UI-D15's fifth case — a value this specification does not recognise, and the row a `!== paid` predicate gets wrong",
    },
  ];

  for (const row of PARTIAL) {
    // ========================================================================
    // FE-AC-19. Rejects: a panel that renders the QR or the transfer block for
    // a non-payable order; one that reads an unrecognised status as `pending`;
    // one that drops the order code, the status word or the way to /me/orders.
    // ========================================================================
    it(`renders neither QR nor transfer block for "${row.status}" — ${row.why}`, async () => {
      const { container, text } = await render({ ...ORDER, status: row.status });

      expect(container.querySelectorAll("dl")).toHaveLength(0);
      expect(container.querySelectorAll('svg[role="img"]')).toHaveLength(0);
      expect(container.querySelectorAll("img")).toHaveLength(0);
      for (const secret of ["19001234567890", "CONG TY MS MOLAR", "MSMOLAR3100000000002"]) {
        expect(text).not.toContain(secret);
      }
      expect(text).not.toContain(en["billing.checkout.memoWarning"]);

      // What renders INSTEAD.
      expect(text).toContain(row.word);
      expect(text).toContain("3100000000002");
      const back = container.querySelector('a[href="/me/orders"]');
      if (back === null) throw new Error("the Partial state offers no link to /me/orders");
      expect((back.textContent ?? "").trim().length).toBeGreaterThan(0);

      // UI-D15: re-checking is the ONLY action that can resolve an
      // unrecognised status, so the control stays mounted in every case.
      expect(container.querySelectorAll("button").length).toBeGreaterThan(0);
      // …and it never carries the confirm-payment label: "I have transferred"
      // is a false sentence on an order that is already closed.
      expect(text).not.toContain(en["billing.confirm.action"]);
      expect(text).toContain(en["billing.recheck.action"]);
    });
  }

  // ==========================================================================
  // The status word is the one C-09 chose, not a second table. Rejects: a
  // panel that prints the raw database value ("refunded") to the user, or that
  // coerces an unknown value onto a permitted one.
  // ==========================================================================
  it("never shows a raw unrecognised status value to the user", async () => {
    const { text } = await render({ ...ORDER, status: "refunded" });

    expect(text).not.toContain("refunded");
    expect(text).not.toContain(en["billing.status.pending"]);
    expect(text).not.toContain(en["billing.status.paid"]);
  });
});
