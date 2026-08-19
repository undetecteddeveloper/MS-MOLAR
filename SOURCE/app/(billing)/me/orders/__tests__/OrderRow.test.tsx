// @vitest-environment jsdom

// C-08 OrderRow — plan Task 3.6.
// UI Spec:  docs/ui-spec/subscription-ui-spec.md § Component: `OrderRow` — C-08
// Design:   docs/design/subscription-frontend-design.md § Main Components — C-08
// Reference Contracts (task file):
//   1. derived-display — the orderCode renders as a RAW DIGIT STRING.
//   2. state-lifecycle-negative — `pendingUntil` is used AS SUPPLIED; the view
//      never recomputes a deadline (`created_at + 30 min`), because a reused
//      order keeps its ORIGINAL countdown (backend DD § createOrder()).
// Boundary (plan Connection Map): the link this row emits must parse, under the
//   S-06 consumer rule, back to the same orderCode.
//
// TWO TIMESTAMPS, TWO DIFFERENT INSTANTS, ALWAYS. Every fixture below gives
// `createdAt` and `pendingUntil` clearly different values, on different
// calendar days, so a swap of the two fields cannot pass unseen.
//
// TIMEZONE: `2026-08-18T17:30:00+00:00` is 18 August in UTC and 19 August in
// ICT. The expected literals below are the ICT ones, so an unpinned formatter
// (which renders identically to a pinned one on a machine already in ICT) is
// red here and cannot ship to a UTC runtime.
//
// MOCK BOUNDARY — only `server-only` and next/headers' `cookies()`. The
// formatters, the dictionary and C-09 are REAL.
//
// No setupFiles ⇒ no jest-dom matchers. Rendering goes through
// renderServerTree() into a container detached from `document`, so there is
// nothing to clean up between cases.

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { cookieGetMock } = vi.hoisted(() => ({ cookieGetMock: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: cookieGetMock }) }));

import { I18nProvider } from "@/lib/i18n/client";
import { OrderRow } from "../_components/OrderRow";
import { renderServerTree } from "./renderServerTree";

// ── Fixtures ────────────────────────────────────────────────────────────────

const CODE = 1234567890123; // 13 digits: grouped forms are unmistakable
const CODE_RAW = "1234567890123";
const CODE_GROUPED_EN = "1,234,567,890,123";
const CODE_GROUPED_VI = "1.234.567.890.123";

// created_at: over a day in the past — and therefore far outside any 30-minute
// window computed from it. pending_until: the far future. An implementation
// that recomputes the deadline as `created_at + 30 min` renders no link here
// and fails Case 3.
const PENDING_LIVE = {
  orderCode: CODE,
  amountVnd: 39000,
  status: "pending",
  createdAt: "2026-08-18T17:30:00+00:00",
  pendingUntil: "2099-11-30T23:59:59+00:00",
};
const CREATED_AT_ICT = "19/08/2026 00:30"; // 17:30Z on 18 Aug = 00:30 ICT on 19 Aug
const PENDING_UNTIL_ICT = "01/12/2099 06:59"; // must NOT appear: this view shows no deadline

// pending, but the window has closed: sending a user to a dead QR is worse than
// sending them nowhere.
const PENDING_DEAD = {
  orderCode: 5500000000044,
  amountVnd: 117000,
  status: "pending",
  createdAt: "2026-08-17T19:05:00+00:00",
  pendingUntil: "2026-08-17T19:35:00+00:00",
};

// paid, yet with a future pending_until — the status half of the condition on
// its own.
const PAID_WITH_FUTURE_WINDOW = {
  orderCode: 6600000000055,
  amountVnd: 78000,
  status: "paid",
  createdAt: "2026-08-16T10:00:00+00:00",
  pendingUntil: "2099-11-30T23:59:59+00:00",
};

const CONTINUE_LABEL = "Continue paying"; // billing.orders.continuePaying (en)

/** The S-06 consumer rule, copied from the plan's Connection Map (the real
 *  consumer ships in plan Task 4.2). NEVER parseInt — it accepts "123abc". */
function parseAsS06Consumer(raw: string | null): number | null {
  if (typeof raw !== "string" || !/^\d+$/.test(raw)) return null;
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0 || n > Number.MAX_SAFE_INTEGER) return null;
  return n;
}

async function renderRow(order: typeof PENDING_LIVE, locale: "en" | "vi" = "en") {
  cookieGetMock.mockReturnValue(locale === "en" ? undefined : { value: locale });
  const row = await OrderRow({ order });
  return renderServerTree(
    <I18nProvider locale={locale}>
      <ul>{row}</ul>
    </I18nProvider>
  );
}

function requireLi(container: HTMLElement): HTMLLIElement {
  const li = container.querySelector("li");
  if (!li) throw new Error("OrderRow rendered no <li>");
  return li;
}

function continueLink(container: HTMLElement): HTMLAnchorElement | null {
  return container.querySelector("a[href^='/pricing/checkout']");
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("C-08 OrderRow", () => {
  // ==========================================================================
  // Case 1 — the three AC-026 values, in English
  // Rejects: a created time rendered from an unpinned timezone (would read
  // 18/08/2026 17:30); the two timestamps swapped (pendingUntil's formatted
  // value must be absent); a raw number handed to t("billing.amount")
  // ("39000 VND" instead of "39,000 VND"); an orderCode run through a number
  // formatter.
  // ==========================================================================
  it("renders created time in ICT, the grouped amount and the raw orderCode (en)", async () => {
    const { container } = await renderRow(PENDING_LIVE);
    const text = requireLi(container).textContent ?? "";

    expect(text).toContain(CREATED_AT_ICT);
    expect(text).toContain("39,000 VND");
    expect(text).toContain(CODE_RAW);

    expect(text).not.toContain(PENDING_UNTIL_ICT);
    expect(text).not.toContain("18/08/2026 17:30"); // the UTC reading
    expect(text).not.toContain("39000 VND"); // unformatted substitution
    expect(text).not.toContain(CODE_GROUPED_EN); // Reference Contract 1
    expect(text).not.toContain(CODE_GROUPED_VI);
  });

  // ==========================================================================
  // Case 2 — Reference Contract 1 under a second locale
  // Rejects: an orderCode that follows the locale (the whole point of the
  // contract — the user reads it aloud to support); a hard-coded English
  // amount format.
  // ==========================================================================
  it("keeps the orderCode a raw digit string while the amount follows the locale (vi)", async () => {
    const { container } = await renderRow(PENDING_LIVE, "vi");
    const text = requireLi(container).textContent ?? "";

    expect(text).toContain("39.000 VNĐ");
    expect(text).toContain(CODE_RAW);
    expect(text).not.toContain(CODE_GROUPED_VI);
    expect(text).not.toContain(CODE_GROUPED_EN);
  });

  // ==========================================================================
  // Case 3 — Reference Contract 2 + the S-05 → S-06 boundary roundtrip
  // `createdAt` is over a day old while `pendingUntil` is in the future, so an
  // implementation that recomputes the deadline from created_at renders no
  // link and fails here. The href is then parsed with the S-06 consumer rule.
  // ==========================================================================
  it("renders 'continue paying' for a pending order whose supplied pendingUntil is still in the future", async () => {
    const { container } = await renderRow(PENDING_LIVE);

    const link = continueLink(container);
    if (!link) throw new Error("no 'continue paying' link was rendered");
    expect(link.textContent).toBe(CONTINUE_LABEL);
    expect(link.getAttribute("href")).toBe(`/pricing/checkout?order=${CODE_RAW}`);

    // Roundtrip: what this producer emits, parsed by the consumer rule.
    const emitted = new URL(
      link.getAttribute("href") ?? "",
      "https://ms-molar.test"
    ).searchParams.get("order");
    expect(emitted).toBe(CODE_RAW);
    expect(parseAsS06Consumer(emitted)).toBe(CODE);
  });

  // ==========================================================================
  // Case 4 — past the window, no link
  // Rejects: a link keyed on status alone; a link keyed on a recomputed
  // deadline; a link that is always rendered.
  // ==========================================================================
  it("renders no 'continue paying' link once the supplied pendingUntil has passed", async () => {
    const { container } = await renderRow(PENDING_DEAD);

    expect(continueLink(container)).toBeNull();
    expect(requireLi(container).textContent).not.toContain(CONTINUE_LABEL);
  });

  // ==========================================================================
  // Case 5 — a settled order with a future window, no link
  // Rejects: a link keyed on pendingUntil alone (the status half of the
  // condition dropped).
  // ==========================================================================
  it("renders no 'continue paying' link for a non-pending order even inside its window", async () => {
    const { container } = await renderRow(PAID_WITH_FUTURE_WINDOW);

    expect(continueLink(container)).toBeNull();
    expect(requireLi(container).textContent).toContain("Paid");
  });

  // ==========================================================================
  // Case 6 — the 360px layout rules (UI-D6 + C-08)
  // Rejects: a copy of HistoryRow's `sm:` breakpoints; a missing `min-w-0` on
  // the text column; a `whitespace-nowrap` on the metadata line (both are the
  // measured overflow candidates at 360px).
  // ==========================================================================
  it("stacks below md:, uses no sm: breakpoint, and keeps the text column shrinkable", async () => {
    const { container } = await renderRow(PENDING_LIVE);
    const li = requireLi(container);
    const liTokens = li.className.split(/\s+/).filter(Boolean);

    expect(liTokens).toContain("flex-col");
    expect(liTokens).toContain("md:flex-row");

    const smTokens = [...li.querySelectorAll("*")]
      .concat([li])
      .flatMap((el) => (el.getAttribute("class") ?? "").split(/\s+/))
      .filter((t) => t.startsWith("sm:"));
    expect(smTokens).toEqual([]);

    const nowrap = li.querySelectorAll(".whitespace-nowrap");
    expect(nowrap).toHaveLength(0);

    const shrinkable = li.querySelector(".min-w-0");
    if (!shrinkable) throw new Error("no min-w-0 text column");
    expect(shrinkable.textContent).toContain(CODE_RAW);
  });
});
