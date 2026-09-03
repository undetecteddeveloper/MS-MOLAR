# Task: ⚠ MANUAL — browser passes (the load-bearing accessibility and layout checks)

Plan mapping: `docs/plans/subscription-work-plan.md` — **Phase 6, plan Task 6.5**
Layer: **frontend** (manual browser verification of both screens)

Metadata:
- Dependencies: frontend-task-06, 07, 10, 11, 12 (both screens shipped); backend-task-28 (prod gate B) for any production observation
- Provides: **FE-AC-26** and the **frontend second verification point** — neither of which any automated gate in this repository can replace
- Size: Small (no source file changed unless a fallback is required)

## ⚠ Manual checkpoint — requires a human and a real device

`npm run pw` **plus a real mid-range Android**. **A green unit test does not discharge item (iv).** This repository has **no visual-regression and no axe harness**, and `eslint.config.mjs:1-23` adds **no `jsx-a11y` rules** — so this pass is the load-bearing accessibility check (PRD UI Quality Metric #2).

## Implementation Content

- **(i)** Golden states **11-24** at **360px** and in **greyscale**.
- **(ii)** The **keyboard sweep** — every control on **both** screens reachable **including every `aria-disabled` one**, with **no element carrying the native `disabled` attribute or property**.
- **(iii)** **The frontend second verification point** — activate re-check on a **genuinely paid** order and confirm:
  - the `role="alert"` node is **still in the DOM with its text after the server re-render lands** (**R-1 / A5**),
  - `document.activeElement` is **still the re-check control** (**R-1 / A5b**),
  - the badge **changed**,
  - and **C-11 above it agrees with the badge** (**R-2 / A6**).
- **(iv)** **FE-AC-26** — signed in as a user whose `tutor` quota is `known`, the note renders a `<p>` with the **remaining count and the reset date** beside **both** affordance call sites on the result-detail page.

### Fallbacks, if (iii) fails
- **For R-1**: lift the outcome to a **mounted client parent** that owns a single announcement and restores focus (the shape all three shipped `router.refresh()` precedents use) — **one thin client wrapper around `OrderList` on S-05**; on S-06 `PaymentConfirm` is already that parent.
- **For R-2**: on `{settled:true}` **only**, `router.push("/me/orders")` followed by `router.refresh()`.

## Target Files
- [ ] (none by default — a fallback, if triggered, edits `SOURCE/app/(billing)/me/orders/_components/` or `PaymentConfirm.tsx`)
- [ ] Record all four observations in the plan Progress Tracking, Phase 6 Notes

## Investigation Targets
- `SOURCE/scripts/pw/cli.mjs` and `SOURCE/package.json:14` (`npm run pw` — the browser driver)
- `SOURCE/components/billing/RecheckOrderControl.tsx` (plan Task 3.7 — the control whose focus and alert behaviour is under observation)
- `SOURCE/features/billing/components/orders/PlanSummary.tsx` and `OrderList.tsx` (C-11 and the S-05 list; `OrderList` is the R-1 fallback wrap site)
- `SOURCE/features/billing/components/checkout/PaymentConfirm.tsx` (already a mounted client parent on S-06)
- `SOURCE/components/billing/TutorQuotaNote.tsx` and `SOURCE/app/(exams)/exams/[id]/attempt/[attemptId]/result/detail/page.tsx` (`:177`, `:230` — item (iv))
- `SOURCE/eslint.config.mjs` (`:1-23` — evidence that **no** `jsx-a11y` rule exists, which is why this pass is load-bearing)
- `docs/ui-spec/subscription-ui-spec.md` (golden states 11-24)
- `docs/design/subscription-frontend-design.md` (§ Second verification point / R-1 / R-2)
- `docs/design/subscription-frontend-design.md` (§ Verification Strategy row 7 / FE-I8)

## Quality Assurance Mechanisms
- Manual browser pass at 360px + greyscale (`npm run pw` + a real mid-range Android) — **the load-bearing accessibility and layout check** (PRD UI Quality Metric #2); golden states 11-24 — Config: `SOURCE/package.json:14`, `SOURCE/scripts/pw/cli.mjs` — Covered: `SOURCE/app/(billing)/me/orders/**`, `SOURCE/app/(billing)/pricing/checkout/**`, the result-detail page
- Visual-regression / axe — **noted, not adopted**: neither exists in this repository

## Operation Verification Methods
- **Verification method**: a human walks both screens at 360px and in greyscale on a real mid-range Android, performs the keyboard sweep, activates re-check on a genuinely paid order, and views the result-detail page as a signed-in user with a `known` tutor quota.
- **Success criteria**: golden states 11-24 render correctly with **zero horizontal overflow**; every control reachable and **no native `disabled`** anywhere; all four observations of (iii) hold; (iv) shows the note beside **both** call sites.
- **Failure response**: apply the recorded fallback for the failing item — **R-1**: the mounted client parent wrapper; **R-2**: `router.push("/me/orders")` then `router.refresh()` on `{settled:true}` only. Do not weaken the observation.
- **Verification level**: L1 (real device, real user, real data).

## Proof Obligations
- **Claim (FE-AC-26 / AC-042)**: a signed-in user with a `known` tutor quota **sees** the note on the result-detail page.
- **Primary failure mode**: **a provider-wrapped unit test supplies the very thing production would be missing** — so a permanently-`null` mount ships green. **A green unit test does not discharge this.**
- **Boundary to exercise**: the real production-shaped route tree in a real browser, signed in.
- **State assertion**: the note `<p>` is present beside **both** call sites, carrying the remaining count and the reset date.
- **Mock boundary rationale**: **none** — nothing is mocked.
- **Residual**: none for this claim; it is the terminal proof.

- **Claim (R-1 / R-2, the second verification point)**: the outcome announcement and focus survive the server re-render, and C-11 agrees with the badge.
- **Primary failure mode**: `router.refresh()` remounts the subtree, dropping the `role="alert"` node and the focus — invisible to fixture-e2e because the server re-render is not real there. **A5, A5b and A6 are all `Confirmed: No`.**
- **Boundary to exercise**: a real browser against a genuinely paid order.
- **State assertion**: alert present with its text **after** the re-render; `document.activeElement` unchanged; badge changed; C-11 consistent with the badge.
- **Mock boundary rationale**: none.
- **Residual**: if it fails, the fallbacks above are the recorded remedies — they are design decisions already taken, not new ones.

## Completion Criteria
- [ ] Golden states 11-24 verified at 360px and in greyscale on a real mid-range Android
- [ ] Keyboard sweep complete on both screens; **no native `disabled`** attribute or property anywhere
- [ ] All four observations of the second verification point recorded (R-1 / A5, R-1 / A5b, badge change, R-2 / A6)
- [ ] **FE-AC-26 observed** — the note renders beside **both** affordance call sites
- [ ] Any triggered fallback applied as recorded, and re-verified

## Notes
- Impact scope: observation; a triggered fallback is a small, recorded code change.
- Scope boundary: `SOURCE/components/tutor/ExplainStepAffordance.tsx` stays unmodified; the R-2 fallback applies **on `{settled:true}` only**.
