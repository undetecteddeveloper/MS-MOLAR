// @vitest-environment jsdom

// `me/orders/{loading,error}.tsx` — plan Task 3.6, FE-I9 / UI-D18.
// Origin pattern: `(HM)/history/{loading,error}.tsx`, with the three
// corrections the frontend DD's "Route boundary files" table takes from
// `(analytics)/profile/`: `error.digest` ONLY in the log, `min-h-11` on the retry
// control, and `common.tryAgain` as its label.
//
// The container assertion is deliberately CROSS-FILE: the skeleton's and the
// error surface's scaffold classes are compared against the ones the PAGE
// actually renders, not against a constant restated three times. UI-D18's rule
// is "match your own page's size AND padding", and only a comparison against
// the page can fail when the page moves. The fixed literals are asserted too,
// so all three files being wrong in the same direction is still red.
//
// MOCK BOUNDARY — the page's request-scoped dependencies only. PageContainer,
// the dictionary and both boundary components are REAL.
//
// No setupFiles ⇒ no jest-dom matchers; render() does not auto-cleanup.

import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { listMyOrdersMock, getCurrentUserMock, cookieGetMock } = vi.hoisted(() => ({
  listMyOrdersMock: vi.fn(),
  getCurrentUserMock: vi.fn(),
  cookieGetMock: vi.fn(),
}));

vi.mock("next/headers", () => ({ cookies: async () => ({ get: cookieGetMock }) }));
vi.mock("@/lib/auth/getCurrentUser", () => ({ getCurrentUser: getCurrentUserMock }));
vi.mock("@/app/(billing)/queries", () => ({ listMyOrders: listMyOrdersMock }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

import MyOrdersPage from "../page";
import { renderServerTree } from "./renderServerTree";
import Loading from "../loading";
import ErrorBoundary from "../error";

// The page's own scaffold, restated independently of PageContainer's source:
// size="default" (`--scaffold-default`) with the DEFAULT padding rhythm.
const EXPECTED_SCAFFOLD = ["max-w-[var(--scaffold-default)]", "px-6", "py-10"];

const RETRY_LABEL = "Try again"; // common.tryAgain — NOT common.retry ("Retry")
const LOAD_ERROR = "We could not load your orders just now. Try again."; // billing.orders.loadError

// Two DIFFERENT strings of the same type: if the boundary logged the message
// instead of the digest, or logged both, the assertions below separate them.
const DIGEST = "d1gest7f3a2b";
const SECRET_MESSAGE = "payment order 5500000000044 for user u-77 was rejected";

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

beforeEach(() => {
  vi.clearAllMocks();
  cookieGetMock.mockReturnValue(undefined); // ⇒ DEFAULT_LOCALE "en"
  getCurrentUserMock.mockResolvedValue({ id: "u-77" });
  listMyOrdersMock.mockResolvedValue([]);
});

afterEach(cleanup);

describe("me/orders route boundary files", () => {
  // ==========================================================================
  // Case 1 — loading.tsx matches its OWN page's size and padding
  // Rejects: the origin's `size="small" padding="compact"` copied verbatim;
  // any padding drift between the skeleton and the page (the jump
  // history/loading.tsx:9-12 documents); a skeleton with no PageContainer.
  // ==========================================================================
  it("renders a skeleton whose container matches the page's size and padding", async () => {
    // The page is streamed (it renders async children); the two boundary files
    // are synchronous client components and go through @testing-library/react,
    // which is what the focus and click cases below need.
    const page = await renderServerTree(await MyOrdersPage());
    const pageScaffold = scaffoldOf(page.container);

    const skeleton = render(<Loading />);

    expect(scaffoldOf(skeleton.container)).toEqual(pageScaffold);
    expect(pageScaffold).toEqual([...EXPECTED_SCAFFOLD].sort());
  });

  // ==========================================================================
  // Case 2 — the skeleton is the shipped pulsing-block idiom, sized like rows
  // Rejects: a spinner; a skeleton with no row placeholders (a bare heading
  // block would leave the page height jumping when three rows arrive).
  // ==========================================================================
  it("renders pulsing row placeholders, not a spinner", () => {
    const { container } = render(<Loading />);

    const pulsing = container.querySelectorAll(".animate-pulse");
    expect(pulsing.length).toBeGreaterThanOrEqual(3);

    const rowBlocks = container.querySelectorAll(".animate-pulse.h-20");
    expect(rowBlocks).toHaveLength(3);
  });

  // ==========================================================================
  // Case 3 — error.tsx focuses its role="alert" on mount and matches the page
  // Rejects: an alert that is never focused (the FE-AC-12 requirement); a
  // wrapper without tabIndex={-1} (focus() on a non-focusable node is a no-op,
  // so the two assertions are one requirement); a container that does not
  // match the page.
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
  // Rejects: a retry that reloads the route by other means; a control below
  // the touch-target minimum (the origin's own gap); `common.retry` ("Retry")
  // in place of `common.tryAgain`.
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
  // included); logging `error.message` beside the digest; logging nothing at
  // all. A payment route's error message may carry an order code or a provider
  // sentence, and §Security Considerations forbids that reaching a log.
  //
  // ASSERTED ON THE SHAPE, NOT ON A SERIALISATION. A first version of this case
  // compared `JSON.stringify(args)` and let `console.error(msg, { error })`
  // through: `digest` is an ENUMERABLE own property of the error object, so the
  // whole-object form stringifies to `{"error":{"digest":"…"}}` — it contains
  // the digest, it hides the message (Error#message is non-enumerable), and it
  // satisfied every string assertion while shipping the object that the server
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
      const carriers: unknown[] = [
        ...args,
        ...Object.values(payload as Record<string, unknown>),
      ];
      expect(carriers.some((a) => a instanceof Error)).toBe(false);

      // …and the message text itself appears nowhere, even walking into any
      // Error that a future edit might nest.
      const walked = carriers
        .map((a) => (a instanceof Error ? `${a.message} ${a.stack ?? ""}` : String(a)))
        .join(" ");
      expect(walked).not.toContain(SECRET_MESSAGE);
    } finally {
      spy.mockRestore();
    }
  });
});
