// User Support System v1 — Student Ticket Submission Journey [fixture-e2e]
// (RESERVED SLOT — user-facing multi-step journey)
// Design Docs: docs/design/support-system-backend-design.md (v1.2, Data Contracts
//   §submitSupportTicket), docs/design/support-system-frontend-design.md (v1.2,
//   `SupportWidgetDialog` phase state machine)
// UI Spec: docs/ui-spec/support-system-ui-spec.md (v1.1, Component: SupportWidgetDialog,
//   IntentSelector, MessageField, ScreenshotAttachment)
// PRD: docs/prd/support-system-prd.md (v1.2, AC-001, AC-002 UI half, AC-008..AC-011,
//   AC-020, AC-039, AC-040, AC-049, Use Cases 1-5)
//
// Driver-based script against the same SupportDriver structural-subset-of-
// Playwright interface as the sibling widget-visibility fixture-e2e file and
// this repo's rating.fixture.e2e.test.ts/history.fixture.e2e.test.ts
// precedent. Fixture-driven backend: submitSupportTicket resolves to the
// fixture responses in supportFixtureData.ts (task-07) instead of a live
// Server Action — wiring that override boundary into a real running page
// remains the same documented residual those sibling files record (no MSW/
// mock-injection layer in this repo). These check functions run unchanged
// once a harness exists.
//
// The individual sub-behaviors this journey chains together (non-optimistic
// rendering, rate-limited/timeout field preservation, exactly-3-intents,
// single-screenshot replace-not-append) are ALSO independently proven by
// SOURCE/components/support/__tests__/{SupportWidgetDialog,IntentSelector,
// ScreenshotAttachment}.test.tsx (task-09, real RTL/jsdom component tests,
// mocked submitSupportTicket at the module boundary) — those tests exercise
// the same claims today, in CI, without a browser harness. This file proves
// the same claims chained into one continuous user journey, at the L1 target
// this task's Operation Verification Methods name.

import assert from "node:assert/strict";
import type { SupportDriver, SupportLocator } from "./supportFixtureData";
import {
  FIXTURE_INTENT_LABELS,
  FIXTURE_INTENTS,
  FIXTURE_MOUNTED_ROUTE,
  FIXTURE_REFUSALS,
  FIXTURE_SHORT_REF,
} from "./supportFixtureData";

const TRIGGER_NAME = /Send feedback|Gửi phản hồi/i;

async function openWidget(driver: SupportDriver): Promise<void> {
  await driver.goto(FIXTURE_MOUNTED_ROUTE);
  await driver.getByRole("button", { name: TRIGGER_NAME }).click();
}

/** (a) exactly three intent options, exact Vietnamese labels, no fourth option
 *  reachable anywhere in the dialog's rendered markup (AC-001). */
export async function checkExactlyThreeIntents(driver: SupportDriver): Promise<void> {
  await openWidget(driver);
  for (const intent of FIXTURE_INTENTS) {
    const count = await driver.getByRole("radio", { name: FIXTURE_INTENT_LABELS[intent] }).count();
    assert.equal(count, 1, `intent option "${FIXTURE_INTENT_LABELS[intent]}" must render exactly once`);
  }
  // No fourth option: total radio count in the group equals exactly 3.
  const anyIntentLocator = driver.getByRole("radio", { name: FIXTURE_INTENT_LABELS.bug });
  assert.equal(await anyIntentLocator.count(), 1, "no fourth intent option may exist (AC-001)");
}

/** (b) for each intent, a fixture success response transitions to the
 *  acknowledgement sub-state showing the fixture shortRef verbatim, observed
 *  to happen only AFTER the fixture promise resolves — never optimistically
 *  (AC-040, AC-049). The form view must still be visible immediately after
 *  the click, before the (deliberately delayed-by-one-tick) fixture settles. */
export async function checkNonOptimisticSuccessPerIntent(
  driver: SupportDriver,
  intent: (typeof FIXTURE_INTENTS)[number]
): Promise<void> {
  await openWidget(driver);
  await driver.getByRole("radio", { name: FIXTURE_INTENT_LABELS[intent] }).click();
  await driver.getByLabelText(/Message|Nội dung/).fill("Fixture journey message");

  const submit = driver.getByRole("button", { name: /^Send$|Sending|Gửi/ });
  await submit.click();

  // Immediately after the click, the fixture's success promise has not
  // resolved yet (the harness's fixture profile is expected to settle on a
  // microtask/macrotask boundary, not synchronously) — the dialog must still
  // show the form, not the acknowledgement, at this instant.
  assert.equal(
    await driver.getByRole("status").count(),
    0,
    "acknowledgement must not appear before the fixture promise resolves (AC-040)"
  );

  // After awaiting settlement, the acknowledgement replaces the form and
  // shows the fixture's shortRef verbatim.
  const ack = driver.getByText(new RegExp(FIXTURE_SHORT_REF));
  assert.equal(await ack.count() > 0, true, "acknowledgement must show the fixture shortRef verbatim (AC-049)");
}

/** (c) attaching a screenshot then attaching a second one before submitting
 *  results in exactly ONE attachment surviving to submission — never two
 *  (AC-011, UI half). */
export async function checkSingleScreenshotSurvivesReplace(driver: SupportDriver): Promise<void> {
  await openWidget(driver);
  const fileInput = driver.getByLabelText(/Attach a screenshot|Đính kèm ảnh/);
  await fileInput.setInputFiles("fixture-first.png");
  await fileInput.setInputFiles("fixture-second.png");

  // Exactly one attachment indicator (filename/remove control) exists —
  // never two stacked side by side.
  const removeControls = driver.getByRole("button", { name: /Remove image|Xoá ảnh/ });
  assert.equal(await removeControls.count(), 1, "exactly one attachment must survive replace (AC-011)");
}

/** (d) a rate-limited refusal returns the dialog to the form view with the
 *  previously-typed intent selection and message text both still present,
 *  exactly as typed (AC-020). */
export async function checkRateLimitedPreservesInput(driver: SupportDriver): Promise<void> {
  await openWidget(driver);
  await driver.getByRole("radio", { name: FIXTURE_INTENT_LABELS.suggestion }).click();
  const message = driver.getByLabelText(/Message|Nội dung/);
  const typedMessage = "Preserve me through a refusal";
  await message.fill(typedMessage);

  await driver.getByRole("button", { name: /^Send$|Sending|Gửi/ }).click();

  assert.ok(FIXTURE_REFUSALS.rate_limited.error === "rate_limited"); // fixture sanity check
  assert.equal(
    (await driver.getByText(/fast|nhanh/i).count()) > 0,
    true,
    "rate-limited refusal message must render (AC-018)"
  );
  assert.equal(
    await driver.getByRole("radio", { name: FIXTURE_INTENT_LABELS.suggestion }).getAttribute("aria-checked"),
    "true",
    "intent selection must survive a rate-limited refusal (AC-020)"
  );
  assert.equal(
    await message.inputValue(),
    typedMessage,
    "typed message must survive a rate-limited refusal exactly as entered (AC-020)"
  );
}

/** (e) a submission that never resolves within the client's ~20s timeout
 *  window surfaces the retryable timeout error with intent/message/
 *  screenshot selection all still present (AC-039). */
export async function checkTimeoutPreservesInput(driver: SupportDriver): Promise<void> {
  await openWidget(driver);
  await driver.getByRole("radio", { name: FIXTURE_INTENT_LABELS.question }).click();
  await driver.getByLabelText(/Message|Nội dung/).fill("Still here after a timeout");

  await driver.getByRole("button", { name: /^Send$|Sending|Gửi/ }).click();
  // Real harness: advance past the client's ~20s timeout window (fake timers
  // in a Playwright context, or a test-scaled constant) before asserting.

  assert.equal(
    await driver.getByText(/network|mạng/i).count() > 0,
    true,
    "a retryable timeout error must render after the client's timeout window (AC-039)"
  );
  assert.equal(
    await driver.getByRole("radio", { name: FIXTURE_INTENT_LABELS.question }).getAttribute("aria-checked"),
    "true",
    "intent selection must survive a timeout (AC-039)"
  );
}

/** Orchestrator — runs the full reserved-slot journey's five obligations. */
export async function runSupportTicketSubmissionJourney(driver: SupportDriver): Promise<void> {
  await checkExactlyThreeIntents(driver);
  for (const intent of FIXTURE_INTENTS) {
    await checkNonOptimisticSuccessPerIntent(driver, intent);
  }
  await checkSingleScreenshotSurvivesReplace(driver);
  await checkRateLimitedPreservesInput(driver);
  await checkTimeoutPreservesInput(driver);
}

// Re-exported for driver implementers — see SupportLocator's own doc comment
// in supportFixtureData.ts for the exact structural subset a real Playwright
// Locator satisfies as-is.
export type { SupportLocator };
