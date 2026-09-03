# Subscription — Handoff to the implementation session

**Written 2026-08-18.** Design phase approved by the engineer at the `recipe-fullstack-implement` design gate (flow step 14 of 16). Implementation deliberately deferred to a fresh session.

Read this file first. It exists so the next session does not re-derive a day of context.

---

## 1. Where the flow stopped

`recipe-fullstack-implement`, Large-scale fullstack flow (`monorepo-flow.md`), **steps 1–14 done, 15–16 not started.**

| Step | | State |
|---|---|---|
| 1–8 | PRD, external resources, UI Spec + review | done (earlier sessions) |
| 9 | Backend Design Doc | **v1.4** |
| 10 | code-verifier on backend DD | **85 / consistent** (run against v1.2) |
| 11 | Frontend Design Doc | **v1.2** |
| 12 | code-verifier on frontend DD | **51 / needs_review** (run against v1.0; all 11 findings fixed in v1.1) |
| 13 | document-reviewer ×2 | both `needs_revision` → both revised |
| 14 | design-sync | `conflicts_found` — **13 open items, see §3** |
| — | **Engineer approval** | **GIVEN 2026-08-18** |
| 15 | acceptance-test-generator | **not started** |
| 16 | work-planner (fullstack, replaces the backend-only plan) | **not started** |
| — | task-decomposer → build loop | not started |

**Next action:** step 15, then step 16, then batch approval, then decompose + build.

## 2. The document set (all current)

| Document | Version | Note |
|---|---|---|
| `docs/prd/subscription-prd.md` | v1.6 | AC-057 is tier-conditional, not flat ≥50 |
| `docs/ui-spec/subscription-ui-spec.md` | **v1.3** | Approved, **authoritative for UI**. Has a Phase Inversion clause — amend it, never diverge silently |
| `docs/adr/ADR-0013-*` | Accepted | payOS; prepaid period; adapter boundary |
| `docs/adr/ADR-0014-*` | Accepted | webhook is a notification, never an instruction |
| `docs/design/subscription-backend-design.md` | **v1.4** | |
| `docs/design/subscription-frontend-design.md` | **v1.2** | |
| `docs/plans/subscription-backend-work-plan.md` | v1.0 | ⚠ **backend-only and superseded** — step 16 replaces it with a two-layer plan |

`SOURCE/lib/billing/types.ts` is a **frozen contract**. Changing it requires a UI Spec change first, with a reason.

## 3. The 13 unreconciled items design-sync found

The engineer approved **with these open**. They are enumerated with concrete fix instructions in the design-sync report; the two criticals are summarised here because they have teeth.

### CL-01 (critical) — two mappings for one contract
Backend v1.4 created `toCheckoutOrder()` in `SOURCE/lib/billing/checkoutOrder.ts` as the single snake_case → `CheckoutOrder` mapper and deliberately did **not** edit the frontend-owned `features/billing/queries.ts`. The frontend document still specifies its own inline mapping.

**This is the only item that produces a failing test rather than a silent divergence** — the backend already specifies a deep-equality contract test between `createOrder()` and `getMyOrder()`. `pendingUntil` as PostgREST's `+00:00` form ≠ `toISOString()`'s `…Z` form: same instant, different string, and it is the deadline text AC-027 observes.

**Fix:** `getMyOrder()` imports `toCheckoutOrder(row)`. `listMyOrders()`/`MyOrderRow` unaffected.

### CL-02 (critical) — the authoritative document asks for something impossible
UI Spec UI-D17 and C-06's delta still say `TutorQuotaNote` is mounted "receiving `formattedResetDate` computed server-side". **No such producer can exist**: the mount site is an async server component with no entitlement value, and `code:02` forbids a second `readEntitlement()` path.

Frontend v1.2 corrected its own text in three places but **did not escalate**, so the UI Spec is still wrong and the frontend's own fact row `ui:06` still agrees with the wrong version — contradicting its own `code:04`.

**Fix:** amend UI Spec UI-D17 + C-06 delta (no prop is passed; the note formats its own `resetsAt` from provider context inside the existing `tutor.state === "known"` branch). Correct frontend `ui:06`, add escalation row X-13.

### The rest
- **CL-03** — AC-041 and AC-050 are owned by **nobody** (each document assigns them to the other).
- **CL-04** — AC-026/027/035/036/037 claimed by **both**; the backend needs the split notation it already uses for AC-028.
- **ST-01** — FE-B-01/FE-B-02 are closed in backend v1.4 but the frontend still carries them as blocking, so **slice S2 is documented as un-startable when it is startable**.
- **ST-02** — TBD-07 still open in the UI Spec; `createOrder()` now returns the full eight-field `CheckoutOrder`.
- **ST-03** — X-10/X-11/X-12 are satisfied by UI Spec v1.3's actual text; the frontend still lists them as live, with "text to amend" instructions that would re-edit already-corrected text.
- **ST-04, ST-05, CL-05, CL-06** — version and line-citation drift across all three documents.
- **LO-01, LO-02** — UI Spec C-13's Empty/Partial states are narrower than the frontend's (which is a strict superset).
- **Intra-backend near-miss (OK-04):** the backend claims the two new telemetry codes are "the same strings" `consumeQuota()` returns. They are not — `consumeQuota` returns `"user_quota" | "project_budget" | "unavailable"` and AC-022 writes a mapping. Harmless today because nothing renders a code; becomes a cross-layer defect the moment something does.

## 4. Decisions still owned by the engineer

| Item | Blocks | State |
|---|---|---|
| **TBD-02 — legal content (PRD U3)** | **selling, and the real-money webhook test** | `docs/legal/refund-policy.md` has 3 `[điền…]` placeholders and names no legal selling entity (only the brand). **No Terms of Service draft exists at all** — R11 requires two pages. Both routes render `LegalContentPending` |
| **ADR-0018 — QR encoder library** | nothing | First new dependency of this phase; this repo decides dependencies by ADR (precedent ADR-0009). Without it `VietQrCode` renders nothing and S-06 stays payable from the text block — which is what AC-028 requires anyway |
| **E-01 — AC-034 scope** | nothing | The design forbids *storing* payOS `transactions[]` fields; AC-034 currently covers only *logging*. AC-057's comparable extension got a PRD amendment, so this one should too |
| **U2 — real unit cost** | selling | Tracker now records and splits input/output (fixed this session). Still needs a durable production write target and then the measurement |
| **Metric #9 baseline** | selling | 14-day `telemetry_log` query, must run **before** enabling sales (AC-055) |

## 5. Environment facts that cost time to rediscover

- **`TaskCreate` / `TaskUpdate` do not exist in this environment.** The recipe marks task registration mandatory; every agent reported the gap. Progress was tracked in conversation instead.
- **The `recipe-*` skills are `disable-model-invocation`.** The model cannot invoke them and must not reproduce their workflow by other means — the engineer types the slash command, and it must be a **fresh message**, not sent while a turn is running (mid-turn it arrives as plain text and never expands).
- **Concurrent agents racing on one file is real.** Several documents were revised in parallel and could not see each other; that is precisely what design-sync's 5 "stale acknowledgement" items are.
- **`npm run verify:schema`** is `npx tsx supabase/verify-schema.ts` — **not** piped into `check:bundle`, which is a separate script.
- The app root is `SOURCE/`, **not** the repo root. `SOURCE/AGENTS.md` warns this Next.js version differs from model training data.

## 6. What changed in code this session

Only one substantive change; everything else was documents.

`SOURCE/lib/ugc/quotaTracker.ts` + its four call sites + `scripts/dev-status.mjs`:
`recordUsage()` **was dead code** — defined and never called anywhere, while the PRD asserted it was already measuring. U2 therefore had no data. Now: input/output split (including `thoughtsTokenCount`, billed at output rate), a `tutor` role, and `recordUsage()` wired into all four call sites **before** any classification branch, because a failed call still spends tokens and still spends the daily allowance.

**Still open:** the write target is a process temp file, which does not survive across Vercel instances. Setting `UGC_QUOTA_LOG=1` is not sufficient. A durable target needs DDL → it is Phase 1 work in the plan.

Gates at the time of writing: `vitest` 914 pass / 10 skip, `tsc` clean, `eslint` clean, `next build` succeeds. Nothing is committed.
