# Task 04: `lib/ugc/limits.ts` additions + `lib/support/types.ts` + `lib/support/validateScreenshot.ts` (Work Plan Phase 1, Task 1.1)

Metadata:
- Dependencies: none (pure TS, no DB dependency — can run in parallel with Phase 0)
- Provides: `TicketIntent`/`TicketStatus`/`SubmitTicketResult`/`TicketActionState` types + `checkScreenshotFile` (consumed by task-06, task-13); `MAX_SUPPORT_MESSAGE`/`MAX_SCREENSHOT_BYTES`/`ALLOWED_SCREENSHOT_MIME` constants (also consumed by task-01's `setup-storage.ts` bucket config and task-09's client-side pre-validation)
- Size: Small (2 files: `types.ts`, `validateScreenshot.ts` — plus additive edits to `limits.ts`)

## Implementation Content

Add `MAX_SUPPORT_MESSAGE` (1000, TBD-07 resolved), `MAX_SCREENSHOT_BYTES` (8MB), `ALLOWED_SCREENSHOT_MIME` (`["image/png","image/jpeg","image/webp"]`) to `LIMITS` in `SOURCE/lib/ugc/limits.ts`. Create `TicketIntent`/`TicketStatus`/`SubmitTicketResult`/`TicketActionState` closed unions in `SOURCE/lib/support/types.ts`. Create `checkScreenshotFile` in `SOURCE/lib/support/validateScreenshot.ts` (pure, mirrors `checkUploadFile`'s MIME-then-size gate shape). Author fresh unit tests (no skeleton provided for this pure module): exactly-at-limit (pass), one-byte-over (fail `too_large`), each of the three allowed MIME types (pass), a disallowed type e.g. `application/pdf` (fail `invalid_type`).

## Target Files
- [ ] `SOURCE/lib/ugc/limits.ts` (additive — 3 new `LIMITS` entries)
- [ ] `SOURCE/lib/support/types.ts` (new)
- [ ] `SOURCE/lib/support/validateScreenshot.ts` (new)
- [ ] `SOURCE/lib/support/__tests__/validateScreenshot.test.ts` (new, no skeleton — author fresh)

## Investigation Targets
- `docs/design/support-system-backend-design.md` (§ Business Logic — `SOURCE/lib/support/` — literal code for `types.ts`/`validateScreenshot.ts`/`LIMITS` additions; § Test Boundaries / vitest — boundary-fixture list: exact limit / one-over / each allowed MIME / disallowed MIME)
- `SOURCE/lib/ugc/limits.ts` (current `LIMITS` shape and any existing `checkUploadFile`-style function to mirror)
- `SOURCE/lib/ugc/` (`checkUploadFile`'s exact MIME-then-size gate shape — the pattern `checkScreenshotFile` must mirror)

## Investigation Notes

## Implementation Steps (TDD: Red-Green-Refactor)

### 1. Red Phase
- [ ] Read all Investigation Targets and record key observations, in particular `checkUploadFile`'s exact gate order (MIME check before size check, or vice versa) and return-shape convention.
- [ ] Write failing tests in `validateScreenshot.test.ts`: exactly-at-`MAX_SCREENSHOT_BYTES` (pass), one-byte-over (fail `too_large`), each of `image/png`/`image/jpeg`/`image/webp` (pass), `application/pdf` (fail `invalid_type`).
- [ ] Run tests and confirm failure (module doesn't exist yet).

### 2. Green Phase
- [ ] Add the 3 `LIMITS` entries, the 4 closed-union types, and `checkScreenshotFile` exactly per the backend DD's Business Logic block.
- [ ] Run only the added tests and confirm they pass.

### 3. Refactor Phase
- [ ] Improve code (maintain passing tests); confirm naming/typing matches the backend DD's Data Contracts exactly for downstream tasks (task-06, task-13) to consume without further shape changes.
- [ ] Confirm added tests still pass.

## Quality Assurance Mechanisms
- ESLint (`npm run lint`, `--max-warnings 0`) — Enforces: zero new lint errors/warnings — Config: `SOURCE/eslint.config.mjs`
- TypeScript (`npx tsc --noEmit`) — Enforces: type correctness (an unregistered `LIMITS` key or a union-type mismatch is a compile error) — Config: `.github/workflows/ci.yml:51-52`
- Vitest (`npm test`) — Enforces: pure-function unit coverage — Config: `SOURCE/vitest.config.ts` (`include: lib/**`)

## Operation Verification Methods
- **Verification method**: run `validateScreenshot.test.ts`'s boundary-fixture battery (exact limit / one-over / each allowed MIME / disallowed MIME) against the real `checkScreenshotFile` implementation.
- **Success criteria**: all boundary cases pass with literal, independently-computed expected values (not values copied from the implementation).
- **Failure response**: if a boundary case fails, re-check the gate order and comparison operator (`<=` vs `<`) against the backend DD's literal code before adjusting.
- **Verification level**: L2 (new tests added and passing) — this is a pure module with no live-system integration point of its own; its correctness is fully provable by unit tests.

## Proof Obligations
- **Claim**: `checkScreenshotFile` accepts a file exactly at `MAX_SCREENSHOT_BYTES` and rejects one byte over, with reason `too_large`.
- **Primary failure mode**: an off-by-one boundary condition (`<` instead of `<=`, or vice versa) silently shifts the accepted range by one byte.
- **Boundary to exercise**: in-process unit (pure function, no I/O).
- **State assertion**: N/A (pure function, no state).
- **Mock boundary rationale**: none — no I/O to mock.
- **Residual**: none.
- **Claim**: `checkScreenshotFile` accepts each of the three allowed MIME types and rejects a disallowed type, with reason `invalid_type`.
- **Primary failure mode**: the allowed-MIME list check is case-sensitive/malformed, or a disallowed type slips through because the size check runs first and passes.
- **Boundary to exercise**: in-process unit.
- **State assertion**: N/A.
- **Mock boundary rationale**: none.
- **Residual**: none.

## Completion Criteria
- [ ] All added tests pass (boundary-fixture battery)
- [ ] Operation verified per Operation Verification Methods above
- [ ] Each Proof Obligation is met: the test turns red under its primary failure mode
- [ ] Matches the backend DD's Business Logic snippet exactly
- [ ] `tsc`/lint clean

## Notes
- Impact scope: `SOURCE/lib/ugc/limits.ts` (additive only), `SOURCE/lib/support/types.ts`, `SOURCE/lib/support/validateScreenshot.ts`.
- Scope boundary: do not implement `submitSupportTicket` here (task-06's responsibility) or `ScreenshotAttachment`'s client-side pre-validation here (task-09's responsibility, parallel but not shared logic) — this task only builds the shared constants and the server-side pure validation function.
