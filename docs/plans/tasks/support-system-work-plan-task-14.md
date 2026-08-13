# Task 14: `support.admin.*` i18n Keys + Admin Rendering-Layer Components (Work Plan Phase 3, Task 3.2)

Metadata:
- Dependencies: support-system-work-plan-task-13 (Deliverable: real `TicketWithNotes` type + Server Actions), support-system-work-plan-task-12 (Deliverable: fixture harness)
- Provides: `TicketQueueList`/`TicketQueueRow`/`TicketStatusBadge`/`NotificationFailureFlag`/`TicketDetailPanel`/`TicketStatusControl`/`InternalNotesPanel` (consumed by task-15's fixture-e2e journey)
- Size: Large (11 files: 7 components + `loading.tsx`/`error.tsx` + i18n additions) — kept as one task, see Notes

## Implementation Content

Add the admin-facing i18n keys. Create `TicketQueueList`, `TicketQueueRow` (collapsed summary always visible; `NotificationFailureFlag` visible in the collapsed row without expanding, AC-022 UI half), `TicketStatusBadge` (independent `Status`/`CONFIG`, verbatim glyph/label/className map per Reference Contract Values, never merged into `StatusBadge`), `NotificationFailureFlag`, `TicketDetailPanel` (`<p className="whitespace-pre-wrap">` for message/URL/user-agent — never `RichText`, never `dangerouslySetInnerHTML`, R12/AC-037/AC-038; `<img>` for the screenshot, never through a markup-interpreting pipeline, UI-D4/AC-014 — closes document review finding I002), `TicketStatusControl` (`useActionState` + local `statusFormAction` adapter), `InternalNotesPanel` (+`InternalNoteForm`, local `noteFormAction` adapter). Create `admin/tickets/loading.tsx`/`error.tsx` (mirrors `history/loading.tsx`/`error.tsx`'s pattern — skeleton rows + `role="alert"` + `reset()`-wired retry).

## Target Files
- [ ] `SOURCE/lib/i18n/dictionaries/vi.ts` (additive — `support.admin.*` block)
- [ ] `SOURCE/lib/i18n/dictionaries/en.ts` (additive — `support.admin.*` block)
- [ ] `SOURCE/app/(admin)/admin/tickets/TicketQueueList.tsx` (new)
- [ ] `SOURCE/app/(admin)/admin/tickets/TicketQueueRow.tsx` (new)
- [ ] `SOURCE/app/(admin)/admin/tickets/TicketStatusBadge.tsx` (new)
- [ ] `SOURCE/app/(admin)/admin/tickets/NotificationFailureFlag.tsx` (new)
- [ ] `SOURCE/app/(admin)/admin/tickets/TicketDetailPanel.tsx` (new)
- [ ] `SOURCE/app/(admin)/admin/tickets/TicketStatusControl.tsx` (new)
- [ ] `SOURCE/app/(admin)/admin/tickets/InternalNotesPanel.tsx` (new, includes `InternalNoteForm`)
- [ ] `SOURCE/app/(admin)/admin/tickets/loading.tsx` (new)
- [ ] `SOURCE/app/(admin)/admin/tickets/error.tsx` (new, + test files for each component above)

## Investigation Targets
- `docs/design/support-system-frontend-design.md` (§ i18n Key Inventory — `support.admin.*` full key list; § Fact Disposition Table — `statusFormAction`/`noteFormAction` call-shape adapters bridging `useActionState`'s `(prevState, formData)` shape; § Data Contracts — Consumed backend contracts, admin half; § Component specs — full code/props for all 7 components; § Field Propagation Map — `ticketId`/status, `ticketId`/noteText adapter fields; § State Transitions — `TicketQueueRow` expand/collapse local `useState`, never persisted; § Integration Point Map — Admin status/note `useActionState` + hidden-input adapter, Admin read Server Component prop passing; § Verification Strategy correctness definition items (4), (5), (8))
- `docs/ui-spec/support-system-ui-spec.md` (§ Component: TicketQueueList — Default/Loading/Empty/Error; § Component: TicketStatusBadge — Default; § Component: TicketQueueRow — Default/Loading/Partial + Notification-failure flag; § Component: TicketDetailPanel — Default/Partial; § Component: TicketStatusControl — Default/Loading/Error; § Component: InternalNotesPanel — Default/Loading/Empty/Error)
- `SOURCE/app/(admin)/admin/tickets/actions.ts`, `page.tsx` (task-13's real Server Actions + `TicketWithNotes` type — this task consumes both by `import type`/direct call, never re-declares)
- `SOURCE/app/(HM)/history/loading.tsx`, `error.tsx` (the exact pattern to mirror for `admin/tickets/loading.tsx`/`error.tsx` — skeleton rows + `role="alert"` + `reset()`-wired retry)
- An existing `RichText`/sanitized-render component in this repo (to confirm what NOT to use for `TicketDetailPanel`'s message/URL/user-agent fields — those must render via plain `<p className="whitespace-pre-wrap">`, never through any markup-interpreting pipeline)
- `SOURCE/lib/i18n/dictionaries/vi.ts`, `en.ts` (current structure, to confirm placement of the new `support.admin.*` block relative to task-08's `support.*` block)

## Reference Contracts

| Source | Contract Type | Required Observable Value | Compliance Check |
|---|---|---|---|
| docs/design/support-system-frontend-design.md (§ Data Contracts — `TicketStatusBadge` `CONFIG`) | derived-display | `` new: { glyph: "✉", labelKey: "support.admin.status.new", className: "border-border text-muted-foreground" }, in_progress: { glyph: "▶", labelKey: "support.admin.status.inProgress", className: "border-[#B8863B] text-[#8a6420]" }, resolved: { glyph: "✓", labelKey: "support.admin.status.resolved", className: "border-[#3f7d4f] text-[#2f6b3f]" } `` | Does `TicketStatusBadge`'s `CONFIG` map reproduce this exact glyph/labelKey/className triple for each of the three `TicketStatus` values, verbatim (Y/N)? |

## Boundary Context (Connection Map)

**Boundary 1**: `TicketStatusControl` (browser) → `changeTicketStatusAction` (Server Action). This task owns the **left-side / adapter** owner (`SOURCE/app/(admin)/admin/tickets/TicketStatusControl.tsx`); the right-side action owner (`SOURCE/app/(admin)/admin/tickets/actions.ts`) is task-13.
- **Serialized Format**: Hidden `<input name="ticketId">` + selected `<select name="status">`, both `FormData` fields.
- **Consumer Parse Rule**: local `statusFormAction` wrapper (this task) reads `formData.get("ticketId")`/`"status"`, casts `status` to `TicketStatus`.
- **Roundtrip check this task must satisfy**: this adapter's constructed `FormData` field names exactly match task-13's action's `formData.get(...)` calls; a component test asserts the mocked `changeTicketStatusAction` receives the exact `(ticketId, status)` pair the form was submitted with.
- **Expected Signal**: `TicketActionState` response; the DB CHECK is the authoritative backstop against an invalid `status` value.

**Boundary 2**: `InternalNoteForm` (browser) → `addTicketNoteAction` (Server Action). This task owns the **left-side / adapter** owner; the right-side action owner is task-13.
- **Serialized Format**: Hidden `<input name="ticketId">` + `<textarea name="noteText">`, both `FormData` fields.
- **Consumer Parse Rule**: local `noteFormAction` wrapper (this task) reads both fields.
- **Roundtrip check this task must satisfy**: the adapter's field names exactly match task-13's action's reads.
- **Expected Signal**: `TicketActionState` response; the new note appears in `InternalNotesPanel`'s rendered list on success.

## Investigation Notes

## Implementation Steps (TDD: Red-Green-Refactor)

### 1. Red Phase
- [ ] Read all Investigation Targets and record key observations, in particular the exact `TicketWithNotes` field shape as exported by task-13 (reconcile against the frontend DD's own transcription — a `tsc` mismatch here is Risk R-F2 surfacing as intended).
- [ ] Write failing component tests: a literal `<script>alert(1)</script>`-shaped fixture through `TicketDetailPanel` asserted as inert `textContent`; `TicketStatusControl`'s form submission asserting the mocked `changeTicketStatusAction` receives the exact `(ticketId, status)` pair; `TicketStatusBadge` rendered once per `TicketStatus` value asserting distinct glyph + distinct label; `TicketDetailPanel`'s screenshot rendered exclusively via a real DOM `<img>` whose `src` equals the signed URL verbatim.
- [ ] Run tests and confirm failure (components don't exist yet).

### 2. Green Phase
- [ ] Add `support.admin.*` i18n keys.
- [ ] Implement all 7 components + `loading.tsx`/`error.tsx` exactly per the frontend DD's Component specs and UI Spec's State × Display matrices.
- [ ] Run only the added tests and confirm they pass.

### 3. Refactor Phase
- [ ] Improve code (maintain passing tests); re-confirm the Reference Contract's Compliance Check and both Boundary Context roundtrip checks.
- [ ] Confirm added tests still pass.

## Quality Assurance Mechanisms
- ESLint (`npm run lint`, `--max-warnings 0`) — Enforces: zero new lint errors/warnings — Config: `SOURCE/eslint.config.mjs`
- TypeScript (`npx tsc --noEmit`) — Enforces: type correctness (this is also where `TicketWithNotes`'s field-shape reconciliation, if any, surfaces as a compile error per Risk R-F2) — Config: `.github/workflows/ci.yml:51-52`
- Vitest (`npm test`) — Enforces: component unit/integration coverage — Config: `SOURCE/vitest.config.ts` (`include: app/**`)
- i18n dictionary contract tests — Enforces: vi/en key parity — Config: `SOURCE/lib/i18n/__tests__/i18n.test.ts`
- Production build in CI (`npx next build`) — Enforces: build correctness — Config: `.github/workflows/ci.yml:74-80`

## Operation Verification Methods
- **Verification method**: a literal `<script>alert(1)</script>`-shaped fixture rendered through `TicketDetailPanel` asserted as `textContent`; a component test asserting `TicketStatusControl`'s adapter forwards the exact `(ticketId, status)` pair; a component test asserting `TicketStatusBadge`'s distinct glyph/label per status; a component test asserting `TicketDetailPanel` renders the screenshot only via a plain `<img src>` bound to the signed URL, never through any markup-interpreting render path.
- **Success criteria**: all component tests green, including the new AC-014 `<img>`-only render-path assertion; `tsc`/lint clean.
- **Failure response**: if the `<script>`-shaped fixture test fails (renders as markup instead of inert text), check for an accidental `dangerouslySetInnerHTML` or `RichText` import in `TicketDetailPanel` — this is a direct XSS-shaped defect on a minors' product.
- **Verification level**: L2 (component tests green) at this task's own scope; the full admin journey is proven end-to-end at task-15.

## Proof Obligations
- **Claim**: `TicketDetailPanel` never interprets ticket-message/URL/user-agent content as markup (AC-037, AC-038, R12).
- **Primary failure mode**: a future edit swaps the plain `<p className="whitespace-pre-wrap">` render for `dangerouslySetInnerHTML` or a `RichText` component, reopening an XSS-shaped vulnerability on untrusted user-submitted content.
- **Boundary to exercise**: in-process unit (component test, literal `<script>alert(1)</script>`-shaped fixture).
- **State assertion**: N/A (render-only).
- **Mock boundary rationale**: none — real component, fixture data only.
- **Residual**: none.
- **Claim**: the two admin-action adapters forward the correct `ticketId`/value pair extracted from `FormData` (AC-023, AC-027).
- **Primary failure mode**: a field-name mismatch between the adapter's constructed `FormData` and the action's `formData.get(...)` calls (Boundary Context roundtrip failure), or the adapter forwards a stale/wrong `ticketId`.
- **Boundary to exercise**: in-process unit (component test, mocked `changeTicketStatusAction`/`addTicketNoteAction`).
- **State assertion**: before = ticket in a known status; action = submit the form; after = the mocked action was called with the exact `(ticketId, status)`/`(ticketId, noteText)` pair.
- **Mock boundary rationale**: Server Actions mocked at the module boundary per frontend DD Mock Boundary Decisions.
- **Residual**: real persistence is proven by task-13's own int test + task-15's fixture-e2e journey.
- **Claim**: `TicketStatusBadge` renders a distinct glyph + distinct Vietnamese label per status, never color alone (AC-042).
- **Primary failure mode**: `TicketStatusBadge` conveys status by background color alone with no accompanying glyph/text difference.
- **Boundary to exercise**: in-process unit.
- **State assertion**: N/A.
- **Mock boundary rationale**: none.
- **Residual**: none.
- **Claim**: `TicketDetailPanel` renders the screenshot exclusively via a real DOM `<img>` element whose `src` equals the signed URL string verbatim — never via `dangerouslySetInnerHTML`, never interpolated into the message text block, never through any markup-interpreting render path (AC-014, closes document review finding I002).
- **Primary failure mode**: the screenshot is rendered through a component or prop path that could interpret its value as markup instead of a plain `<img src>` binding.
- **Boundary to exercise**: in-process unit (component test with a fixture signed URL).
- **State assertion**: N/A.
- **Mock boundary rationale**: signed URL is fixture data; no real Storage call in this test.
- **Residual**: none — this closes document review finding I002.
- **Claim**: `TicketQueueList` renders a correct empty state when no tickets exist (`empty input` Failure Mode Checklist category).
- **Primary failure mode**: an empty ticket array renders a blank/broken layout instead of the documented `support.admin.empty` empty state.
- **Boundary to exercise**: in-process unit.
- **State assertion**: N/A.
- **Mock boundary rationale**: none — fixture empty array.
- **Residual**: none.

## Completion Criteria
- [ ] All added component tests pass
- [ ] Operation verified per Operation Verification Methods above
- [ ] Each Proof Obligation is met: the test turns red under its primary failure mode and exercises the stated boundary
- [ ] Matches the frontend DD's Data Contracts for each component exactly, and the UI Spec's State × Display matrices for all 6 UI-Spec-mapped components
- [ ] `tsc`/lint clean (`TicketWithNotes` field-shape reconciliation, if any, resolved here)
- [ ] The Reference Contract's Compliance Check evaluates to `Y`, with evidence recorded in Investigation Notes
- [ ] Both Boundary Context roundtrip checks confirmed, with evidence recorded in Investigation Notes

## Notes
- Impact scope: `SOURCE/lib/i18n/dictionaries/{vi,en}.ts` (`support.admin.*` block only) + `SOURCE/app/(admin)/admin/tickets/**` (new components, `loading.tsx`, `error.tsx`).
- Scope boundary: do not modify `SOURCE/app/(admin)/admin/tickets/actions.ts`/`page.tsx`/`service-role.ts` here — those are task-13's already-completed files, consumed by reference only. This task is kept as one task despite touching 11 files for the same reason as task-09: all 7 components form a single indivisible, mutually-referencing render tree composed inside `page.tsx` (task-13's output) — splitting the mount points across separate commits would leave the admin surface partially wired in an inconsistent intermediate state.
