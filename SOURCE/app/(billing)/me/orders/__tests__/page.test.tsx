// @vitest-environment jsdom

// S-05 `/me/orders` page — plan Task 3.6.
// UI Spec:  docs/ui-spec/subscription-ui-spec.md § UI-D11, § Component: OrderList — C-07
// Design:   docs/design/subscription-frontend-design.md § Main Components
// Plan:     Task 3.6 proof obligations — "missing-sort-key ordering" and the
//           auth guard ("zero rows fetched for a guest").
//
// MOCK BOUNDARY — `listMyOrders()` is stubbed with fixture rows (its SQL
// ordering is proven in plan Task 3.5, INT-2); `getCurrentUser()` and the
// cookie read are stubbed because they need a request scope. EVERYTHING ELSE IS
// REAL: OrderList, OrderRow, OrderStatusBadge, the real dictionary, the real
// formatters. A mocked component would only assert the mock.
//
// `redirect()` is stubbed to THROW, exactly as the real one does (it raises
// NEXT_REDIRECT and never returns). That is what makes "zero rows fetched"
// provable: only a guard placed BEFORE the fetch can leave listMyOrders()
// uncalled.
//
// No setupFiles in vitest.config.ts ⇒ no jest-dom matchers. The tree is
// rendered through renderServerTree() (see that file: C-07 renders an async
// C-08, which React 19's client renderer cannot resolve), into a container
// detached from `document`, so there is nothing to clean up between cases.

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { listMyOrdersMock, getCurrentUserMock, redirectMock, cookieGetMock } = vi.hoisted(() => ({
  listMyOrdersMock: vi.fn(),
  getCurrentUserMock: vi.fn(),
  redirectMock: vi.fn(),
  cookieGetMock: vi.fn(),
}));

vi.mock("next/headers", () => ({ cookies: async () => ({ get: cookieGetMock }) }));
vi.mock("@/lib/auth/getCurrentUser", () => ({ getCurrentUser: getCurrentUserMock }));
vi.mock("@/app/(billing)/queries", () => ({ listMyOrders: listMyOrdersMock }));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));

import MyOrdersPage from "../page";
import { renderServerTree } from "./renderServerTree";

// ── Fixtures ────────────────────────────────────────────────────────────────
// Supplied in an order that is NOT `created_at desc`, and every field that a
// stray `.sort()` could key on produces a DIFFERENT sequence than the supplied
// one: created_at (either direction), orderCode (either direction) and amount
// (either direction). So any second sort in the view is red, not lucky.
//
// Insertion order:      MIDDLE, NEWEST, OLDEST
//   created_at desc  => NEWEST, MIDDLE, OLDEST     (≠ supplied)
//   created_at asc   => OLDEST, MIDDLE, NEWEST     (≠ supplied)
//   orderCode asc    => 31…, 51…, 91…             (≠ supplied)
//   orderCode desc   => 91…, 51…, 31…             (≠ supplied)
//   amount asc       => 39000, 78000, 117000       (≠ supplied)
//   amount desc      => 117000, 78000, 39000       (≠ supplied)

const MIDDLE = {
  orderCode: 5100000000001,
  amountVnd: 39000,
  status: "paid",
  createdAt: "2026-08-10T04:15:00+00:00",
  // pending_until is DELIBERATELY a different instant from created_at on every
  // fixture row in this suite: equal values would make a swap of the two
  // fields invisible.
  pendingUntil: "2026-08-10T04:45:00+00:00",
};
const NEWEST = {
  orderCode: 3100000000002,
  amountVnd: 117000,
  status: "pending",
  createdAt: "2026-08-18T17:30:00+00:00",
  pendingUntil: "2099-11-30T23:59:59+00:00",
};
const OLDEST = {
  orderCode: 9100000000003,
  amountVnd: 78000,
  status: "cancelled",
  createdAt: "2026-01-05T02:00:00+00:00",
  pendingUntil: "2026-01-05T02:30:00+00:00",
};

const SUPPLIED_ORDER = ["5100000000001", "3100000000002", "9100000000003"];

/** The order codes as rendered, top to bottom. THROWS when a row carries no
 *  raw digit run — a helper that returned "" would let a sequence assertion
 *  pass against rows that render nothing at all. */
function renderedOrderCodes(container: HTMLElement): string[] {
  const rows = [...container.querySelectorAll("li")];
  if (rows.length === 0) throw new Error("OrderList rendered no <li> rows at all");
  return rows.map((row, i) => {
    const runs = (row.textContent ?? "").match(/\d{10,}/g) ?? [];
    if (runs.length !== 1) {
      throw new Error(
        `row ${i} carries ${runs.length} raw digit runs, expected exactly 1 (the orderCode): ${JSON.stringify(row.textContent)}`
      );
    }
    return runs[0];
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  cookieGetMock.mockReturnValue(undefined); // no locale cookie ⇒ DEFAULT_LOCALE "en"
  redirectMock.mockImplementation((url: string) => {
    // The real next/navigation redirect() never returns.
    throw new Error(`NEXT_REDIRECT:${url}`);
  });
});

describe("S-05 /me/orders page", () => {
  // ==========================================================================
  // Case 1 — the auth guard runs BEFORE any fetch (AC: zero rows for a guest)
  // Rejects: a page that fetches first and guards afterwards; a page that
  // redirects to /login; a page that renders the list for a guest.
  // ==========================================================================
  it("redirects a guest to /?auth=signin and fetches zero rows", async () => {
    getCurrentUserMock.mockResolvedValue(null);

    await expect(MyOrdersPage()).rejects.toThrow("NEXT_REDIRECT:/?auth=signin");

    expect(redirectMock).toHaveBeenCalledTimes(1);
    expect(redirectMock).toHaveBeenCalledWith("/?auth=signin");
    expect(listMyOrdersMock).not.toHaveBeenCalled();
  });

  // ==========================================================================
  // Case 2 — a signed-in user gets the rows in the order the query supplied
  // Rejects: any second sort in the page or in C-07 (six sort keys checked by
  // fixture construction); a page that drops or duplicates rows; a page that
  // fetches more than once.
  // ==========================================================================
  it("renders rows in the supplied order and performs no ordering of its own", async () => {
    getCurrentUserMock.mockResolvedValue({ id: "u-1" });
    listMyOrdersMock.mockResolvedValue([MIDDLE, NEWEST, OLDEST]);

    const { container } = await renderServerTree(await MyOrdersPage());

    expect(renderedOrderCodes(container)).toEqual(SUPPLIED_ORDER);
    expect(listMyOrdersMock).toHaveBeenCalledTimes(1);
    expect(redirectMock).not.toHaveBeenCalled();
  });

  // ==========================================================================
  // Case 3 — the page mounts its own heading and the list, and nothing on the
  // screen is an error surface
  // Rejects: a page with no <h1> (PageHeader dropped); a page that renders the
  // list inside an alert; a page that renders the empty box while rows exist.
  // ==========================================================================
  it("renders the page heading above the list and no alert surface", async () => {
    getCurrentUserMock.mockResolvedValue({ id: "u-1" });
    listMyOrdersMock.mockResolvedValue([MIDDLE, NEWEST, OLDEST]);

    const { container } = await renderServerTree(await MyOrdersPage());

    const heading = container.querySelector("h1");
    if (!heading) throw new Error("the page rendered no <h1>");
    expect(heading.textContent).toBe("Your orders");
    expect(container.querySelectorAll("[role='alert']")).toHaveLength(0);
  });
});
