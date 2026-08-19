// @vitest-environment jsdom

// S-06 `/pricing/checkout` — plan Task 4.2.
// UI Spec:  docs/ui-spec/subscription-ui-spec.md § Component: `PaymentPanel` — C-13
// Design:   docs/design/subscription-frontend-design.md § Field Propagation Map,
//           § Main Components, § Security Considerations
// Plan:     Task 4.2 proof obligations — the parsing table, and the four
//           Empty-state causes byte-identical in rendered output.
//
// WHAT THIS FILE IS FOR, IN ONE SENTENCE: `parseInt("123abc")` is `123`, and an
// implementation that uses it routes a malformed identifier into a real
// database read. Every row of the table below exists to make one wrong parse
// red, and the row's comment names which one.
//
// MOCK BOUNDARY — `getMyOrder()` is stubbed (its RLS behaviour is proven by
// INT-2 / SVC-2, plan Tasks 3.5 and 6.2), `getCurrentUser()` and the cookie
// read are stubbed because they need a request scope. THE PARSE IS REAL — it is
// the thing under test, so nothing about it is mocked or re-implemented here.
//
// `redirect()` is stubbed to THROW, exactly as the real one does. That is what
// makes "zero reads for a guest" provable: only a guard placed BEFORE the read
// can leave `getMyOrder()` uncalled.
//
// No setupFiles in vitest.config.ts ⇒ no jest-dom matchers. The tree goes
// through renderServerTree() into a container detached from `document`, so
// there is nothing to clean up between cases.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { getMyOrderMock, getCurrentUserMock, redirectMock, notFoundMock, cookieGetMock } = vi.hoisted(
  () => ({
    getMyOrderMock: vi.fn(),
    getCurrentUserMock: vi.fn(),
    redirectMock: vi.fn(),
    notFoundMock: vi.fn(),
    cookieGetMock: vi.fn(),
  })
);

vi.mock("next/headers", () => ({ cookies: async () => ({ get: cookieGetMock }) }));
vi.mock("@/lib/auth/getCurrentUser", () => ({ getCurrentUser: getCurrentUserMock }));
vi.mock("@/app/(billing)/queries", () => ({ getMyOrder: getMyOrderMock }));

// C-10 (mounted by C-08 in the roundtrip case) calls `useRouter()`, which
// throws outside a real app-router tree. Same one-method stub the shipped
// client-component tests use; C-10 itself stays REAL.
vi.mock("next/navigation", () => ({
  redirect: redirectMock,
  notFound: notFoundMock,
  useRouter: () => ({ refresh: vi.fn() }),
}));

import type { CheckoutOrder } from "@/lib/billing/checkoutOrder";
import { OrderRow } from "@/app/(billing)/me/orders/_components/OrderRow";
import { renderServerTree } from "@/app/(billing)/me/orders/__tests__/renderServerTree";
import CheckoutPage from "../page";

// ── Fixtures ────────────────────────────────────────────────────────────────
// All EIGHT fields carry DIFFERENT values, and the four text fields are four
// distinguishable strings: two fields of the same type seeded with the same
// value would make a swap of the two invisible.
//
// `pendingUntil` is an instant on a DIFFERENT CALENDAR DAY in UTC (18 Aug
// 17:30Z) than in ICT (19 Aug 00:30), so an unpinned formatter cannot pass by
// coincidence on a machine that already sits in Asia/Saigon.
const ORDER: CheckoutOrder = {
  orderCode: 3100000000002,
  amountVnd: 39000,
  status: "pending",
  pendingUntil: "2026-08-18T17:30:00.000Z",
  qrPayload: "00020101021238QRPAYLOAD5802VN",
  accountNumber: "19001234567890",
  accountName: "CONG TY MS MOLAR",
  memo: "MSMOLAR3100000000002",
};

type RawParam = string | string[] | undefined;

/** Call the page the way Next.js does: `searchParams` is a Promise. */
async function renderCheckout(raw: RawParam) {
  const searchParams = Promise.resolve(raw === undefined ? {} : { order: raw });
  return renderServerTree(await CheckoutPage({ searchParams }));
}

// ── The parsing table (plan Task 4.2's literal proof obligation, extended) ───
//
// ACCEPT means: a positive safe integer reached `getMyOrder()`.
// REJECT means: `getMyOrder()` was NEVER called — the value was refused BEFORE
// any read, which is the security half of the claim, not a UI detail.

const TABLE: Array<{ label: string; raw: RawParam; accepts: number | null; rejects: string }> = [
  // ── the nine rows the plan names verbatim ──────────────────────────────
  { label: "undefined (no ?order= at all)", raw: undefined, accepts: null,
    rejects: "an implementation that reads the param without checking presence" },
  { label: '"" (blank param)', raw: "", accepts: null,
    rejects: 'Number("") === 0, which is a NUMBER and not NaN — a Number()-only guard lets it through' },
  { label: '"abc"', raw: "abc", accepts: null,
    rejects: "nothing subtle; the baseline non-numeric case" },
  { label: '"12a"', raw: "12a", accepts: null,
    rejects: 'parseInt("12a") === 12 — THE defect this rule exists to prevent' },
  { label: '"-1"', raw: "-1", accepts: null,
    rejects: "a signed value; the serialized format carries no sign" },
  { label: '"0"', raw: "0", accepts: null,
    rejects: "a `>= 0` bound in place of `> 0`" },
  { label: '["1","2"] (repeated ?order=)', raw: ["1", "2"], accepts: null,
    rejects: 'a missing typeof check — Number(["1","2"]) is NaN but String(["1","2"]) is "1,2", and an array reaching a regex .test() coerces silently' },
  { label: '"9007199254740993" (beyond MAX_SAFE_INTEGER)', raw: "9007199254740993", accepts: null,
    rejects: "a Number.isInteger() bound in place of Number.isSafeInteger()" },
  { label: '"12345" (the one accepted row)', raw: "12345", accepts: 12345,
    rejects: "an accept-list so tight it refuses a well-formed code" },

  // ── forms Number() coerces that the regex is the ONLY thing rejecting ──
  { label: '"123abc"', raw: "123abc", accepts: null,
    rejects: 'parseInt("123abc") === 123 — the rule is written naming this input' },
  { label: '" 12 " (surrounding whitespace)', raw: " 12 ", accepts: null,
    rejects: 'Number(" 12 ") === 12 — Number() trims, the anchored regex does not' },
  { label: '"1e3" (exponent form)', raw: "1e3", accepts: null,
    rejects: 'Number("1e3") === 1000, a positive safe integer that never round-trips as digits' },
  { label: '"0x10" (hex form)', raw: "0x10", accepts: null,
    rejects: 'Number("0x10") === 16 — a second numeric base on a decimal-only boundary' },
  { label: '"+5" (explicit plus)', raw: "+5", accepts: null,
    rejects: 'Number("+5") === 5 — the format admits no sign at all' },
  { label: '"-5" (explicit minus)', raw: "-5", accepts: null,
    rejects: "a sign that survives when only the `> 0` bound is checked" },
  { label: '"1.0" (decimal point)', raw: "1.0", accepts: null,
    rejects: 'Number("1.0") === 1 and Number.isSafeInteger(1) is true — only the regex refuses it' },
  { label: '"1,000" (thousands separator)', raw: "1,000", accepts: null,
    rejects: "exactly what OrderRow's comment warns a formatted producer would emit" },
  { label: '"\\n12" (leading newline)', raw: "\n12", accepts: null,
    rejects: 'Number("\\n12") === 12 — an unanchored or /m-flagged regex lets it through' },
  { label: '"12\\n" (trailing newline)', raw: "12\n", accepts: null,
    rejects: 'Number("12\\n") === 12 — a /m-flagged regex would accept this one' },
  { label: '"１２３" (full-width digits)', raw: "１２３", accepts: null,
    rejects: 'a digit class widened to Unicode — \\d is ASCII-only. Number("１２３") is NaN too, so the regex here is a second layer rather than the only refusal' },
  { label: '[] (empty repeated param)', raw: [], accepts: null,
    rejects: 'Number([]) === 0 and String([]) === "" — an array that coerces to a number, not to NaN' },
  // THE row that makes the `typeof` guard load-bearing, added after a mutation
  // run: with `["1","2"]` alone, deleting the typeof check SURVIVES, because
  // RegExp#test coerces to "1,2" and the regex refuses it anyway. A ONE-element
  // array coerces to a clean digit string, sails through the regex, and
  // `Number(["12345"])` is 12345 — so without `typeof` this reaches the
  // database. The rule says "a string"; an array is not one.
  { label: '["12345"] (single-element repeated param)', raw: ["12345"], accepts: null,
    rejects: "a missing typeof check that the regex appears to cover — String([\"12345\"]) is \"12345\", which matches /^\\d+$/ and coerces to a positive safe integer" },

  // ── the safe-integer edge, from both sides ────────────────────────────
  { label: '"9007199254740991" (exactly MAX_SAFE_INTEGER)', raw: "9007199254740991", accepts: 9007199254740991,
    rejects: "a `< MAX_SAFE_INTEGER` bound where the rule says `<=`" },
  { label: '"9007199254740992" (MAX_SAFE_INTEGER + 1)', raw: "9007199254740992", accepts: null,
    rejects: "an off-by-one on the safe-integer bound — this value IS an integer, it is not SAFE" },
  { label: '"10000000000000000000" (1e19, far past the bound)', raw: "10000000000000000000", accepts: null,
    rejects: "a bound checked with Number.isFinite() instead of Number.isSafeInteger()" },

  // ── a form the rule accepts on purpose; recorded so it is not a surprise
  { label: '"007" (leading zeros)', raw: "007", accepts: 7,
    rejects: "over-tightening the rule to /^[1-9]\\d*$/ — the written rule is /^\\d+$/, and 007 is a decimal digit string that reads as 7" },
];

beforeEach(() => {
  vi.clearAllMocks();
  cookieGetMock.mockReturnValue(undefined); // no locale cookie ⇒ DEFAULT_LOCALE "en"
  getCurrentUserMock.mockResolvedValue({ id: "u-1" });
  getMyOrderMock.mockResolvedValue(null);
  redirectMock.mockImplementation((url: string) => {
    // The real next/navigation redirect() never returns.
    throw new Error(`NEXT_REDIRECT:${url}`);
  });
  notFoundMock.mockImplementation(() => {
    throw new Error("NEXT_NOT_FOUND");
  });
});

describe("S-06 checkout — the ?order= accept-list", () => {
  for (const row of TABLE) {
    // ========================================================================
    // Rejects (per row): the wrong implementation named in `row.rejects`.
    // ========================================================================
    it(`${row.accepts === null ? "refuses" : `accepts as ${row.accepts}`}: ${row.label}`, async () => {
      await renderCheckout(row.raw);

      if (row.accepts === null) {
        // The security half: refused BEFORE any read, so a malformed
        // identifier never reaches the database at all.
        expect(getMyOrderMock).not.toHaveBeenCalled();
      } else {
        expect(getMyOrderMock).toHaveBeenCalledTimes(1);
        const [arg] = getMyOrderMock.mock.calls[0];
        // `toBe` on a number, not a loose match: "12345" reaching the query as
        // a STRING would satisfy a == comparison and break the bigint filter.
        expect(typeof arg).toBe("number");
        expect(arg).toBe(row.accepts);
      }

      // Not an error and not a 404 — for EVERY row, accepted or refused.
      expect(notFoundMock).not.toHaveBeenCalled();
      expect(redirectMock).not.toHaveBeenCalled();
    });
  }

  // ==========================================================================
  // A parseInt-based implementation must be red on more than one row, and the
  // table above must be the reason. This case states the invariant directly so
  // a future edit cannot thin the table down to the easy rows.
  // ==========================================================================
  it("keeps every parseInt-permissive form in the table", () => {
    const labels = TABLE.map((r) => r.label).join(" | ");
    for (const needle of ['"12a"', '"123abc"', '" 12 "', '"1.0"', '"1e3"']) {
      expect(labels).toContain(needle);
    }
    // Exactly three rows are accepted; every other row is a refusal.
    expect(TABLE.filter((r) => r.accepts !== null)).toHaveLength(3);
  });

  // ==========================================================================
  // "Never `parseInt`" is a NORMATIVE rule, and behaviour alone cannot enforce
  // it here: with the `/^\d+$/` accept-list in front, `parseInt(s, 10)` and
  // `Number(s)` agree on every input, so swapping them is an EQUIVALENT
  // mutation that no black-box case can kill. It stops being equivalent the
  // moment someone deletes or loosens the regex — which is exactly the edit
  // this rule is written to survive, so the prohibition is asserted directly.
  // Rejects: a future edit that reintroduces parseInt while the regex still
  // masks it, leaving a page one deleted line away from reading "123abc" as 123.
  // ==========================================================================
  it("uses no parseInt anywhere in the route's parse", () => {
    const src = readFileSync(join(import.meta.dirname, "..", "page.tsx"), "utf8");
    // Comments are stripped first — page.tsx's docblock NAMES `parseInt` as the
    // thing it refuses, and a prohibition that its own explanation trips is a
    // rule nobody can document.
    const code = src
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split("\n")
      .filter((line) => !line.trimStart().startsWith("//"))
      .join("\n");

    // The anchors are asserted to match SOMETHING first: a path typo, or a
    // comment-stripper that ate the whole file, would make a `not.toMatch`
    // pass against nothing at all.
    expect(code).toContain("function parseOrderCode");
    expect(code).toContain("Number.isSafeInteger");
    expect(code).not.toMatch(/\bparseInt\s*\(/);
  });
});

describe("S-06 checkout — the four Empty-state causes", () => {
  // ==========================================================================
  // The load-bearing case. Rejects: a page that says "we don't know that
  // order" for an unknown code and "that isn't yours" for a foreign one (an
  // enumeration oracle); a page that renders a different surface for an
  // unparseable param than for an absent one; a page that reaches the database
  // for a param it already refused.
  //
  // BYTE-IDENTITY IS ASSERTED ON innerHTML, not on a text snippet: two surfaces
  // can carry the same sentence and still differ in a class, an href or an
  // attribute that names the cause.
  // ==========================================================================
  it("renders byte-identical output for no param / unparseable / unknown / foreign", async () => {
    const noParam = (await renderCheckout(undefined)).container.innerHTML;
    const readsAfterNoParam = getMyOrderMock.mock.calls.length;

    const unparseable = (await renderCheckout("12a")).container.innerHTML;
    const readsAfterUnparseable = getMyOrderMock.mock.calls.length;

    // Unknown and foreign are the SAME return value on purpose: RLS
    // (`orders_select_own`) filters another user's row out, so it reaches null
    // by the same path a nonexistent code does.
    const unknown = (await renderCheckout("12345")).container.innerHTML;
    const foreign = (await renderCheckout("999999")).container.innerHTML;

    expect(unparseable).toBe(noParam);
    expect(unknown).toBe(noParam);
    expect(foreign).toBe(noParam);

    // The two rejected causes reached NO read; the two null-returning causes
    // reached exactly one each. Without this, "byte-identical" would also be
    // satisfied by a page that queries the database for every input.
    expect(readsAfterNoParam).toBe(0);
    expect(readsAfterUnparseable).toBe(0);
    expect(getMyOrderMock).toHaveBeenCalledTimes(2);
    expect(getMyOrderMock.mock.calls.map(([c]) => c)).toEqual([12345, 999999]);
  });

  // ==========================================================================
  // Byte-identity is worthless if the Empty surface is empty, or if it is what
  // a real order renders too. Rejects: a page that renders nothing at all; a
  // page whose Empty state and Default state are the same tree.
  // ==========================================================================
  it("renders a non-trivial Empty surface that differs from a found order", async () => {
    const empty = (await renderCheckout(undefined)).container.innerHTML;

    expect(empty.length).toBeGreaterThan(0);

    const { container } = await renderCheckout(undefined);
    // C-13's Empty carries the way back to /pricing. Asserted as an href on a
    // real anchor, not as a substring of the markup.
    const back = container.querySelector('a[href="/pricing"]');
    if (!back) throw new Error("the Empty state offers no link back to /pricing");
    expect((back.textContent ?? "").trim().length).toBeGreaterThan(0);

    // Empty is NOT an error surface (FE: "not an error and not a 404").
    expect(container.querySelectorAll("[role='alert']")).toHaveLength(0);

    getMyOrderMock.mockResolvedValue(ORDER);
    const found = (await renderCheckout(String(ORDER.orderCode))).container.innerHTML;
    expect(found).not.toBe(empty);
  });

  // ==========================================================================
  // The read THROWING is not the Empty state — it is the route's error.tsx.
  // Rejects: a page that catches the read failure and renders Empty, which
  // would tell someone who just transferred money that they have no order.
  // ==========================================================================
  it("lets a failed read propagate instead of degrading to Empty", async () => {
    getMyOrderMock.mockRejectedValue(new Error("PostgREST 500"));

    await expect(renderCheckout("12345")).rejects.toThrow("PostgREST 500");
  });
});

describe("S-06 checkout — the guard, the shape, and the boundary roundtrip", () => {
  // ==========================================================================
  // Rejects: a page that reads first and guards afterwards (the read would
  // still return null under RLS, so the screen would LOOK right while a guest
  // touched the database); a page that redirects to /login, a route that does
  // not exist in this repo.
  // ==========================================================================
  it("redirects a guest to /?auth=signin and performs zero reads", async () => {
    getCurrentUserMock.mockResolvedValue(null);

    await expect(renderCheckout("12345")).rejects.toThrow("NEXT_REDIRECT:/?auth=signin");

    expect(redirectMock).toHaveBeenCalledTimes(1);
    expect(redirectMock).toHaveBeenCalledWith("/?auth=signin");
    expect(getMyOrderMock).not.toHaveBeenCalled();
  });

  // ==========================================================================
  // ROUNDTRIP ACROSS THE NAVIGATION BOUNDARY (plan Connection Map).
  // The producer is the SHIPPED C-08 `OrderRow`, rendered for real; the digit
  // string it puts on the query string is pulled back out of its own href and
  // fed to the consumer. Rejects: a producer that groups thousands; a consumer
  // that parses to a different number; any drift between the two sides that a
  // hand-written literal on both ends would hide.
  // ==========================================================================
  it("parses the exact orderCode the shipped OrderRow emits", async () => {
    const row = {
      orderCode: 3100000000002,
      amountVnd: 39000,
      status: "pending",
      createdAt: "2026-08-18T17:30:00+00:00",
      pendingUntil: "2099-11-30T23:59:59+00:00", // still open ⇒ the link renders
    };

    const produced = await renderServerTree(await OrderRow({ order: row }));
    const link = produced.container.querySelector('a[href^="/pricing/checkout"]');
    if (!(link instanceof HTMLAnchorElement)) {
      throw new Error("OrderRow rendered no 'continue paying' link to /pricing/checkout");
    }
    const emitted = new URL(link.getAttribute("href") ?? "", "https://x.test").searchParams.get(
      "order"
    );
    if (emitted === null) throw new Error("the emitted href carries no ?order= param");

    // The serialized format itself: decimal digits, no grouping, no sign.
    expect(emitted).toMatch(/^\d+$/);

    getMyOrderMock.mockResolvedValue(ORDER);
    await renderCheckout(emitted);

    expect(getMyOrderMock).toHaveBeenCalledTimes(1);
    // The IDENTICAL value, not merely a well-formed one.
    expect(getMyOrderMock.mock.calls[0][0]).toBe(row.orderCode);
  });

  // ==========================================================================
  // The eight-field CheckoutOrder reaches the panel mount point UNRESHAPED
  // (Reference Contract, UI Spec § C-13). Rejects: a page that rebuilds the
  // object, re-derives the amount from a price constant, or formats the
  // orderCode — the identifier a user reads aloud to support must stay a raw
  // digit string (UI Spec § C-08, § C-13).
  // ==========================================================================
  it("renders the row's own orderCode raw and re-derives nothing", async () => {
    getMyOrderMock.mockResolvedValue(ORDER);

    const { container } = await renderCheckout(String(ORDER.orderCode));
    const text = container.textContent ?? "";

    expect(text).toContain("3100000000002");
    // No grouping in any of the three locale idioms, and no exponent form.
    for (const grouped of ["3,100,000,000,002", "3.100.000.000.002", "3 100 000 000 002", "3.1e+12"]) {
      expect(text).not.toContain(grouped);
    }
  });
});
