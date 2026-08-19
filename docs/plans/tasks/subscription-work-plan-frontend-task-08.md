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
- [x] ★ Frontend early verification point passed, with the observed values recorded
- [x] Zero horizontal overflow at 360px, **measured, not eyeballed**
- [x] Keyboard sweep reaches every control
- [x] **No production deploy of this branch has occurred**

## Notes
- Impact scope: observation only; a failure routes back to the owning task (plan Task 2.2 for the provider, plan Task 2.3 for the formatter).
- Scope boundary: no code change in this task.

## Investigation Notes

Read before observation (plan Task 3.8 — browser half):

- `SOURCE/app/(billing)/me/orders/page.tsx` — server component. Auth gate (`getCurrentUser()` → `redirect("/?auth=signin")`) runs **before** `listMyOrders()`. Render order is fixed in JSX: `PageHeader` → `<PlanSummary />` → `<OrderList orders={orders} />`, so C-11 sits above the list by construction. No sort at this layer.
- `SOURCE/app/(billing)/queries.ts` — `listMyOrders()` reads `order_code, amount, status, created_at, pending_until` from `payment_orders` with `.order("created_at", { ascending: false })` (line 95), mapping `order_code` through `Number()` (line 102). Newest-first is declared **once**, in SQL.
- `_components/OrderList.tsx` — invariant: never re-sorts or filters; renders `<ul>` of `<OrderRow>` keyed by `orderCode`. Empty state is a dashed panel, not an alert.
- `_components/OrderRow.tsx` — three AC-026 values per row: `formatDateTime(order.createdAt, locale)`, `t("billing.amount", { amount: formatVnd(order.amountVnd, locale) })` (format-then-translate), and `String(order.orderCode)` raw (no grouping). "Continue paying" link is gated on `status === "pending" && Date.parse(pendingUntil) > Date.now()` — both conjuncts, `pendingUntil` taken as given, never recomputed from `created_at`.
- `_components/PlanSummary.tsx` — `"use client"`, reads `useEntitlement()`; provider is mounted only in `(billing)/layout.tsx`, which is why the route lives under `(billing)`. Renders `<dl>` with the plan `Pair` always present plus three quota `Pair`s **only when `tutor.state === "known" && upload.state === "known"`**; otherwise one sentence `t("billing.quota.unavailable")` and no `0`/`—`.
- `SOURCE/lib/format/datetime.ts` — `timeZone: "Asia/Ho_Chi_Minh"` pinned in both `DATE_OPTIONS` and `TIME_OPTIONS`; locale tag passed explicitly (`vi-VN` / `en-GB`); date and time formatted separately and joined by one space; `"—"` for null/unparseable, never throws.
- `SOURCE/lib/format/number.ts` — `Intl.NumberFormat(LOCALE_TAG[locale])`, digits only, no unit; `"—"` only for non-finite.
- `SOURCE/scripts/pw/cli.mjs` — `npm run pw -- <cmd>`; persistent session via a detached server keyed by a port file in tmp; `eval` returns JSON-able results from page context.
- Plan § Verification Strategy → Early Verification Point and frontend DD § Early verification point: two STOP conditions — C-11 showing Free for a Premium user (route group / provider mount wrong), and a rendered date one calendar day off (timezone pin missing or legacy formatter).

Observation is read-only by design, and it stayed read-only for the observation itself. One deviation was required and accepted before the observation could exist at all: C-11 was never mounted on the page by plan Tasks 3.6/3.7 — a gap in the task decomposition, not a defect in either task's own output — so `/me/orders` rendered no `PlanSummary` to observe. Mounting it falls under this task's own Size clause, "no source file changed **unless the check fails**". Deviation recorded at the end of this section.

### Observed values (browser half, 2026-08-19, dev, signed in as `smithnguyen247+rlstesta@gmail.com` / "AnhPhat")

Driver: `npm run pw` (Chromium). App at `http://localhost:3000`. Host TZ `Asia/Saigon`.

1. **Row order** — `['5500000000103','5500000000102','5500000000101']` in document order (`main ul > li`), `rowCount: 3`. Newest first. **PASS**
2. **Timestamps** — `19/08/2026 19:30`, `17/08/2026 19:35`, `10/08/2026 19:35`. Match the ICT column exactly; each is seeded-UTC + 7h (12:30Z → 19:30), i.e. **not** the UTC value. No date is one day off. **PASS**
   Pin evidence beyond the host TZ: with `TZ=UTC`, `datetime.ts`'s pinned options render `19/08/2026 19:30` while unpinned options render `19/08/2026 12:30` — the screen shows the pinned output. No hydration-mismatch warning in console (C-11 formats client-side).
3. **Amount / raw `orderCode`** — `39,000 VND` per row under `en`; `39.000 VNĐ` under `vi`. Thousands-separated in both, never `39000`. `orderCode` renders raw in both locales: `5500000000103`, no separator, `codeHasDot: false` — decisive under `vi-VN`, where the amount in the *same paragraph* is dot-grouped but the code is not. **PASS**
4. **C-11** — `itemCount: 4`: `Current plan / Premium · until 08/09/2026`, `Period resets / 08/09/2026`, `Tutor hints / 500 of 500 hints left`, `Exam uploads / 15 of 15 uploads left`. **Premium, not Free.** No fallback sentence, no `0`, no `—`. Above the list (`c11AboveList: true`; section top 157 vs list top 335). **PASS**
5. **360px overflow** — at 360×780: `scrollWidth 360`, `clientWidth 360`, `overflowPx 0`, `horizontallyScrollable false`, elements wider than viewport = **0**. Re-measured under `vi` (longer strings): identical, `overflowPx 0`, 0 offenders. **PASS**
6. **Keyboard sweep** — 13 stops, cycle closes: Skip to content → header Home → `Switch to Tiếng Việt` → account `A` → **`Continue paying` → `/pricing/checkout?order=5500000000103`** → bottom nav Home/Exams/Analytics/History/Upload → `Send feedback` → `NEXTJS-PORTAL` (dev overlay, 0×0) → BODY → wraps. No element carries `disabled` or `aria-disabled`. Rows …102 and …101 expose no focusable control, which is correct — only …103 is `pending` with a future `pending_until`. **PASS**
7. **Console** — 1 error + 1 warning, both global and pre-existing, neither from S-05: CSP blocks `va.vercel-scripts.com` (Vercel Web Analytics, dev), and the `brand_logo.png` aspect-ratio warning from the navbar. No React error, no hydration mismatch, no error from C-07/C-08/C-11. **PASS**

Also observed: the fixed bottom nav does not obscure content — at max scroll the last row ends at y=684 and the nav starts at y=723.

Screenshot: `SCREENSHOT/temporary_screenshot/task-3.8-me-orders-360px.png` (360px, full page; the fixed nav/support widget appear mid-page there — a full-page-capture artifact of `position: fixed`, not a layout defect, disproved by the measurement above).

**Result: ★ early verification point PASSED. Neither STOP condition triggered** (C-11 shows Premium; no date is one day off).

### Deviation record — one source file changed

- `SOURCE/app/(billing)/me/orders/page.tsx` — `<PlanSummary />` mounted between `PageHeader` and `OrderList`, and the stale future-tense comment at `:16` ("C-11 … sẽ đứng giữa") rewritten to the present. Without this line the observation above has no subject: the screen as shipped by plan Tasks 3.6/3.7 renders no C-11 at all, and the ★ check would have reported the absence of a component rather than the correctness of one.
- `SOURCE/app/(billing)/me/orders/__tests__/pageMountsPlanSummary.test.tsx` (new, 4 cases) — locks the mount so the same gap cannot reopen silently: exactly ONE C-11, in document order after the `<h1>` and before the first `<li>`, inside `PageContainer` and never inside the list's `<ul>`/`<li>`; still present above the empty-state box when the user has no orders; the four AC-056 values coming from an ancestor-supplied entitlement rather than `FREE_FALLBACK`; and exactly one layout on this page's chain mounting `EntitlementProvider`, that one being `(billing)/layout.tsx`.
- Nothing else changed. The frozen set is untouched.

Residual on the fourth case: it reads the layout files as SOURCE TEXT, so it kills a provider mount that is deleted or that moves to another layout on the chain, but it cannot see a mount that is present and does not wrap `{children}` (verified by mutation: that shape leaves all four cases green). The behavioural cover for that shape is a real `RootLayout → (billing)/layout → page` render, whose natural home is the FE-3 skeleton in `SOURCE/tests/e2e/fixture/subscription.fixture.e2e.test.ts` — written up there, not yet implemented.
