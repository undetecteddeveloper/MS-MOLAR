// @vitest-environment jsdom

// `pricing/checkout/{loading,error}.tsx` — plan Task 4.2, FE-I9 / UI-D18.
// Origin pattern: `(HM)/history/{loading,error}.tsx`, with the three
// corrections the frontend DD's "Route boundary files" table takes from
// `(layer3)/profile/` and `me/orders/` already ships: `error.digest` ONLY in
// the log, `min-h-11` on the retry control, `common.tryAgain` as its label.
//
// The container assertion is deliberately CROSS-FILE: both boundary files are
// compared against the scaffold the PAGE actually renders, not against a
// constant restated three times. UI-D18's rule is "match your own page's size
// AND padding", and only a comparison against the page can fail when the page
// moves. The fixed literals are asserted too, so all three files drifting in
// the same direction is still red.
//
// S-06 is `size="small"` — NOT the `size="default"` its sibling `/me/orders`
// uses. Copying the sibling verbatim is the failure this pair of assertions
// catches.
//
// MOCK BOUNDARY — the page's request-scoped dependencies only. PageContainer,
// the dictionary and both boundary components are REAL.
//
// No setupFiles ⇒ no jest-dom matchers; render() does not auto-cleanup.

import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { getMyOrderMock, getCurrentUserMock, cookieGetMock } = vi.hoisted(() => ({
  getMyOrderMock: vi.fn(),
  getCurrentUserMock: vi.fn(),
  cookieGetMock: vi.fn(),
}));

vi.mock("next/headers", () => ({ cookies: async () => ({ get: cookieGetMock }) }));
vi.mock("@/lib/auth/getCurrentUser", () => ({ getCurrentUser: getCurrentUserMock }));
vi.mock("@/app/(billing)/queries", () => ({ getMyOrder: getMyOrderMock }));
vi.mock("next/navigation", () => ({ redirect: vi.fn(), notFound: vi.fn() }));

import { renderServerTree } from "@/app/(billing)/me/orders/__tests__/renderServerTree";
import CheckoutPage from "../page";
import Loading from "../loading";
import ErrorBoundary from "../error";

// The page's own scaffold, restated independently of PageContainer's source:
// size="small" (`--scaffold-small`) with the DEFAULT padding rhythm.
const EXPECTED_SCAFFOLD = ["max-w-[var(--scaffold-small)]", "px-6", "py-10"];

// The sibling route's scaffold. Named so the "did you copy /me/orders?"
// assertion reads as the requirement it is, rather than as a magic string.
const SIBLING_SCAFFOLD_TOKEN = "max-w-[var(--scaffold-default)]";

const RETRY_LABEL = "Try again"; // common.tryAgain — NOT common.retry ("Retry")
const LOAD_ERROR = "We couldn't load this page"; // error.couldntLoad

// Two DIFFERENT strings of the same type: if the boundary logged the message
// instead of the digest, or logged both, the assertions below separate them.
const DIGEST = "d1gest7f3a2b";
const SECRET_MESSAGE = "payment order 3100000000002 memo MSMOLAR3100000000002 rejected by provider";

const SCAFFOLD_TOKEN = /^(max-w-\[var\(--scaffold-[a-z]+\)\]|px-\d+|py-\d+)$/;

/** The scaffold classes of the outermost rendered element. THROWS when there
 *  are none — a component that renders no PageContainer at all must not read
 *  as "matches, both empty". */
function scaffoldOf(container: HTMLElement): string[] {
  const root = container.firstElementChild;
  if (!(root instanceof HTMLElement)) throw new Error("nothing was rendered");
  const tokens = root.className
    .split(/\s+/)
    .filter((t) => SCAFFOLD_TOKEN.test(t))
    .sort();
  if (tokens.length === 0) {
    throw new Error(`the root element carries no scaffold classes: ${root.className}`);
  }
  return tokens;
}

async function renderPage() {
  return renderServerTree(await CheckoutPage({ searchParams: Promise.resolve({}) }));
}

beforeEach(() => {
  vi.clearAllMocks();
  cookieGetMock.mockReturnValue(undefined); // ⇒ DEFAULT_LOCALE "en"
  getCurrentUserMock.mockResolvedValue({ id: "u-77" });
  getMyOrderMock.mockResolvedValue(null);
});

afterEach(cleanup);

describe("pricing/checkout route boundary files", () => {
  // ==========================================================================
  // Case 1 — loading.tsx matches its OWN page's size and padding
  // Rejects: the origin's `padding="compact"` copied verbatim; the sibling
  // /me/orders' `size="default"` copied verbatim; any padding drift between
  // the skeleton and the page (the jump history/loading.tsx:9-12 documents);
  // a skeleton with no PageContainer.
  // ==========================================================================
  it("renders a skeleton whose container matches the page's size and padding", async () => {
    const page = await renderPage();
    const pageScaffold = scaffoldOf(page.container);

    const skeleton = render(<Loading />);

    expect(scaffoldOf(skeleton.container)).toEqual(pageScaffold);
    expect(pageScaffold).toEqual([...EXPECTED_SCAFFOLD].sort());
    expect(pageScaffold).not.toContain(SIBLING_SCAFFOLD_TOKEN);
  });

  // ==========================================================================
  // Case 2 — the skeleton is the shipped pulsing-block idiom
  // Rejects: a spinner; a bare heading block with no body placeholder, which
  // leaves the page height jumping the moment the panel arrives.
  // ==========================================================================
  it("renders pulsing blocks, not a spinner", () => {
    const { container } = render(<Loading />);

    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThanOrEqual(2);
    expect(container.querySelectorAll(".animate-spin")).toHaveLength(0);
  });

  // ==========================================================================
  // Case 3 — error.tsx focuses its role="alert" on mount and matches the page
  // Rejects: an alert that is never focused (FE-AC-12); a wrapper without
  // tabIndex={-1} (focus() on a non-focusable node is a silent no-op, so the
  // two assertions are ONE requirement); a container that does not match the
  // page.
  // ==========================================================================
  it("focuses the role=alert node on mount, inside the page's own container", () => {
    const { container } = render(
      <ErrorBoundary
        error={Object.assign(new Error(SECRET_MESSAGE), { digest: DIGEST })}
        reset={vi.fn()}
      />
    );

    const alert = container.querySelector("[role='alert']");
    if (!(alert instanceof HTMLElement)) throw new Error("no role=alert node was rendered");
    expect(alert.getAttribute("tabindex")).toBe("-1");
    expect(document.activeElement).toBe(alert);
    expect(alert.textContent).toContain(LOAD_ERROR);

    expect(scaffoldOf(container)).toEqual([...EXPECTED_SCAFFOLD].sort());
  });

  // ==========================================================================
  // Case 4 — retry is wired to reset() and carries the 44px touch target
  // Rejects: a retry that reloads by other means; a control below the
  // touch-target minimum (the origin's own gap); `common.retry` ("Retry") in
  // place of `common.tryAgain`.
  // ==========================================================================
  it("retries through reset() with a min-h-11 control labelled 'Try again'", () => {
    const reset = vi.fn();
    const { container } = render(
      <ErrorBoundary
        error={Object.assign(new Error(SECRET_MESSAGE), { digest: DIGEST })}
        reset={reset}
      />
    );

    const button = container.querySelector("button");
    if (!button) throw new Error("no retry control was rendered");
    expect(button.textContent).toBe(RETRY_LABEL);
    expect(button.className.split(/\s+/)).toContain("min-h-11");

    expect(reset).not.toHaveBeenCalled();
    fireEvent.click(button);
    expect(reset).toHaveBeenCalledTimes(1);
  });

  // ==========================================================================
  // Case 5 — the log carries the digest and NOTHING else
  // Rejects: the origin's `{ error }` (the whole object, message and stack
  // included); logging `error.message` beside the digest; logging nothing.
  // A PAYMENT route's error message may carry an order code, a memo or a
  // provider sentence, and §Security Considerations forbids that reaching a
  // log.
  //
  // ASSERTED ON THE SHAPE, NOT ON A SERIALISATION. Comparing
  // `JSON.stringify(args)` lets `console.error(msg, { error })` through:
  // `digest` is an ENUMERABLE own property of the error object, so the
  // whole-object form stringifies to `{"error":{"digest":"…"}}` — it contains
  // the digest, it hides the message (Error#message is non-enumerable), and it
  // satisfies every string assertion while shipping the object the server
  // logger prints in full.
  // ==========================================================================
  it("logs error.digest only, never the error message or the error object", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      render(
        <ErrorBoundary
          error={Object.assign(new Error(SECRET_MESSAGE), { digest: DIGEST })}
          reset={vi.fn()}
        />
      );

      expect(spy).toHaveBeenCalledTimes(1);
      const args = spy.mock.calls[0];
      expect(args).toHaveLength(2);

      const [label, payload] = args;
      expect(typeof label).toBe("string");
      expect(payload).toEqual({ digest: DIGEST });
      expect(Object.keys(payload as object)).toEqual(["digest"]);

      // Nothing anywhere in the call is an Error — not an argument, not a
      // property of the payload.
      const carriers: unknown[] = [...args, ...Object.values(payload as Record<string, unknown>)];
      expect(carriers.some((a) => a instanceof Error)).toBe(false);

      // …and the message text appears nowhere, even walking into any Error a
      // future edit might nest.
      const walked = carriers
        .map((a) => (a instanceof Error ? `${a.message} ${a.stack ?? ""}` : String(a)))
        .join(" ");
      expect(walked).not.toContain(SECRET_MESSAGE);
      expect(walked).not.toContain("3100000000002");
    } finally {
      spy.mockRestore();
    }
  });
});

describe("pricing/checkout — the frozen security boundary", () => {
  // ==========================================================================
  // Case 6 — the two constraints that are invisible in rendered output.
  // Rejects: a PUBLIC_PATHS entry added for either new path (AC-032's budget
  // of exactly three public entries, one of them a write); a dotted segment,
  // which proxy.ts's matcher excludes from BOTH the auth middleware and the
  // nonce-bearing CSP — an unauthenticated render under a weaker policy, on
  // the one screen that handles money.
  // ==========================================================================
  it("adds no PUBLIC_PATHS entry and keeps both new paths dot-free", async () => {
    const { PUBLIC_PATHS } = await import("@/lib/supabase/middleware");
    const { relative, resolve, sep } = await import("node:path");

    // Second direction of the check, borrowed from the webhook route's own
    // admission test: the path asserted below must be the path Next.js
    // ACTUALLY serves these files at, not a string that merely looks like it.
    // Route groups — the parenthesised segments — are stripped from the URL.
    const routeDir = resolve(import.meta.dirname, "..");
    const appDir = resolve(import.meta.dirname, "..", "..", "..", "..");
    const served =
      "/" +
      relative(appDir, routeDir)
        .split(sep)
        .filter((s) => !s.startsWith("("))
        .join("/");
    expect(served).toBe("/pricing/checkout");

    for (const path of [served]) {
      expect(PUBLIC_PATHS).not.toContain(path);
      // The middleware matches by prefix, so a parent entry would admit the
      // child. `/pricing` must not be public either.
      expect(
        PUBLIC_PATHS.some((p) => path === p || path.startsWith(`${p}/`))
      ).toBe(false);
      expect(path).not.toContain(".");
    }
  });
});
