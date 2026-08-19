// @vitest-environment jsdom

// C-07 OrderList — plan Task 3.6.
// UI Spec:  docs/ui-spec/subscription-ui-spec.md § Component: `OrderList` — C-07
//           (State × Display: default / empty / partial-unrecognised-status)
// Design:   docs/design/subscription-frontend-design.md § Main Components — C-07
//
// Fixture values are DELIBERATELY different from page.test.tsx's: two files
// asserting two different things must not be able to pass by copying one
// expectation into the other.
//
// MOCK BOUNDARY — only `server-only` and next/headers' `cookies()` (both need a
// request scope). OrderRow, OrderStatusBadge, the dictionary and the formatters
// are REAL, so the copy asserted below is the copy that ships.
//
// No setupFiles ⇒ no jest-dom matchers. Rendering goes through
// renderServerTree() — C-07 renders an async C-08, which React 19's client
// renderer cannot resolve — into a detached container, so there is nothing to
// clean up between cases.

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { cookieGetMock } = vi.hoisted(() => ({ cookieGetMock: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: cookieGetMock }) }));

// C-10 (mounted by C-08, one per row) calls `useRouter()`, which throws
// "invariant expected app router to be mounted" outside a real app-router tree.
// Stubbed with the same one-method shape the shipped client-component tests use
// (ProfileCard.test.tsx, DisplayNameEditor.test.tsx); C-10 itself is REAL.
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import { OrderList } from "../_components/OrderList";
import { renderServerTree } from "./renderServerTree";

// Copy authored here from the UI Spec's intent, independently of en.ts, so a
// silent dictionary edit fails this test instead of being re-derived into
// agreement with itself.
const EMPTY_LINE = "You have not placed an order yet."; // billing.orders.empty
const EMPTY_HINT = "An order appears here as soon as you buy a Premium period."; // billing.orders.emptyHint
const PLANS_LINK = "See plans"; // billing.quota.upgradeLink — the shipped /pricing link label

const WORD_PENDING = "Awaiting payment"; // billing.status.pending
const WORD_PAID = "Paid"; // billing.status.paid
const WORD_UNRECOGNISED = "Unrecognised"; // billing.status.unrecognised

const ROW_A = {
  orderCode: 7200000000011,
  amountVnd: 39000,
  status: "pending",
  createdAt: "2026-08-18T17:30:00+00:00",
  pendingUntil: "2099-11-30T23:59:59+00:00", // ≠ createdAt: a swap must be visible
};
// The Partial column: a status outside the four the CHECK constraint permits.
const ROW_UNRECOGNISED = {
  orderCode: 4200000000022,
  amountVnd: 117000,
  status: "refunded",
  createdAt: "2026-08-12T03:20:00+00:00",
  pendingUntil: "2026-08-12T03:50:00+00:00",
};
const ROW_C = {
  orderCode: 8200000000033,
  amountVnd: 78000,
  status: "paid",
  createdAt: "2026-07-01T09:05:00+00:00",
  pendingUntil: "2026-07-01T09:35:00+00:00",
};

function classTokens(el: Element): string[] {
  return el.className.split(/\s+/).filter(Boolean);
}

function requireUl(container: HTMLElement): HTMLUListElement {
  const ul = container.querySelector("ul");
  if (!ul) throw new Error("OrderList rendered no <ul>");
  return ul;
}

beforeEach(() => {
  vi.clearAllMocks();
  cookieGetMock.mockReturnValue(undefined); // ⇒ DEFAULT_LOCALE "en"
});

describe("C-07 OrderList", () => {
  // ==========================================================================
  // Case 1 — zero rows is a NON-ERROR surface: the dashed-border box
  // Rejects: an empty list rendered as role="alert" / an error tone; a blank
  // page; an empty <ul> with no explanation; an empty box with no way to
  // /pricing.
  // ==========================================================================
  it("renders the dashed-border empty box, not an error, for zero rows", async () => {
    const { container } = await renderServerTree(await OrderList({ orders: [] }));

    const box = container.querySelector(".border-dashed");
    if (!box) throw new Error("no dashed-border empty box was rendered");
    expect(box.textContent).toContain(EMPTY_LINE);
    expect(box.textContent).toContain(EMPTY_HINT);

    const link = container.querySelector("a[href='/pricing']");
    if (!link) throw new Error("the empty box offers no link to /pricing");
    expect(link.textContent).toBe(PLANS_LINK);

    expect(container.querySelectorAll("[role='alert']")).toHaveLength(0);
    expect(container.querySelectorAll("ul")).toHaveLength(0);
    expect(container.querySelectorAll("li")).toHaveLength(0);
  });

  // ==========================================================================
  // Case 2 — the list idiom: <ul className="flex flex-col gap-3">, with NO
  // height cap and NO internal scroll (C-07 differs from HistoryList here on
  // purpose — /me/orders has nothing below it)
  // Rejects: a copy of HistoryList's `max-h-[calc(100dvh-15rem)] overflow-y-auto
  // md:max-h-[30rem]`; a <div> list; a list missing the gap rhythm.
  // ==========================================================================
  it("renders a flat <ul> with no height cap and no internal scroll", async () => {
    const { container } = await renderServerTree(await OrderList({ orders: [ROW_A, ROW_C] }));

    const tokens = classTokens(requireUl(container));
    expect(tokens).toContain("flex");
    expect(tokens).toContain("flex-col");
    expect(tokens).toContain("gap-3");

    const capped = tokens.filter((t) => /(^|:)(max-h-|h-|overflow-)/.test(t));
    expect(capped).toEqual([]);
  });

  // ==========================================================================
  // Case 3 — one <li> per record, in the supplied sequence; C-07 sorts nothing
  // Rejects: a sort inside C-07 (the supplied sequence is neither created_at
  // asc nor desc, neither orderCode asc nor desc); a dropped or duplicated row.
  // ==========================================================================
  it("renders one row per record, in the supplied sequence", async () => {
    const { container } = await renderServerTree(
      await OrderList({ orders: [ROW_A, ROW_UNRECOGNISED, ROW_C] })
    );

    const rows = [...container.querySelectorAll("li")];
    expect(rows).toHaveLength(3);
    expect(rows.map((r) => (r.textContent ?? "").match(/\d{10,}/g)?.[0])).toEqual([
      "7200000000011",
      "4200000000022",
      "8200000000033",
    ]);
  });

  // ==========================================================================
  // Case 4 — Partial: one unrecognised status renders C-09's fifth appearance
  // and the rest of the list is unaffected
  // Rejects: an unrecognised status coerced to a real one (`?? pending`, the
  // StatusBadge.tsx:53 defect); a row that fails to render at all; a list that
  // hides the other rows when one is odd.
  // ==========================================================================
  it("renders an unrecognised status through C-09's unrecognised branch, leaving the other rows alone", async () => {
    const { container } = await renderServerTree(
      await OrderList({ orders: [ROW_A, ROW_UNRECOGNISED, ROW_C] })
    );

    const rows = [...container.querySelectorAll("li")];
    const odd = rows[1];
    expect(odd.textContent).toContain(WORD_UNRECOGNISED);
    expect(odd.textContent).not.toContain(WORD_PENDING);
    expect(odd.textContent).not.toContain(WORD_PAID);

    const badge = odd.querySelector(".text-destructive");
    if (!badge) throw new Error("the unrecognised badge does not carry the destructive token");

    expect(rows[0].textContent).toContain(WORD_PENDING);
    expect(rows[2].textContent).toContain(WORD_PAID);
    expect(rows[0].textContent).not.toContain(WORD_UNRECOGNISED);
    expect(rows[2].textContent).not.toContain(WORD_UNRECOGNISED);
  });

  // ==========================================================================
  // Case 5 — C-10 is mounted once per row, in EVERY status
  // Rejects: a control mounted only on `pending` rows (the defect R10 exists to
  // prevent — an expired-looking order may still have been paid); a control
  // hoisted to the list instead of the row; two controls on one row; a control
  // carrying a neighbour's orderCode; an unrecognised status treated as
  // terminal (FE-AC-10 — only the `paid` row is terminal here).
  // ==========================================================================
  it("mounts exactly one re-check control per row, each wired to its own row", async () => {
    const { container } = await renderServerTree(
      await OrderList({ orders: [ROW_A, ROW_UNRECOGNISED, ROW_C] })
    );

    const rows = [...container.querySelectorAll("li")];
    expect(rows).toHaveLength(3);
    expect(container.querySelectorAll("button")).toHaveLength(3);
    expect(rows.map((r) => r.querySelectorAll("button").length)).toEqual([1, 1, 1]);

    expect(rows.map((r) => r.querySelector("button")?.getAttribute("aria-describedby"))).toEqual([
      "recheck-7200000000011-reason",
      "recheck-4200000000022-reason",
      "recheck-8200000000033-reason",
    ]);

    // pending and the unrecognised status stay activatable; only `paid` is
    // terminal — the three rows must NOT read the same here.
    expect(rows.map((r) => r.querySelector("button")?.getAttribute("aria-disabled"))).toEqual([
      "false",
      "false",
      "true",
    ]);
  });
});
