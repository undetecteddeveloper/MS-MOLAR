# Task: Consolidated post-implementation verification fixes

Plan mapping: `docs/plans/subscription-work-plan.md` — **post-implementation verification fix cycle** (recipe step, not a numbered plan task)
Layer: **backend** (deterministic layer rule — touches `SOURCE/**`, `docs/**`, and two test files)

Metadata:
- Dependencies: backend-task-31 (regression evidence), backend-task-32 (security walk), backend-task-33 (close-out sweep)
- Provides: the fixes required for `code-verifier` ×2 and `security-reviewer` to pass
- Size: Medium

## Where this came from

Three verifiers ran in parallel at `b944751` and **all three failed** the recipe's pass criteria:

| Verifier | Status | Headline |
|---|---|---|
| `security-reviewer` | `needs_revision` | 3 defense gaps; **no confirmed risk, nothing exploitable as shipped** |
| `code-verifier` (backend DD v1.10) | `needs_review` | 13 discrepancies, **5 of them pure citation drift** |
| `code-verifier` (frontend DD v1.8) | `needs_review` | 13 discrepancies, **2 major contract defects** |

**Scope decision, stated so the deferral is deliberate rather than silent.** The verifiers' findings split cleanly into two groups:

- **Group A — substantive**: a control that cannot observe what it is named for, an untested list that is CI's only net, a false logging claim, two authoritative-document contract defects that are *unimplementable as written*, stale state claims that actively mislead a reader, and a self-contradiction introduced today. **This task fixes Group A.**
- **Group B — line-number drift**: roughly 40 stale `file:line` anchors across the two Design Docs, pointing at code that is **present and correct**. The backend verifier said so itself: *"On substance — I1 through I12, all four schema blocks, the two-counter/reservation design, the emit chokepoint, the tier-conditional ceiling and the OK-04 code set — the shipped implementation matches the specification."* **This task records Group B for the documentation-hygiene pass and does not fix it**, because repairing ~40 anchors by hand is exactly the work that re-rots on the next commit and is why the repo adopted the identifier-plus-quoted-phrase citation rule in the first place.

## Implementation Content

### Part 1 — security (3 required fixes)

**S1. Gate B cannot observe the objects it is the exit criterion for.**
`npm run verify:schema` contains **zero** references to `payment_orders`, `subscriptions`, or `record_payment_settlement` — grep returns nothing. Yet "gate B green on prod" is the named exit criterion for the money tables in Deployment Sequencing (plan Task 5.8), and it is what the Phase 2/3/4 "no production deploy" checkboxes are blocked on. For the subscription block the only thing gate B can observe is the whole-file fingerprint — and the work plan itself already records at `:320` that a matching fingerprint says nothing about content (Engine 1's P-1).

Add a subscription probe group to `SOURCE/supabase/verify-schema.ts` mirroring its own items 4–5: with the already-signed-in anon-key session, attempt one insert on `payment_orders`, one on `subscriptions`, and one `rpc("record_payment_settlement")`, asserting **42501** on each. Reuse `test-rls.ts:1985`'s `isAuthorizationDenial` discipline so a `23502`/`23503`/`23505`/`22P02` **cannot** pass as a denial.

**This does not change what a prod run would do to production auth** — the probe user is created by the existing `signInProbeUser()` either way. That remains the engineer's call and is out of scope here.

**S2. `scripts/check-ai-key-bundle.mjs`'s `SECRETS` array has no test.**
Nothing imports it, so deleting `"record_payment_settlement"`, `"api-merchant.payos.vn"`, or a whole entry reddens nothing. In CI this array is the **entire** net: the value branch fires **0 of 7 times** and cannot be made to fire usefully under any configuration of this workflow, because the values it would scan for are the placeholder strings the build itself baked in.

Add one unit test importing `SECRETS` and asserting the label set **and each label's marker array by literal equality** — the exact shape `lib/supabase/__tests__/publicPaths.test.ts:43-51` already uses for `PUBLIC_PATHS`. This requires exporting `SECRETS`; export it without changing the script's behaviour.

**Correct the record while you are here:** an earlier note in this session claimed CI prints 5 warnings instead of 7 because placeholders suppress them. That is **wrong** — the placeholders are scoped to the Build step's `env:` block, the Check-bundle step has no `env:`, and `.env.local` is absent from CI, so CI prints **all 7**. Do not repeat the wrong version anywhere.

**S3. Two client-side payment-path catches log the raw rejection.**
`PurchaseCta.tsx:95` — `console.error("[PurchaseCta] createOrder threw", err)` — and `RecheckOrderControl.tsx:176` — `console.error("[RecheckOrderControl] recheckOrder threw", { orderCode, err })`. The comment at `PurchaseCta.tsx:94` reads *"Chỉ kiểu lỗi, không bao giờ log nội dung đơn"* ("only the error type, never order content"), which is a **false description** of `console.error(msg, err)`.

The frontend DD states the property absolutely: *"Any client-side `console.error` follows `useTutorAction.ts:49`'s shape — identifiers and closed error codes only, never an amount, an account number, a memo or a payload."* Nothing makes that true by construction; the existing tests assert a **call count**, not a shape. The same feature already ships the correct pattern twice — `(billing)/me/orders/error.tsx` and `(billing)/pricing/checkout/error.tsx` both log `{ digest }` only.

Log `{ digest: (err as { digest?: string }).digest }` in both catches, matching those two files. Fix or delete the false comment. Then extend **both** tests from a call-count assertion to an argument-shape assertion against the webhook test's `FORBIDDEN_IN_LOGS` list (`app/api/payments/payos/webhook/__tests__/route.test.ts:95-168`) — note that test deliberately avoids `JSON.stringify` so a payload hidden in a non-enumerable `Error#message` is still caught. **Reuse its approach; do not invent a weaker one.**

### Part 2 — two authoritative-document contract defects

**F-D002. C-15's frozen props line is unimplementable as written.**
Both `docs/design/subscription-frontend-design.md:827` and `docs/ui-spec/subscription-ui-spec.md:1071` freeze `PaymentConfirm` at `{ orderCode: number; legalContentReady: boolean }`. The shipped signature is `{ orderCode, status, legalContentReady }` with `status: string` **mandatory**, forwarded to C-10 at `PaymentConfirm.tsx:66` and supplied from `order.status` at `checkout/page.tsx:173`. It cannot be dropped: C-10's props were amended at UI Spec v1.7 to require `status`, and `PaymentConfirm.tsx:54-56` states it "has no way to invent that value".

**This is the exact defect UI Spec v1.7 closed for C-10, recurring one component down.** Resolve it the same way v1.7 did — by the **behaviour** vector, since the props line is an implementation detail of the component while the State × Display matrix describes what the user experiences. Add `status: string` to C-15's props in **both** documents, typed `string` and **not** a four-literal union, for the same reason recorded for C-10: one CHECK widening must not be able to reach a user as a wrong render.

**F-D003. Both documents describe error routing that is impossible.**
`subscription-frontend-design.md:878` and `subscription-ui-spec.md:906` say a thrown exception from `recheckOrder()` is left to the route's `error.tsx`. It is not and **cannot be**: `RecheckOrderControl.tsx:174-177` catches it, sets `phase = { kind: "threw" }`, and renders `billing.orders.loadError` in the `role="alert"` node at `:210-211`. The file's own header at `:63-69` states why the docs are wrong — **a rejected promise does not cross an Error Boundary**.

The code is correct. Correct **both documents** to describe the caught-exception branch and its copy. Do not change the code.

### Part 3 — stale state claims that actively mislead

Each of these is a **current-tense assertion that is false**, not a moved line number.

**P3a. The `(exams)` provider exists.** `subscription-frontend-design.md` asserts in **eight** places that `app/(exams)/layout.tsx` mounts no `EntitlementProvider`, making the UI-D17 `TutorQuotaNote` mount a permanent no-op and AC-042 unrenderable — at `:158` (A10), `:1129` (R-12), `:999` (FE-I8), `:290`, `:310`, `:350` (code:01), `:1028`, `:953`. It **does** mount, at `(exams)/layout.tsx:41`, alongside `(billing):33` and `(authoring):35`. **A10 is still marked `Confirmed: No` and R-12 is still rated High.** Only the v1.8 close-out bullet at `:191` acknowledges reality, so the document contradicts itself. Correct all of it: discharge A10, re-rate R-12, and fix the eight assertions.

**P3b. `TutorQuotaNote` is rendered.** `subscription-backend-design.md:323`, `:932`, `:1102` say a repo-wide grep returns only its own definition. It is imported at `result/detail/page.tsx:18` and rendered at `:180` and `:234`. The doc's own AC-042 close-out row at `:256` already says it renders.

**P3c. S-05/S-06 ship and `createOrder()` has callers.** `subscription-backend-design.md:1142`, `:839`, `:1127`, `:1444` say the consumer surfaces are designed but not built and the action has no shipped caller. `PurchaseCta.tsx:87` calls `createOrder()`; `RecheckOrderControl.tsx:169` calls `recheckOrder()`; both `me/orders/page.tsx` and `pricing/checkout/page.tsx` exist.

**P3d. `readEntitlement()` has five production call sites, not three.** `subscription-backend-design.md:939` states "exactly one `readEntitlement()` call happens per request" and `:943` that no page or component below the layouts may call it. There are five: the three layouts **plus** `tutorActions.ts:215` and `actions.ts:301`. Those two are **sanctioned** — they are the Server Action gates, and the ADR-0013 guard was deliberately amended this session to admit them (a Server Action has no React context for `useEntitlement()` to read). Integration Points I2/I3 list `Entitlement` as an input with **no producer**. State where the gate's `ent` comes from, and restate the invariant as the **render-path** invariant it actually is.

**P3e. Escalation E-02 is resolved.** `subscription-backend-design.md:1349` still records it as open and `:739` still describes the inline camelCase mapping as current. `queries.ts:25` imports `toCheckoutOrder` and `:154` returns it — exactly E-02's own "Proposed resolution". Close it.

**P3f. `consumeQuota` touches Postgres, and no section says so.** `quota.ts:265-266` reads `subscriptions.period_anchor_at` and `user_profiles.created_at` in the period fallback when `ent[kind].state !== "known"`, failing closed to `null`. The doc's signature block (`:960-965`) and Test Boundaries (`:1203` — "consumeQuota | Redis | Fail-closed on unavailability is the claim") describe Redis as the only boundary. Document the data-access boundary on the enforcement path.

**P3g. `quotaTelemetry.ts` is absent from the Change Impact Map.** `subscription-backend-design.md:637` says the OK-04 mapping lives beside the call in `tutorActions.ts`, and the NEW-file list at `:1096-1099` does not name the module. It exists at `lib/billing/quotaTelemetry.ts:30-34` **because** both refusal sites are `"use server"` files and cannot export a shared const — a real constraint the doc does not record.

**P3h. Decision 3 was reversed in code.** `subscription-frontend-design.md:687` states "no helper module, no exported union and no narrowing utility is introduced". `PaymentPanel.tsx:57-59` exports `isPayable(status)`, imported by `checkout/page.tsx:48` and used at `:166`. The reason at `PaymentPanel.tsx:8-12` is sound — two divergent predicates would put a confirm button beside a closed-order panel — but the stated decision was reversed with no amendment. Amend it.

**P3i. An undocumented outcome branch on the settlement path.** `RecheckOutcome = SettleResult | { error: "unauthenticated" | "rate_limited" }` — an **eighth** branch. `unauthenticated` has no row in either document's outcome table and no budgeted i18n key; C-10 maps it to `profile.error.sessionExpired`, borrowed from another namespace (`RecheckOrderControl.tsx:57-62` records that no key was budgeted). Document it and add it to the **OP-7** register — OP-7 covers `createOrder`'s borrowed strings but **not** the re-check path.

### Part 4 — a self-contradiction introduced today

`docs/ui-spec/subscription-ui-spec.md` now has **two revision tables that disagree**: § Revision History (`:12`) tops out at **1.7** while § Update History (`:1364`) tops out at **1.8**. Today's close-out bump wrote only one of them. Reconcile, and if the document genuinely needs two tables, say what distinguishes them.

Also correct `subscription-frontend-design.md:18`, `:20-26` and `:1226`, which still call the UI Spec "v1.7 today". It is v1.8. **The v1.2 pin itself is correct and must not move** — v1.8 is addable to the delta table, so the document's own falsifiability rule keeps the pin. Add the missing v1.3→v1.8 delta row.

### Part 5 — record, do not fix

Add to the work plan's documentation-debt register, each with a named owner:

- **Group B citation drift** (~40 anchors): backend DD `:1394`+`:102`+`:1012-1018`+`:1062`+`:1395-1412` (the `rateLimit.test.ts` cluster, 12+ refs), `:305`+`:976`+`:985`+`:987`+`:1032`+`:1034`+`:1060`+`:1123`+`:1179`+`:1238` (the `actions.ts` cluster), `:309`+`:320`+`:903-909`+`:1055`+`:1006`+`:1144`+`:1397`, `:932`+`:220`+`:937`+`:1366`+`:561`; frontend DD `:265`+`:951`+`:981` (`TutorQuotaNote` props), `:746` (C-09 `className?` — exists in neither code nor UI Spec), `:441-450` (component tree omits the `isPayable` gate and misplaces the `/me/orders` link), `:166`+`:980` (`PurchaseCta` motivation stale; scope wider than stated).
- **`MAX_UPLOADS_PER_DAY` is dead** at `lib/ugc/limits.ts:41` — zero consumers repo-wide. Backend DD `:1339` implies it would not remain.
- **AC-021's gate description is narrower than the shipped test.** Backend DD `:996`, `:1130`, `:1209`, `:1254` say "exactly one module under `SOURCE/`"; the shipped test pins **two** closed lists, the second naming `supabase/tagQuestionSkills.ts` as the sole offline-script exception. The implementation is **stronger** than the doc; the doc's literal wording is false.
- **The specified `queries.test.ts` was never written** (frontend DD `:1075`, `:995`, `:996`). Actual coverage is the **stronger** real-database integration lane — which the DD does not describe.
- **Three test lanes are undocumented** (`test:integration`, `test:localdb`, `test:fixture`). The frontend DD's QA table, Test Boundaries and data-layer strategy list none of them, and `:1082` still claims "a green frontend suite says nothing about schema correctness" while the integration lane asserts INT-2 deep equality against a real database.
- **The webhook's refusal cost is not "one HMAC and nothing else" for CPU.** `parseJsonObject()` runs a full `JSON.parse` of the buffered body **before** `hmacHex` is reached (`signature.ts:119` vs `:127`). The platform request-body cap is the only bound and **nothing in this repo asserts, configures or names it**. Sits inside TD-013, already accepted in ADR-0014.
- **`recheckOrder(orderCode: number)` applies no runtime type or range check** before `.eq("order_code", orderCode)`, while the same value arriving by URL is validated rigorously at `checkout/page.tsx:111-116`. Not exploitable — PostgREST parameterisation plus `orders_select_own` both hold — but the guard becomes load-bearing the moment that read changes.
- **A wrong `PAYOS_CHECKSUM_KEY` is largely self-announcing** (outbound `signRequestFields()` uses the same key, so `createOrder` fails first). The genuinely silent window is narrow. But `checkEnv.ts:182` only fires on an **empty** key, so a wrong non-empty value passes silently — and a payOS payload shape change would refuse 100% of deliveries with no detector at all.
- **`GET /about`** is in the billing route group and `PUBLIC_PATHS` but in neither Design Doc.
- **`security definer`'s absence is unpinned.** The INVOKER property is load-bearing; the *grant* half is pinned by `test-rls.ts` case PS-b, but nothing asserts the function is not `security definer`.

## Target Files
- [x] `SOURCE/supabase/verify-schema.ts` (S1)
- [x] `SOURCE/scripts/check-ai-key-bundle.mjs` (S2 — export `SECRETS`, no behaviour change)
- [x] a new test pinning `SECRETS` (S2)
- [x] `SOURCE/features/billing/components/pricing/PurchaseCta.tsx` + its test (S3)
- [x] `SOURCE/components/billing/RecheckOrderControl.tsx` + its test (S3)
- [x] `docs/design/subscription-frontend-design.md` (F-D002, F-D003, P3a, P3h, P3i, Part 4)
- [x] `docs/design/subscription-backend-design.md` (P3b–P3g)
- [x] `docs/ui-spec/subscription-ui-spec.md` (F-D002, F-D003, Part 4)
- [x] `docs/plans/subscription-work-plan.md` (Part 5 register)

## Version discipline
Every versioned document edited here needs a **version bump and a revision-history entry in its own established style**: backend DD **v1.10 → v1.11**, frontend DD **v1.8 → v1.9**, UI Spec **v1.8 → v1.9**, work plan **v1.4 → v1.5**. Each entry must state what changed **and** what did not.

`SOURCE/lib/billing/types.ts` remains a **frozen contract** — the frontend verifier confirmed it byte-intact with no code drifted from it. Do not touch it.

## Completion Criteria
- [x] All three security fixes land, each with a test that can fail
- [x] C-15's props and the `recheckOrder` error routing are correct in **both** governing documents
- [x] No document asserts the `(exams)` provider is absent, that `TutorQuotaNote` renders nowhere, that `createOrder()` has no caller, or that `readEntitlement()` has three call sites
- [x] The UI Spec's two revision tables agree
- [x] Group B is recorded with owners, not silently dropped
- [ ] Full gates green: `npm test`, `test:integration`, `test:fixture`, `test:localdb`, `tsc`, `lint`, `check:bundle`, `build`
- [ ] Production deploy is permitted only after plan Task 5.8's gate B — **no production deployment of this branch has occurred**

## Investigation Notes — Part 1 execution (S1/S2/S3 only; Parts 2–5 untouched)

Baseline at `b944751`: `npm test` 1481 pass / 10 skip / 119 files; `test:integration` 31;
`test:fixture` 77; `test:localdb` 11; tsc 0; lint clean; `check:bundle` 0; build 24/24;
`verify:schema` green on dev (`hynwleaxtbtjzkvpjsug`) with **22** printed checks.

**S1 — `supabase/verify-schema.ts`.** New section 9 (`Probe quyền ghi khối SUBSCRIPTION`)
placed after section 8, following the file's own chronological numbering (§17 and TD-016
were appended the same way). Three probes, one per DDL object, mirroring the PO-*/SB-*/PS-*
split of `test-rls.ts` Phần 9. Accepted only via a byte-copy of `test-rls.ts`'s
`isAuthorizationDenial` (42501 or a row-level-security message) — copied, not imported,
because `test-rls.ts` is a run-through script exporting nothing. Payloads are complete and
valid on every constraint (`user_id` from `probe.auth.getUser()` is a real FK), and each
insert is post-checked with service_role through a **different predicate** than the one used
to write (`memo` / `period_anchor_at`, not `order_code` / `user_id`). The RPC probe uses a
non-existent order code, so the function's `if not found then return null` branch runs and it
is a no-op even if EXECUTE were open. `PGRST202` is reported as its own drift message rather
than counted as a denial (same treatment the file already gives `record_exam_result`).
Header list and the "chỉ đọc" paragraph corrected — item 5 already inserted a fixture, so the
old absolute claim was false before this change.
Prod auth is untouched: the probe reuses the session `signInProbeUser()` already returns.

**S2 — `scripts/check-ai-key-bundle.mjs`.** `SECRETS` exported; the CLI body moved verbatim
into `main()` behind `import.meta.url === pathToFileURL(process.argv[1]).href` so an import
does not scan or `process.exit`. Behaviour proven unchanged by byte-identical stdout and by
the missing-build branch still exiting 1 from a copy in an empty root.
The CI note recorded on the export is the **correct** version: the four placeholders are
scoped to the Build step's `env:`, the Check-bundle step has no `env:`, `.env.local` is absent
in CI — so CI prints **all 7** warnings and the value branch fires **0 of 7** times.
Test at `lib/security/checkAiKeyBundleSecrets.test.ts` (not beside the script: no vitest lane
globs `scripts/**` — same mechanical reason as `lib/adaptive/__tests__/tagDecision.test.ts`).

**S3 — `PurchaseCta.tsx` + `RecheckOrderControl.tsx`.** Both catches now log
`{ digest: (err as { digest?: string }).digest }`, matching `(billing)/me/orders/error.tsx:39`
and `(billing)/pricing/checkout/error.tsx:43`. The false comment at `PurchaseCta.tsx:94`
("chỉ kiểu lỗi") is replaced by one that describes what the call actually emits. Both tests
moved from a call-count assertion to (a) a `FORBIDDEN_IN_LOGS` scan over **all five** console
methods using the webhook test's `getOwnPropertyNames` + `Error` collector — **no
`JSON.stringify` in the collection path** — and (b) an exact deep-equal on the argument array.
Both fixtures now reject with an error whose message carries order code, amount, account
number, account name and memo; a `new Error("boom")` fixture has nothing to leak and would
have proven zero.

**Mutation evidence** (each anchor matched exactly once; all probes restored by byte copy):

| # | Mutation | Observed |
|---|---|---|
| S1 | first probe aimed at `exam_attempts` with a bad FK (a real **23503** on dev) | `✗ … (mong đợi 42501, nhận: 23503 = ràng buộc dữ liệu, KHÔNG phải quyền …)`, exit 1. Same run printed `vi tu YEU (error !== null) se noi DA CHAN: true \| isAuthorizationDenial() noi: false` |
| S2 | delete marker `"record_payment_settlement"` | RED — `- "record_payment_settlement",` |
| S2 | delete the whole `payOS checksum key` entry | RED ×2 — `- "label": "payOS checksum key (ADR-0014)"` and `expected 6 to be 7` |
| S3 | `PurchaseCta` logs `amountVnd: 39000` beside `digest` | RED — `chuỗi cấm "39000" xuất hiện trong log: "39000"` |
| S3 | `RecheckOrderControl` logs `accountNumber` beside `digest` | RED — `chuỗi cấm "0123456789" xuất hiện trong log: "0123456789"` |
| S3 | `RecheckOrderControl` logs `orderCode` beside `digest` (an allowed identifier, so the scan cannot see it) | RED via the shape assertion — `+ "orderCode": 8123456789012` |

Both S3 tests were RED against the unfixed components before the fix
(`chuỗi cấm "39000" xuất hiện trong log: "insert into \"payment_orders\" failed — …"`).

**Gates after Part 1**: `npm test` 1483 pass / 10 skip / 120 files (+2 tests, +1 file — the two
new S2 cases; the two S3 cases were extended, not added); `test:integration` 31;
`test:fixture` 77; `test:localdb` 11; tsc 0; lint clean; `check:bundle` 0 (output identical to
baseline); build 24/24; `verify:schema` green on dev with **26** printed checks (+4 — the
section-9 group, the only output delta).
`payment_orders` and `subscriptions` on dev are at **0 rows** by a predicate-free
`select("*", { count: "exact" })`. Prod (`pebjdlbgbmizgfpuptjl`) was never contacted; no
production deployment of this branch has occurred.

## Investigation Notes — Parts 2–5 execution (documents only; Part 1 untouched)

**No file under `SOURCE/` was read-modified by this pass.** `git status` before and after shows
the same six modified `SOURCE/` files and the one new test from Part 1, byte-unchanged.
`SOURCE/lib/billing/types.ts` was not opened for writing. **Code gates were therefore not
re-run** — no code changed, so the Part 1 numbers stand as recorded above (`npm test` 1483/10
across 120 files, `test:integration` 31, `test:fixture` 77, `test:localdb` 11, tsc 0, lint
clean, `check:bundle` 0, build 24/24). No production contact, no deploy.

**Every claim was re-verified against the tree before the correction was written**, not taken
from the verifier reports — two of the named files (`PurchaseCta.tsx`, `RecheckOrderControl.tsx`)
had already been modified by Part 1, so all sites were re-located by content.

### Part 2 — the two contract defects

**F-D002.** `PaymentConfirm({ orderCode, status, legalContentReady })` — `status: string`
**mandatory**, forwarded to `RecheckOrderControl` on the `legalContentReady === true` branch,
supplied from `order.status` by `checkout/page.tsx`. The component's own doc comment states it
"has no way to invent that value". Both frozen two-prop lines replaced. Typed **`string`, not a
four-literal union**, matching C-10's recorded reason and `MyOrderRow.status` / C-09: a `CHECK`
widening changes no line of TypeScript, so the unrecognised-status branch must be a runnable
value rather than a compile error that never fires. Resolved **by the behaviour vector**, as
v1.7 did for C-10.

**F-D003.** `RecheckOrderControl` catches the rejection, logs `{ digest }` only, sets
`phase = { kind: "threw" }` and renders `billing.orders.loadError` in the same appearing
`role="alert"` node the outcomes use. The file's own header states the mechanism: a rejected
promise does not cross an Error Boundary, so the route's `error.tsx` can never run for this
call. Both documents corrected; **no code changed**. The same row's shape was also corrected
from `Promise<SettleResult>` to `Promise<RecheckOutcome>`.

### Part 3 — verified before correcting

| | Verified in code | Sites corrected |
|---|---|---|
| **P3a** | `EntitlementProvider` mounted in **all three** layouts — `(billing)`, `(exams)`, `(authoring)` — each fed by its own `await readEntitlement(user?.id ?? null)`; `TutorQuotaNote` renders beside both affordance call sites | **Sixteen**, not the eight named: A1's evidence, A10, the AC-042 paragraph, FE-AC-26, the Design-Summary "What changes" row, the change-map row, two dependency-verification rows, the code-inspection row, fact `code:01`, the Field Propagation Map, the change-impact precondition block, FE-I8, Technical Dependencies 1b, the Test Boundaries note, the verification-strategy row, R-12. **A10 → `Confirmed: Yes`; R-12 → Low.** R-12's *detectability* argument is kept — every automated gate still passes on a null mount — and FE-AC-26 stays open, because the precondition landing is not the observation |
| **P3b** | `TutorQuotaNote` imported and rendered twice on the result-detail page | 3 sites + the D005 consumer table's "today" column header, which stated the pre-D005 answer in the present tense |
| **P3c** | `PurchaseCta` → `createOrder()`; `RecheckOrderControl` → `recheckOrder()`; both routes ship | 4 sites |
| **P3d** | **Five** production call sites: three layouts + `tutorActions.ts` + `actions.ts`. The two Server Actions call `readEntitlement()` directly and get their `Entitlement` that way | Invariant **restated as the render-path invariant**, not deleted; the "no page or component below" discipline scoped the same way; **I2/I3 now name the `Entitlement` producer**. The sanctioning guard is a shipped **test** — `app/(exams)/__tests__/layout.test.tsx`, two closed lists (`RENDER_PATH_ALLOWED`, `SERVER_ACTION_ALLOWED`), admission gated on a real `"use server"` prologue — so the ADR-0013 citation is to what the guard encodes: ADR-0013 forbids two *implementations*, not two *call sites* |
| **P3e** | `queries.ts` imports `toCheckoutOrder`; `getMyOrder()` returns it | **E-02 closed** (row struck, original statement preserved); the § S-06 read-path paragraph corrected |
| **P3f** | `quota.ts` reads `subscriptions.period_anchor_at` + `user_profiles.created_at` via the request-scoped client on the fallback, and `consumeQuota()` maps a `null` period start to `{ ok: false, reason: "unavailable" }` — verified, not assumed | A two-branch boundary table added to the signature block; the Test Boundaries row corrected to **Redis *and* Postgres**, with the consequence stated: a Redis-only mock leaves the fallback unexercised |
| **P3g** | `lib/billing/quotaTelemetry.ts` exists; both importers are `"use server"` files | Added to the Change Impact Map NEW-file list; the "mapping lives beside the call" claim corrected, with the constraint recorded — a `"use server"` file may export only async functions, so neither refusal site can hold a shared const, and the directive restricts **exports, not imports** |
| **P3h** | `PaymentPanel.tsx` exports `isPayable(status)`; `checkout/page.tsx` imports and uses it | Decision 3 **amended, not dropped**: the "no exported union / no narrowing utility" half stands; the "no helper module" half gives way, on the decision's own reasoning — two hand-written copies agree on the three known closed statuses and diverge on the **unrecognised** one, the very case the decision protects |
| **P3i** | `RecheckOutcome = SettleResult \| { error: "unauthenticated" \| "rate_limited" }`; `ERROR_KEY` maps `unauthenticated` → `profile.error.sessionExpired` | Eighth row added to Decision 1 with the borrowing stated; the `SettleResult` contract row corrected to eight branches / eight sentences; "seven" reconciled as the name of the settlement map. **OP-7 lives in `subscription-IMPL-HANDOFF.md`, outside Target Files** — extending it is registered with an owner instead |

### Part 4 — the two revision tables

They are **duplicates, not complements**: same events, different column order, independently
worded. § Revision History (`:12`) is **complete** — a row for every version from 1.0 — while
§ Update History has never had rows for **v1.1, v1.4 or v1.7**; the close-out bumped only the
latter, so the document reported 1.7 or 1.8 depending on which end a reader opened.

**§ Revision History is made authoritative**, because it is the complete one and it sits beside
the `**Version**` header cell where currency is checked. It receives the **v1.8** row the
close-out never wrote it, both tables receive **v1.9**, and both carry a note stating the
relationship and the rule that every future bump writes both. **The three absent rows stay
absent** — v1.8 assigned that judgement to the engineer and this pass does not reverse it;
consolidating the two tables is registered as debt.

Frontend DD currency pointers moved **v1.7 → v1.9** (§ Referenced UI Spec, § References), with
**v1.8 and v1.9 delta rows added**. **The v1.2 pin did not move**: both versions are addable to
the table, and the document's own falsifiability rule moves the pin only for a version that
*cannot* be added.

### Deliberate non-expansions, each registered rather than dropped

- **UI Spec C-10's outcome table still has seven rows** — P3i was scoped to the frontend DD.
  Registered as item 13; it is an amendment to the authoritative spec and deserves its own pass.
- **UI Spec's backend-DD header pointer still reads v1.6** (actual: v1.11). Same class as the
  pointers Part 4 did fix, but outside the UI Spec's assigned scope here. Registered as item 14.
- **Group B's ~40 anchors** — deferred by design, registered as item 1 with the reason.
- **`OP-7`, `test-rls.ts`, `limits.ts`, `signature.ts`, `orderActions.ts`, `checkEnv.ts`,
  `schema.sql`** — all outside Target Files; registered as items 2, 6, 7, 8, 10, 12.
