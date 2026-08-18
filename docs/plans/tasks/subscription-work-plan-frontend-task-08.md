# Task: ★ Frontend early verification point — `/me/orders` renders a real, non-empty list

Plan mapping: `docs/plans/subscription-work-plan.md` — **Phase 3, plan Task 3.8**
Layer: **frontend** (browser observation of the S-05 surface)

Metadata:
- Dependencies: frontend-task-06 (S-05), frontend-task-07 (C-11), backend-task-11 (dev has `payment_orders`), backend-task-18 (an order exists to list)
- Provides: the ★ frontend early verification observation recorded in the plan Phase 3 criteria
- Size: Small (no source file changed unless the check fails)

## Implementation Content

`/me/orders` renders a **real, non-empty** list for a signed-in user, with **C-11 above it**, against **dev** (which has `payment_orders` after plan Task 1.3).

Observe and record:
- rows **newest first**;
- each showing **`DD/MM/YYYY HH:mm` in ICT**, a **thousands-separated amount** and a **raw `orderCode`**;
- C-11 rendering **four items** — or the **one sentence**, with **no `0` and no `—`**;
- **zero horizontal overflow at 360px**;
- the **keyboard sweep** reaching every control.

## Target Files
- [ ] (none — an observation; record the observed values in the plan Progress Tracking, Phase 3 Notes)

## Investigation Targets
- `SOURCE/app/(billing)/me/orders/page.tsx` and its `_components/` (plan Tasks 3.6, 3.7 — the surface under observation)
- `SOURCE/app/(billing)/queries.ts` (plan Task 3.5 — the `created_at desc` ordering being observed)
- `SOURCE/lib/format/datetime.ts`, `SOURCE/lib/format/number.ts` (plan Task 2.3 — the formatters whose output is being read)
- `SOURCE/scripts/pw/cli.mjs` (`npm run pw` — the browser driver used for the 360px observation)
- `docs/design/subscription-frontend-design.md` (§ Early verification point)
- `docs/plans/subscription-work-plan.md` (§ Verification Strategy — Early Verification Point, success criteria and failure response)

## Operation Verification Methods
- **Verification method**: sign in against dev, seed at least one order, open `/me/orders` in a real browser at 360px, and walk the page by keyboard.
- **Success criteria**: rows newest first; each showing `DD/MM/YYYY HH:mm` in ICT, a thousands-separated amount and a raw `orderCode`; C-11 rendering four items (or the one sentence, with **no `0` and no `—`**); **zero horizontal overflow at 360px**; the keyboard sweep reaching every control.
- **Failure response**:
  - **if C-11 shows Free for a Premium user, stop** — the route group or the provider mount is wrong and **every downstream test would pass while the screen lied**;
  - **if a date is one day off, stop** — the `timeZone` pin is missing or a legacy formatter was used.
  **Neither is a defect to work around; both invalidate the design premises.**
- **Verification level**: L1.

## Proof Obligations
- **Claim**: the whole read path — schema, query, mapper, provider, formatters, components — produces a correct screen for a real user.
- **Primary failure mode**: each layer is individually green while the composed screen is wrong (Free shown for a Premium user; a date one day off) — the failure mode that has already occurred three times in this repository at the schema gate and once at the provider mount.
- **Boundary to exercise**: a real browser against the dev database, signed in as a real user.
- **State assertion**: a seeded Premium subscription and at least one `payment_orders` row are observable on the screen with their real values.
- **Mock boundary rationale**: **none** — nothing is mocked; that is the point of this checkpoint.
- **Residual**: the second verification point (alert survival across `router.refresh()`, focus retention, badge/C-11 agreement) is plan Task 6.5, item (iii).

## Completion Criteria
- [ ] ★ Frontend early verification point passed, with the observed values recorded
- [ ] Zero horizontal overflow at 360px, **measured, not eyeballed**
- [ ] Keyboard sweep reaches every control
- [ ] **No production deploy of this branch has occurred**

## Notes
- Impact scope: observation only; a failure routes back to the owning task (plan Task 2.2 for the provider, plan Task 2.3 for the formatter).
- Scope boundary: no code change in this task.
