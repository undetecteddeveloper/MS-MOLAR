// User Support System v1 — fixture data + Driver interface for the two
// support-system fixture-e2e skeletons (support-widget-visibility.fixture.e2e.test.ts,
// support-ticket-submission.fixture.e2e.test.ts).
//
// This repo has no `@playwright/test` dependency and no `playwright.config.ts`
// committed (only the Playwright MCP browser-automation server is configured
// for interactive/manual sessions) and no request/route-mocking layer (no MSW,
// no test-mode query override). Wiring `submitSupportTicket`/`getCurrentUser`
// fixture data into a real running page is therefore a documented RESIDUAL,
// exactly like `rating.fixture.e2e.test.ts`/`history.fixture.e2e.test.ts`
// already record for their own fixture-backend gaps — not a blocker unique to
// this task. The mechanism this repo has settled on (frontend DD's own Mock
// Boundary Decision: "submitSupportTicket ... Yes (module boundary)") is a
// test-only module-boundary override point that task-09 (SupportWidget) is
// asked to honor when it wires the widget to the real action — e.g. importing
// `submitSupportTicket` through a re-exported binding this fixture module can
// override in a Playwright MCP session via `page.route`/module alias, or a
// dependency-injection prop threaded down to `SupportWidgetDialog`. Recording
// the decision here (Investigation Notes equivalent) rather than inventing an
// MSW-style solution beyond this repo's established convention.
//
// SupportDriver is a structural SUBSET of Playwright's real `Page`/`Locator`
// API (`goto`, `url`, `getByRole`, `getByLabelText`, `getByText`, `.click`,
// `.fill`, `.setInputFiles`, `.getAttribute`, `.first`, `.count`,
// `.textContent`, plus `.boundingBox`/`setViewportSize` for Obligation C's
// real-layout requirement) — a real Playwright `Page` satisfies this
// interface as-is, matching the FE2Driver/HistoryDriver precedent exactly.

import type { SubmitTicketResult, TicketIntent } from "@/lib/support/types";

// --- Fixture user / routes --------------------------------------------------

export const FIXTURE_USER = { id: "support-fixture-user-1", email: "fixture-support@example.com" };

/** Any real non-attempt mounted route (UI-D1) — widget renders here when logged in. */
export const FIXTURE_MOUNTED_ROUTE = "/exams";

/** A `(layer2)` exam-attempt route shape — widget must be structurally absent (AC-005, D1). */
export const FIXTURE_ATTEMPT_ROUTE = "/exams/exam-fixture/attempt/attempt-fixture";

// --- submitSupportTicket response fixtures ----------------------------------

export const FIXTURE_SHORT_REF = "ab12cd34";

export const FIXTURE_SUCCESS: SubmitTicketResult = { ok: true, shortRef: FIXTURE_SHORT_REF };

export const FIXTURE_REFUSALS = {
  invalid: { error: "invalid" },
  unauthenticated: { error: "unauthenticated" },
  rate_limited: { error: "rate_limited" },
  screenshot_rejected: { error: "screenshot_rejected" },
  server: { error: "server" },
} as const satisfies Record<string, SubmitTicketResult>;

/** Drives the client-side ~20s submit-timeout race (AC-039) — never settles. */
export function fixtureNeverResolvingSubmit(): Promise<SubmitTicketResult> {
  return new Promise(() => {});
}

export const FIXTURE_INTENTS: readonly TicketIntent[] = ["bug", "suggestion", "question"];
export const FIXTURE_INTENT_LABELS: Record<TicketIntent, string> = {
  bug: "Báo lỗi",
  suggestion: "Góp ý",
  question: "Câu hỏi",
};

// --- Driver (Playwright `Page`/`Locator` structural subset) ----------------

export interface SupportRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SupportLocator {
  click(): Promise<void>;
  fill(value: string): Promise<void>;
  setInputFiles(path: string): Promise<void>;
  isVisible(): Promise<boolean>;
  getAttribute(name: string): Promise<string | null>;
  /** null = element not in DOM / not laid out — real Playwright semantics. */
  boundingBox(): Promise<SupportRect | null>;
  first(): SupportLocator;
  count(): Promise<number>;
  textContent(): Promise<string | null>;
  /** Current value of an input/textarea/select — real Playwright Locator method. */
  inputValue(): Promise<string>;
}

export interface SupportDriver {
  goto(url: string): Promise<void>;
  url(): string;
  setViewportSize(size: { width: number; height: number }): Promise<void>;
  getByRole(role: string, options?: { name?: string | RegExp }): SupportLocator;
  getByLabelText(text: string | RegExp): SupportLocator;
  getByText(text: string | RegExp): SupportLocator;
  /**
   * Raw DOM query count (not accessibility-tree-only) — Obligation B(b) needs
   * this to rule out a `display:none`/`aria-hidden` node that a `getByRole`
   * query alone might also (correctly) report as zero, without proving no
   * node exists at all.
   */
  querySelectorCount(selector: string): Promise<number>;
}
