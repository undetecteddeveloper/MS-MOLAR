# ADR-0018 Asynchronous Essay Grade Write Against the Append-Only Boundary (and the Groq Emission Point)

## Status

**Accepted — 2026-08-29.** Both escalations resolved by the engineer on 2026-08-28 (Escalation 1 → `TD-029`; Escalation 2 → degraded resolution accepted). Bearing document for `docs/prd/essay-auto-scoring-prd.md` v1.2 (constraints C1/C2, contract W1–W8, requirements R1/R2/R6/R7).

- Parent: **ADR-0010** (score write trust boundary) — this ADR exercises the escape hatch ADR-0010 named in its own Consequences: *"Any future retake / rescore feature must go through the same privileged path rather than an `UPDATE` policy."* It does not overturn ADR-0010; it is the first caller of that clause, and it amends one of its properties (see *Amendment to ADR-0010* below).
- Sibling: **ADR-0011** (mastery write trust boundary) — supplies the "a second privileged operation is a separate function, not a parameter of the first" precedent this ADR reuses twice.
- Sibling: **ADR-0004 addendum / ADR-0007** — the Gemini provider posture this ADR deliberately does *not* extend to a second provider.
- Schema: `SOURCE/supabase/schema.sql` §11 (the boundary being amended). Gates: `SOURCE/supabase/verify-schema.ts`, `SOURCE/supabase/test-rls.ts`.

## Context

### What this ADR has to decide, and why it cannot be deferred to the Design Doc

The PRD locks *what* a graded essay looks like (W1–W8) and *when* grading runs (D4: `after()`, submit returns immediately). It deliberately does not decide *how the grade gets into the database*, because that question lands squarely on a trust boundary another ADR owns. Three things are blocked behind this one:

1. **There is no write path.** `exam_results` is `unique (attempt_id)`; the only writer is `record_exam_result()`, which is `INSERT`-only; and `revoke insert, update, delete … from anon, authenticated` (§11a) removed the client's write access entirely. A band that arrives *after* the row exists has nowhere to go.
2. **Whether a new provider gets an SDK.** The repo has exactly one AI emission point (`SOURCE/lib/ugc/gemini.ts`), guarded by an exhaustive source scan. AC-033/AC-034 require an equivalent guard for Groq and explicitly make the guard's *shape* depend on this choice.
3. **Whether "first-write-wins" is a property or a hope.** W4 and AC-062/AC-063 promise immutability and a defined race resolution. Whether that is enforced in SQL or in TypeScript is an architecture decision with a different failure mode in each case.

### The three verified facts every option here must survive

Established in the PRD and re-verified in the tree while writing this ADR. None is re-litigated below; they are the boundary conditions.

- **F1 — A graded essay still persists `scored:false` and `isCorrect:false`.** `record_skill_mastery()` excludes a per-question row only on `coalesce((pq->>'scored')::boolean, true)` (`schema.sql:1354`), and `computeWrongTwiceQuestionIds()` only on `row.scored === false` (`lib/scoring/wrongTwice.ts:45`). W1 is therefore the only persisted shape in which D7 holds without editing either. The band lives in new keys; readers branch on a **new lifecycle field**, never on `scored` or `isCorrect`.
- **F2 — A 429 is the most likely free-tier failure, and is not terminal.** AC-065 requires in-pass retry with backoff before a question may become `failed`. Only a non-429 error or exhaustion of those retries is terminal.
- **F3 — Stored `pending` can never be written to `failed` by anything in this release.** `after()` shares the invocation and dies with it; `vercel.json` has no cron; there is no queue. W6 forbids adding a background writer. The deadline is applied at **read** time by a pure derivation function.

F3 has a consequence for *this* ADR that is easy to miss: **an abandoned pass performs zero writes.** Any mechanism that counts attempts by counting writes therefore cannot count an abandoned attempt, and AC-064's server-side cap of 3 becomes unenforceable exactly in the case where a systematically-failing grade invites repeated clicking. This is what forces Decision 4.

### The write path as it stands today, drawn

```
submitExam()  ──(student JWT, RLS)──▶ attempt_answers    upsert
              ──computeScore()─────▶ ScoreResult { perQuestion[], … }
              ──service_role───────▶ record_exam_result()    INSERT only, unique(attempt_id)
              ──service_role───────▶ record_skill_mastery()  separate fn, allowed to fail
              └─ redirect() ───────▶ result page
                                          ▲
   after()  ── grading pass ── band ──────┘   ← no write path exists for this arrow
```

### Grounding facts (verified against the files)

| Fact | Where |
|---|---|
| `service_role` retains full table grants on `exam_results`; §11a revoked from `anon`/`authenticated` only. An `INVOKER` function called as `service_role` can therefore `UPDATE`. | `schema.sql:849` |
| `record_exam_result()` is deliberately **not** `SECURITY DEFINER`, so two independent mistakes are needed before a student can write. | `schema.sql:897–945`, ADR-0010 |
| Privileged operations are exposed as *named operations*, never as a client; `serviceRoleClient()` is private. | `lib/supabase/service-role.ts` |
| `claim_attempt_answer_key()` already establishes the **claim-before-you-act** shape: it closes the attempt *first*, then returns the answer key, so "got the key" and "can still answer" are mutually exclusive at the DB level. | `schema.sql` §10b; `app/(layer2)/actions.ts` step 3 |
| The single Gemini emission point **does not retry** — retry is delegated to the SDK — because a retry layer above a reservation-based budget counter multiplies real spend the counter cannot see. | `lib/ugc/gemini.ts`, `generateContent()` header |
| `consumeQuota()` reserves the **worst case** before a burst (`uploadAutomatic: 3`) and accepts over-counting as the safe direction. Redis unreachable ⇒ refuse. | `lib/billing/quota.ts:290–384` |
| The bundle guard's strongest markers are **host strings** (`generativelanguage.googleapis.com`, `api-merchant.payos.vn`) — they catch a whole module pulled client-side, not merely an env-var name. | `scripts/check-ai-key-bundle.mjs` |
| The schema fingerprint is the last statement in `schema.sql`, and any new SQL moves it (**`29931beeb950`** today, matching prod — see the 2026-08-28 correction below; `021dd1387945` was the value when this ADR was drafted). | `schema.sql` tail |

---

## Decision

**The band is written in place, into `exam_results.per_question`, by a second privileged identity path that mirrors `record_exam_result()` in every containment property — and grading is claimed before it is attempted, so an attempt that dies still counts. Groq is reached with plain `fetch` against one endpoint constant, with our own explicit retry loop; no SDK is added.**

### Decision 1 — Two privileged SQL functions, claim-then-settle, both `service_role`-only, both `INVOKER`

| Function | Responsibility |
|---|---|
| `claim_essay_grading_attempt(p_attempt_id, p_question_id)` | Authorizes and **reserves one of the three attempts** (AC-064). Derives ownership from the attempt, requires `status = 'submitted'`, requires the target element to exist and to be in a state a pass is permitted from, increments that element's attempt counter, and returns the new count — or refuses. Runs **before** any budget call and before any provider call (AC-072). |
| `record_essay_grade(p_attempt_id, p_question_id, p_state, p_earned, p_max, p_low_confidence)` | **Settles** the claimed attempt: writes the lifecycle field, the earned/max keys and the low-confidence flag onto the one matching element of `per_question`. Refuses to overwrite a band that already exists (Decision 3). |

Both follow ADR-0010's containment list without exception: `EXECUTE` revoked from `public, anon, authenticated` and granted to `service_role` only; **not** `SECURITY DEFINER`, so a careless `grant execute … to authenticated` still fails on the missing table privilege; and **no `user_id` parameter** — ownership is derived from the attempt inside SQL, so a wrong call site still cannot move another student's grade. They are exposed from `lib/supabase/service-role.ts` as two named operations and — following ADR-0011's rule — as **two functions rather than one function with a mode flag**, because the claim must survive independently of whether the settle ever happens.

**The `UPDATE` is column-scoped to `per_question`, and within it to one element.** `total_score`, `correct`, `total`, `topic_breakdown` and `overtime_seconds` are never named in either function body. This is what keeps AC-009 (`exam_results.correct` never moves because of an essay) and W8 (the result page *combines* the legacy triple with the essay keys **on read**) true by construction rather than by discipline: no statement in the repo can move the legacy triple after insert.

### Decision 1b — The element rewrite preserves array order explicitly

`per_question` is a jsonb **array** whose order is the exam's question order, and that order is what every result surface renders. The update rebuilds the array with `jsonb_agg(… order by ord)` over `jsonb_array_elements(…) with ordinality`. The `order by` is load-bearing, not decorative: without it Postgres is free to return a differently-ordered array, and every question on the result page silently shuffles the first time an essay is graded — a defect invisible to any test that checks only *that the band landed*.

### Decision 2 — The closed band set `{0, 0.25, 0.5, 0.75, 1}` is declared **once, in TypeScript**; the SQL does not re-declare it

W3 already states the closed set is enforced by a code path rather than a database CHECK. This ADR pins the stronger form: the SQL functions **do not validate the band value at all**, and that omission is deliberate. A `p_earned in (0, 0.25, 0.5, 0.75, 1)` assertion inside the function would be a second declaration of a product rule whose first declaration is the validator in the grading module — the same two-clocks failure ADR-0010 refused when it declined to re-implement `computeScore` in SQL, and the one `lib/ai/models.ts` exists to prevent for model names.

What the SQL *does* enforce is only what has no TypeScript twin: ownership, `submitted`, element existence, legal lifecycle transition, the attempt ceiling, and array order. Each of those is a fact about the **row**, not about the **grade**.

### Decision 3 — First-write-wins is a `WHERE` predicate inside the settle statement, not a read-then-write in TypeScript

`record_essay_grade()` carries a `… and <element>.<lifecycle> <> 'graded'` predicate in the same statement that performs the update. A second band for a `(attempt_id, question_id)` already `graded` matches zero rows and writes nothing.

- The rejection reaches the caller as **zero rows affected — a distinct return value, not an exception** — because a refused duplicate is a normal outcome of the race AC-063 describes, not an error.
- Per AC-062 it is **never surfaced to the student**: it goes to telemetry (R13), and the student keeps seeing the band that was written first.
- A read-then-write in TypeScript ("read the element, check it isn't graded, write") would open exactly the window this design exists to close — a retry racing an in-flight original pass, the concrete scenario AC-063 names. `change_support_ticket_status()` set this precedent in this repo for the same reason, and its comment says so.

`failed` is **not** protected by that predicate: a `failed` element must be able to become `graded` on retry. Legal transitions are `pending → graded | failed` and `failed → graded | failed`. `graded` is absorbing.

### Decision 4 — The retry cap is consumed at **claim** time, not at write time

By F3, a pass whose invocation is cut off writes nothing. If the attempt counter incremented on the settle write, an abandoned pass would cost nothing, the stored count would stay below three, and AC-064's *"a fourth grading pass receives a refusal with zero provider calls"* would be false precisely in the failure mode AC-026 exists to handle — a student watching a stuck "đang chấm", clicking retry.

So the counter is incremented by `claim_essay_grading_attempt()` **before** the provider is contacted, and is never decremented. Its initial value is emitted by `computeScore()` as a key on the essay element at insert time (zero attempts), which requires **no change to `record_exam_result()`'s signature** and no DDL — W2 holds. The claim consumes attempt *n*; if the pass then dies, attempt *n* is spent.

This is the same directional bias `consumeQuota()` already chose: over-counting is the safe direction, under-counting is the incident. The cost, recorded rather than mitigated: a student can lose one of three attempts to a platform cut-off that was not their fault. That is preferred over an unbounded retry button on a systematically-failing grade (PRD R-j), and the copy AC-064 already requires tells the student the question will not be graded automatically.

### Decision 5 — Groq is called with plain `fetch` against one endpoint constant. No SDK is added.

One module under `SOURCE/lib/` holds one `POST` to a single exported endpoint constant, with `GROQ_API_KEY` read from server env, `import "server-only"` at the top, and our own retry loop.

Four reasons, in the order they bite:

1. **AC-065 requires the retry policy to be ours.** The lifecycle decision depends on *why* a call failed: 429-exhaustion and a non-429 error are different terminal causes (AC-024), and a 429 with retries left is not terminal at all. An SDK that retries transparently and then throws makes that distinction something we reverse-engineer from an error shape; owning the loop makes it a branch we write. Any SDK adopted here would have to be configured `maxRetries: 0` anyway — at which point its retry feature, the main thing we would adopt it *for*, is switched off.
2. **A hidden second retry layer would break the budget counter the way it was broken once before.** `generateContent()`'s header records the rule: retrying *above* a reservation-based counter multiplies real spend invisibly. An SDK default (Groq's is 2) sitting underneath our own loop multiplies the worst case from *1 + r* to *(1 + r) × 3*, with the counter seeing none of it.
3. **AC-034's corollary already anticipates this branch and pre-solves the guard.** With `fetch`, AC-033's exhaustive scan keys on the endpoint constant or the module import, and AC-029's bundle marker becomes the host string `api.groq.com` — the strongest marker shape in `check-ai-key-bundle.mjs`, because a host string catches an entire module pulled client-side rather than an env-var name a bundler might tree-shake.
4. **The differentiating surface is unused.** One JSON `POST`, one JSON response; no streaming, no tool calls, no multimodal upload. The SDK's value here is types we would replace with a validator we are required to write anyway.

**The cost, stated plainly:** we hand-declare the response shape, so a provider-side API change is ours to notice. It is bounded by AC-006/AC-041, which already require the model output to be strictly validated before it can move a grade — an unrecognised response is rejected by design rather than persisted. **Kill criteria:** if grading comes to need streaming, tool calling, or vendor JSON-schema/structured-output mode, revisit toward `groq-sdk` configured `maxRetries: 0`, leaving Decisions 1–4 unchanged.

### Decision 6 — The Groq budget reserves the **worst case** of a pass, once, before the pass starts

A grading pass may emit up to `1 + MAX_IN_PASS_RETRIES` provider requests (F2). The budget counter — a Groq-only daily key, never the Gemini `ai:budget:{Pacific day}` key (AC-030) — is incremented by that worst case in a single `INCRBY` **before the first request**, and is not refunded when the pass succeeds on the first try.

This is `consumeQuota()`'s existing shape and its existing accepted trade-off, and it is the only shape under which the counter bounds real spend: incrementing per retry would let a pass that is *already over budget* keep emitting until its next check. Fail-closed when the counter store is unreachable (AC-031). Per AC-066 this counter is the **only** gate — `QuotaKind` stays `"tutor" | "upload"`, `PLAN_LIMITS` is untouched, and no `consumeQuota()` call site changes.

Ordering is fixed by AC-072 and is a requirement, not an implementation detail: **claim (authorize) → reserve budget → call provider → settle.** Metering before authorizing would let an unauthorized caller drain the single unmetered project budget for every student.

### Decision Details

| Item | Content |
|------|---------|
| **Decision** | An in-place, column-scoped, element-scoped `UPDATE` of `exam_results.per_question` through two `service_role`-only `INVOKER` functions (`claim_essay_grading_attempt`, `record_essay_grade`), with first-write-wins expressed as a `WHERE` predicate and the retry cap consumed at claim time. Groq is reached by `fetch` through one guarded emission module with an owned retry loop. |
| **Why now** | The backend Design Doc cannot specify the grading pass without a recorded position on what may write to `exam_results` after insert, and the UI Spec cannot describe the retry control without knowing where the cap is enforced. |
| **Why this** | It keeps every property ADR-0010 bought — one scoring implementation, ownership derived in SQL, no client write access, two independent mistakes required — while adding the one capability the append-only design lacks, at the narrowest scope available: one column, one array element, one legal transition. |
| **Why not a separate `essay_grades` table** | Contradicts W2 (the band lives in `per_question`), adds DDL plus a new RLS surface, and creates a second source of truth for one array every result surface already reads — the shape most likely to render a band the score does not include. |
| **Why not delay the `exam_results` insert until grading finishes** | Breaks D4 and AC-003: a submitted attempt would have no result row at all, so the result page would have nothing to render and `record_skill_mastery()` would sit behind a provider. |
| **Why not `.from("exam_results").update()` from TypeScript** | Moves ownership, transition legality and race resolution to a call site, where each is a convention rather than a rule. ADR-0010 rejected exactly this reasoning for the insert. |
| **Cost accepted** | `exam_results` rows are no longer immutable after insert (see Amendment). Budget is over-reserved on first-try successes. One attempt can be lost to a platform cut-off. A hand-declared provider response shape. |
| **Known unknowns** | Groq free-tier 429 frequency at real volume is unmeasured, because zero essay answers exist in production — this is now the **only** one. The duplicate-write attribution question that stood here is closed; see *Escalation 2*. |
| **Kill criteria** | If a *third* in-place mutation of `exam_results` is proposed, stop treating each as an exception and revisit the table's shape. **ADR-0010's own kill criterion is not a future risk here — it has already fired, and is now tracked as `TD-029`; see *Escalation 1*.** |
| **Not decided here** | The lifecycle field's identifier, the earned/max key names, the attempt-counter key name, the pending deadline, `MAX_IN_PASS_RETRIES`, backoff shape, the concurrency cap, the Groq model constant's value, the raised character ceiling, prompt and rubric text, telemetry codes — all Design Doc. Also Design Doc: whether the Groq daily counter **duplicates** `quota.ts`'s Pacific-day/TTL/fail-closed ladder or **exports** it (see *Forced choice: the Groq counter* below), and the name of its daily-limit env var, which `checkEnv.ts` must gate at startup. |

### Escalation 1 — ADR-0010's kill criterion has already fired, on both limbs

This ADR's first draft asserted that `lib/supabase/service-role.ts` held five operations and that this feature would add "the sixth and seventh". **That count was wrong and is corrected here.** The module exports **eleven** operations today (`recordExamResult` :61, `recordSkillMastery` :95, `listReportedExams` :131, `moderateExam` :181, `flagSupportTicketNotifyFailed` :219, `listSupportTickets` :263, `changeSupportTicketStatus` :337, `addSupportTicketNote` :365, `readPaymentOrderForSettlement` :410, `recordPaymentSettlement` :451, `recordPaymentOrder` :512). This feature would make it **thirteen**.

ADR-0010's kill criterion reads in full: *"If `service-role.ts` grows beyond a handful of tightly-scoped operations, **or if a second caller needs privileged writes**, revisit: either a dedicated least-privilege Postgres role (INSERT on `exam_results` only, via direct connection) or moving scoring server-side behind a real backend identity."*

Both limbs are already satisfied, independently of this feature:

- Eleven operations is past "a handful" — the payment and support systems crossed it before essay grading was proposed.
- The retry Server Action (AC-072) is a second caller needing a privileged write into the same table, which is the second limb stated almost verbatim.

**RESOLVED 2026-08-28 (engineer): proceed, and open a tracked TECH-DEBT row — `TD-029`.**

The design in Decisions 1–4 is correct *within* the existing privileged-identity pattern; it is silent on whether that pattern should still be the pattern, and that second question is now `TD-029`'s, not this ADR's.

Reasoning recorded with the decision: what tripped the threshold is payments and support, so blocking essay grading does not fix the thing that fired. Revisiting now would mean a cross-cutting migration through scoring, mastery, payments and support — its own ADR and work plan — with this feature parked behind it. What the decision buys instead is that the fired criterion is written somewhere a future session actually reads.

Deferring *silently* was the one option ruled out, because a criterion that fires and is never read is the same as not having written one. `TD-029` is what makes it read: it names the two conditions that force the revisit rather than leaving it to judgement —

1. a **fourteenth** operation added to `lib/supabase/service-role.ts`; or
2. a **third** proposed in-place mutation of `exam_results` (this ADR is already the first and second — claim and settle).

A dated note inside a Proposed ADR was rejected as the mechanism: it is only found by someone already reading this file, which is precisely not the person about to add operation fourteen.

### Escalation 2 — `telemetry_log` cannot attribute a grading attempt

Decision 3 says a refused duplicate write "goes to telemetry (R13)". Verified against `schema.sql:1378–1401`, `telemetry_log`'s columns are `id, user_id, event_type, question_id, skill_node_id, success, error_code, created_at` — there is **no `attempt_id`**, and the payload type `TelemetryLogInsert` (`lib/tutor/telemetry.ts:66–73`; the builder itself is `buildTelemetryPayload()` at `:92–101`) is pinned to exactly six app-filled columns by an exhaustive test.

Grading attempts are keyed `(attempt_id, question_id)` (AC-064). `question_id` alone cannot separate two attempts on the same question by the same student, so as things stand a duplicate-write rejection is recordable only at `(user, question, day)` resolution.

**RESOLVED 2026-08-28 (engineer): accept the degraded resolution, and state the limit explicitly.** `telemetry_log` gains no column, the PRD's two-change budget holds, and the payload type `TelemetryLogInsert` (`lib/tutor/telemetry.ts:66–73`; the builder itself is `buildTelemetryPayload()` at `:92–101`) with its exhaustive six-column test stays untouched.

The Design Doc's telemetry section **must say this in the document, not only in code**: a duplicate-write rejection is attributable to `(user, question, day)` and **not** to a specific attempt, so two rejections on the same question by the same student on the same day are indistinguishable in telemetry. Recorded rather than hidden, because the failure mode is a future session reading a rejection count and inferring a per-attempt rate from it.

Why this is affordable: a refused duplicate is a **rare diagnostic signal, not a metric anyone counts** — it fires only in the AC-063 race. Weighed against it, TD-005 has fired four times, so every hand-applied schema change avoided is risk genuinely removed rather than deferred. Routing the event to server logs instead was considered and rejected: it would put this one signal outside the telemetry surface every other event uses, and out of reach of SQL.

### Forced choice: the Groq counter

Decision 6 says the Groq counter takes "`consumeQuota()`'s existing shape". That phrase does not settle whether it reuses `consumeQuota()`'s *code*, and it cannot be resolved by preference alone: every helper the Groq counter needs is module-private in `lib/billing/quota.ts` — `BUDGET_TTL_SECONDS` :132, `BUDGET_TIME_ZONE` :141, `PACIFIC_DAY` :179, `budgetKey()` :186, `dailyBudgetLimit()` :202. So the Design Doc must either duplicate the Pacific-day derivation (a second clock, the exact failure `quota.ts:9–18` exists to warn about) or export those helpers (an edit to a file the PRD calls untouched — though the sentence's real scope is `QuotaKind`, `PLAN_LIMITS` and the call sites, all of which can genuinely stay untouched). Note the Groq counter needs **no** `Entitlement` and no plan split (AC-066), so `budgetCeiling()` and `freeShare()` are not among the helpers in question.

### Amendment to ADR-0010

ADR-0010's Consequences state: *"`exam_results` is now append-only from every client's perspective."* That sentence stays true — no client gains anything here. But its stronger informal reading, *rows never change after insert*, stops being true the day this ships, and anything that quietly relied on it must be named rather than discovered:

- **PDF export** is blocked while any essay in the attempt is unresolved (AC-058/W8) — a permanent artifact whose score changes an hour later is worse than making the student wait.
- **`ScoreCard` and `/history`** show a "đang chấm" marker instead of a number about to change (AC-057/W8). **Restated 2026-08-29 by engineer decision, and deliberately not a drift:** the marker does **not** go inside `ScoreCard`. `ScoreCard` keeps its props and rendering unchanged — a **0-diff zone**, and any diff in that file is a regression — while the essay result and its lifecycle marker render on a separate labelled line directly beneath it (UI Spec UI-D3). Two reasons: folding the essay into the displayed score redefines what `total` means and silently breaks the shipped `wrong = total − correct` derivation in that same component; and a headline number that moves an hour after submission is precisely the instability this Amendment exists to make three surfaces respect. The PRD's AC-011 ("combining") and AC-057 ("`ScoreCard.tsx` … alongside the attempt's number") were left as written by decision — the restatement is recorded here and in the UI Spec and frontend Design Doc rather than by revising a reviewed PRD for wording.
- **Any future caching of a result row** must key on something that moves when a band lands. No such cache exists today; this is a forward constraint, not a fix.

#### Amendment 2026-09-01 — the `ScoreCard` 0-diff zone is lifted (B1/B2/B3 + G1)

The 2026-08-29 restatement above froze `ScoreCard.tsx` for **exactly two reasons**. Both are now answered, so the freeze is lifted by engineer decision. Recording the reasoning here rather than deleting the paragraph above, because the paragraph is still the correct account of why the freeze existed.

1. *"Folding the essay into the displayed score redefines what `total` means and silently breaks the shipped `wrong = total − correct` derivation in that same component."*
   **No longer applies.** `correct` and `total` keep their original meaning — they count **auto-scored questions** and nothing else. The essay reaches the score through a separate channel added by B1/B3, `earnedPoints`/`maxPoints` on each `per_question` element, which the two counters never read. `wrong = result.total - result.correct` in `ScoreCard` is unchanged and still derivable, and `computeScore.test.ts` now pins that a `true_false` scoring 3/4 sub-items earns partial marks while still counting as **one wrong question**.

2. *"A headline number that moves an hour after submission is precisely the instability this Amendment exists to make three surfaces respect."*
   **Still true, and now fixed at the source rather than worked around.** The old remedy froze the number; its cost was that the big number stated something **false** rather than something incomplete — a Literature attempt worth 4.75/10 displayed `10.0/10`, because the two essays were absent from the denominator entirely. G1 removes the instability instead of hiding it: while any essay is unresolved, `ScoreCard` shows "đang chấm…" and **no number at all**, then goes straight to the final score. There is no intermediate value for the student to see move.

Consequences of lifting it:

- `ScoreCard` gains one optional prop, `pending`, defaulting to `false`. **AC-012 is preserved by that default**: a row written before essay grading shipped carries no lifecycle keys, so `unresolvedCount` is 0, so `pending` is `false`, so the component renders byte-for-byte what it rendered before. `getResult.int.test.ts`'s hand-built legacy literal continues to pass unchanged, and `ScoreResult` deliberately did **not** gain `earnedPoints`/`maxPoints` at the attempt level for the same reason — two derived fields there would have made every legacy row read out with two extra keys.
- **AC-059 is restated, not weakened.** It required the essay denominator to say plainly what it counts. Before B1 that denominator was `gradedCount × 1` — correct only while every question was worth the same mark. On a weighted paper it stated something false: a 5-mark NLVH essay banded `0.25` rendered as `0.25 / 1 điểm` on the line directly beneath a big score that had already counted it as **1.25**. `EssaySummary` now sums the same `earnedPoints`/`maxPoints` the score itself is computed from, so the two numbers on the page cannot disagree. A row written before B1 carries no `maxPoints` and falls back to the band scale, so legacy attempts render exactly as before — the same mechanism that preserves AC-012 above.
- **AC-057 is satisfied more directly than before**, not weakened: the marker now sits on the attempt's number, which is what AC-057 asked for in the first place; the separate `EssayScoreLine` remains and keeps showing the band breakdown.
- `record_essay_grade()` now also updates `total_score`. That is the **third** in-place `exam_results` mutation, and it therefore **fires the revisit trigger recorded in `TD-029`** ("a 3rd in-place `exam_results` mutation"). Filed as such rather than absorbed silently. The function does **not** duplicate any scoring rule: every rule stays in TypeScript and is frozen into `earnedPoints`/`maxPoints` per element; the SQL only sums two numeric fields and divides. This is the distinction that keeps ADR-0010's "two clocks" objection from applying.

The append-only property that remains, and that this ADR does not weaken: **no client can write to `exam_results` by any path, and no writer other than `service_role` exists.**

---

## Rationale

### Options considered — the write path

| Option | Verdict |
|---|---|
| **A. Second privileged RPC, in-place jsonb update** *(chosen)* | Narrowest scope satisfying W2 + W4 + AC-062/063/064 together. Reuses an existing, reviewed containment pattern instead of inventing one. |
| **B. Separate `essay_grades` table, merged on read** | Rejected: contradicts W2; two sources of truth for one array; a new RLS surface; a read-time join on every result render for a feature idle on most attempts. |
| **C. Defer the `exam_results` insert until grading completes** | Rejected: breaks D4/AC-003/AC-004. The result row is a precondition of both the result page and the mastery write; putting a provider in front of them inverts the reliability posture ADR-0011 established. |
| **D. Grant the write to a TypeScript call site (`.update()`)** | Rejected: ownership, legality and race resolution become conventions. Identical to the reasoning ADR-0010 used against a policy-only fix. |
| **E. Re-insert a replacement row (delete + insert)** | Rejected on sight: `unique (attempt_id)` makes this a delete of real student data to change one array element, and `record_exam_result()` recomputes `overtime_seconds` from the clock — so a re-insert would silently re-adjudicate whether the student finished on time. |

### Options considered — provider access

| Option | Verdict |
|---|---|
| **Plain `fetch` + one endpoint constant + own retry** *(chosen)* | Retry policy is ours (AC-065); no hidden second retry layer over the reservation; host-string bundle marker; nothing unused adopted. |
| **`groq-sdk`** | Rejected for v1. Its retry layer must be disabled to satisfy AC-065 and Decision 6, which removes most of its value; it adds a dependency whose typed surface we replace with a validator we must write regardless. Named as the kill-criteria destination if streaming or structured output becomes necessary. |
| **OpenAI SDK pointed at Groq's compatible endpoint** | Rejected: same retry objection, plus a client library whose name in a stack trace or a bundle scan misidentifies the provider — actively harmful to AC-033/AC-034, whose whole job is to make "who can emit AI requests" answerable by reading the source. |

### Why this is the same trust boundary as ADR-0010, restated

ADR-0010's structural finding was that `submitExam` authenticates to Postgres **as the student**, so anything the server may write, the student may write. Asynchrony changes none of that: the `after()` callback runs in the same invocation, and were it to use the session client it would carry the same principal. The grade therefore has to travel by a different identity for the same reason the score did — and once it does, enforcement belongs in SQL for the same reason: a rule at the call site survives only as long as the call site does.

The one genuinely new question asynchrony raises is **which write may land second**, and that is what Decision 3 answers.

---

## Consequences

### Positive

- The band has exactly one writer, and that writer cannot name a user, cannot touch a non-`submitted` attempt, cannot move the legacy score triple, and cannot overwrite a band.
- AC-064's cap holds in the failure mode that motivated it, because Decision 4 counts claims rather than writes.
- The Groq path arrives with the bundle marker, the emission-point guard and the negative control (AC-033/AC-034) that the Gemini path only acquired retroactively.
- `computeScore` remains the single scoring implementation; no grading rule enters SQL.

### Negative

- `service-role.ts` grows from eleven operations to thirteen, past a threshold ADR-0010 set and that was already crossed before this feature existed (Escalation 1).
- Two privileged round-trips per graded essay (claim + settle) instead of one.
- Result rows mutate after insert (see Amendment) — a new fact three surfaces must respect and every future reader must be told.
- Budget is over-reserved on first-try successes, putting effective daily throughput below the nominal request ceiling.
- A hand-declared provider response contract.

### Neutral

- Two new SQL functions move the schema fingerprint off **`29931beeb950`** (the current prod value; the draft said `021dd1387945`, which the 1–5 star rating change superseded before this feature reached DDL). Per Phase 3.5 / TD-005 this is a prod-DDL event requiring the engineer's confirmation before it is applied; deploying the code without it produces a green build and a runtime failure on the first essay.

  **Resolved — the fingerprint has moved, and both databases carry it (recorded 2026-08-30, Final §16).** The new value is **`9979c9deea52`**, and it is no longer a prediction: it is pinned at both declaration sites (`SOURCE/supabase/schema.sql:2158` and `SOURCE/lib/schema/schemaFingerprint.ts:41`, moved together in Task H5), and it was **read back by real query** from **both** projects on 2026-08-29 — prod `pebjdlbgbmizgfpuptjl` and dev `hynwleaxtbtjzkvpjsug` (Gate B6), then re-confirmed on prod during Task B3.3. The Phase 3.5 / TD-005 obligation this bullet names was therefore **discharged, in the order it demands**: engineer confirmation first, dev then prod, and verification by querying `pg_proc` / `pg_constraint` directly rather than trusting the apply tool's success message — which mattered, because that tool reported only `DROP FUNCTION` as the command for each multi-statement apply and would have read as *the create never ran*.

  **Three DDL groups, not two.** The count this ADR carries elsewhere ("two hand-applied schema changes") counts the two new functions and the `telemetry_log` CHECK pair; the **character-ceiling change** on `attempt_answers_answer_check` (500 → 4000, R11) is a **third**. All three went to both databases in the same six-statement apply, **fingerprint last** — so a run that dies midway leaves the database honestly declaring the *old* version rather than claiming one it never finished.

  **"Known unknowns" still holds after the first real-provider run.** Task E3 (2026-08-30) graded the committed adversarial set against the real provider — **7/7 EQUAL, 0 RAISED** — and matched **4/4** human-expected bands. Nothing in that run contradicts the cell. What it *adds*, and what this ADR never recorded, is a **per-minute** ceiling: every budget argument here is stated per **day**, but the binding constraint on a burst is **TPM 8 000**, which at the measured 873 tokens/request is **≈ 9.2 requests per minute** (Task E5).
- `record_exam_result()`'s signature, the `exam_results` columns, `PLAN_LIMITS` and `QuotaKind` are all unchanged.

## Architecture Impact

- **New**: one Groq emission module (`server-only`, one endpoint constant, own retry loop); one Groq model constant in `lib/ai/models.ts`; a Groq daily budget counter; two SQL functions in a new `schema.sql` section; two named operations in `lib/supabase/service-role.ts`.
- **Changed**: `computeScore()` emits the lifecycle field, the earned/max keys and a zeroed attempt counter for essay questions; `scripts/check-ai-key-bundle.mjs` gains a `GROQ_API_KEY` entry; `verify-schema.ts` gains grant assertions for both functions.
- **Unchanged, and asserted as unchanged**: `schema.sql:1354` (`record_skill_mastery`), `lib/scoring/wrongTwice.ts`, `record_exam_result()`, the `exam_results` DDL, every `consumeQuota()` call site.

## Implementation Guidance

1. **Put the two functions in one new `schema.sql` section**, placed after §11 and cross-referenced from it, so a reader of the score-write lockdown finds the amendment without searching for it.
2. **Mirror ADR-0010's grant block verbatim** — `revoke all on function … from public, anon, authenticated`, then `grant execute … to service_role`. Revoking only from `public` leaves both functions callable by students; see the §10b note on Supabase default privileges.
3. **Extend `verify-schema.ts`** to assert that `authenticated` cannot execute either function, distinguishing `42501` from an incidental failure — the existing §10/§11 assertions are the template. This gate is also where AC-048's fifth coupled site (the raised character ceiling) lands.
4. **Extend `test-rls.ts`** with cases proving a student JWT can neither call either function nor `UPDATE` `exam_results` directly.
5. **Add `GROQ_API_KEY` to `SECRETS`** with markers `["GROQ_API_KEY", "api.groq.com"]`. Do not use an SDK package name as a marker — there is no SDK (Decision 5). **AC-029 has two coupled sites, not one**: `SECRETS` is exported and pinned verbatim by `lib/security/checkAiKeyBundleSecrets.test.ts` — an exhaustive `toEqual` over label+markers at `:34` and a literal `expect(SECRETS.length).toBe(7)` at `:74`. Both move in the same commit, or CI's "Lint · Types · Tests" job goes red.
5b. **Key the Groq emission scan on the endpoint-constant identifier or the module import — never on the host string.** `api.groq.com` is about to appear in `scripts/check-ai-key-bundle.mjs` (guidance #5), and that file matches the chokepoint scan's `SOURCE_FILE` pattern (which deliberately includes `.mjs`) while not matching `TEST_FILE`. A host-keyed Groq scan would therefore classify the bundle guard itself as an emission site and force it into one of the two exhaustive `toEqual` lists — turning the strongest AI-safety guard in the repo into a list of exceptions. The bundle marker and the scan key must be **different strings by construction**: the guard looks for the host literal, the scan looks for the identifier.
6. **Test array-order preservation directly** (Decision 1b): grade the *second* essay of a three-essay attempt and assert the full `questionId` sequence is unchanged. A test that asserts only that the band landed will pass while the page shuffles.
7. **Test duplicate-write rejection at the SQL boundary**, not only through the TypeScript wrapper: two settles for one pair, asserting the stored band equals the first and the second reports zero rows (AC-062).
8. **Do not add a background writer** for stored `pending` (F3/W6), including "cleanup on next login". If a metric looks wrong, the metric's SQL is what changes.
9. **Phase 3.5 before calling this shipped**: compare prod `schema_version.fingerprint` against the new literal, confirm with the engineer before applying, then verify by real query — not by a "success" message.
10. **AC-067 is a human gate**: Zero Data Retention enabled in the Groq account's Data Controls, confirmed by a dated console check recorded in the Work Plan, before any non-fixture student essay is sent. Grading stays disabled until that entry exists.

## Related Information

- `docs/prd/essay-auto-scoring-prd.md` v1.2 — D1–D13, W1–W8, C1/C2, R1/R2/R6/R7, AC-024–AC-034, AC-062–AC-067, AC-072.
- `docs/adr/ADR-0010-score-write-trust-boundary.md` — the boundary amended here.
- `docs/adr/ADR-0011-mastery-write-trust-boundary.md` — "a second privileged operation is a separate function".
- `docs/design/short-answer-scoring-backend-design.md` — the Design Doc pair this feature's documents mirror.
- `TECH-DEBT.md` TD-005 — the hand-applied-SQL failure mode Phase 3.5 exists to prevent.
- `TECH-DEBT.md` TD-029 — the fired ADR-0010 kill criterion this ADR proceeds past by decision (Escalation 1).

## References

- `SOURCE/supabase/schema.sql` §10b, §11a, §11b, and the MASTERY WRITE block (`:1354`).
- `SOURCE/lib/supabase/service-role.ts`; `SOURCE/lib/billing/quota.ts:290–384`; `SOURCE/lib/ugc/gemini.ts`; `SOURCE/lib/scoring/wrongTwice.ts:45`; `SOURCE/scripts/check-ai-key-bundle.mjs`; `SOURCE/lib/support/actions.ts:127` (the `after()` ordering precedent).
- Production measurement 2026-08-27 (ref `pebjdlbgbmizgfpuptjl`, read-only): 152 questions, 13 essay, 100% `essay_answer` coverage, **0** essay answers ever submitted, fingerprint `021dd1387945` matching the repo.

## Update History

| Date | Change |
|---|---|
| 2026-09-01 | **AC-059 restated for weighted papers**: the essay line's two numbers now use the paper's mark scale rather than the 0..1 band scale, because on a weighted paper the band scale contradicted the score shown directly above it. Legacy rows keep the band scale. |
| 2026-09-01 | **Amendment: the `ScoreCard` 0-diff zone is lifted** (see *Amendment 2026-09-01* under § Amendment to ADR-0010). Both stated reasons for the freeze were answered by B1/B2/B3 + G1: the counters keep their meaning so `wrong = total − correct` survives, and the headline number no longer moves because it is withheld until grading resolves. `record_essay_grade()` gains a `total_score` recompute — the 3rd in-place `exam_results` mutation, which **fires the `TD-029` revisit trigger**. |
| 2026-08-28 | Initial draft (Proposed). Six decisions recorded; ADR-0010 amended on the row-immutability reading only. |
| 2026-08-29 | **Mechanical +9 line-number pass on `schema.sql` citations, after a code-verifier audit.** The drift was **systematic, not random**: every stale `schema.sql` number in this ADR and the PRD sat exactly **−9** from truth, because both were written before `main` was merged in. The 2026-08-28 pass corrected only one of them (`:1345` → `:1354`), which left this document mixing two vintages — a reader could not tell which number was which. Now corrected: `:840` → `:849` (the §11a revoke), `:871–944` → `:897–945` (`record_exam_result()`), `:1369–1392` → `:1378–1401` (the `telemetry_log` DDL — the old range ended before `created_at`, a column the same sentence enumerates). Also `quota.ts:290–400` → `:290–384` (the old range overshot the function by 16 lines), and `lib/tutor/telemetry.ts:66–73` relabelled: that is the `TelemetryLogInsert` **type**, not the payload builder, which is `buildTelemetryPayload()` at `:92–101`. The substantive claims all held — the audit verified the eight `telemetry_log` columns, the absence of `attempt_id`, the 11 `service-role.ts` operations, and both `SECRETS` pin sites as stated. |
| 2026-08-29 | **Status → Accepted.** Nothing substantive was outstanding: both escalations closed, `TD-029` filed with its two named revisit triggers, and three downstream documents already consuming the six decisions as binding constraints while the ADR still read `Proposed` — which had become the only thing making the chain look unsettled, with the Work Plan next. Also: **(a)** recorded the AC-011/AC-057 restatement on the Amendment's `ScoreCard` line — the marker sits on a separate line beside `ScoreCard`, not inside it, and `ScoreCard` is a 0-diff zone; the engineer chose to flag the restatement rather than revise the PRD's wording. **(b)** Repaired the *Known unknowns* cell, which stated the Groq 429 fact twice after the 2026-08-28 edit removed the telemetry item. |
| 2026-08-28 | **Both escalations resolved by the engineer.** *Escalation 1* — proceed inside the existing privileged-identity pattern, with the fired ADR-0010 kill criterion opened as **`TD-029`** in `TECH-DEBT.md`, which names the two conditions that force the revisit (a 14th `service-role.ts` operation, or a 3rd in-place `exam_results` mutation). A dated note inside this ADR was rejected as the mechanism because it is only read by someone already in this file. *Escalation 2* — accept `(user, question, day)` attribution; `telemetry_log` gains no column, the PRD's two-change budget holds, and the Design Doc must state the resolution limit in prose. |
| 2026-08-28 | **Phase 3.5 baseline moved before this feature wrote any DDL.** `main` gained three commits after this branch forked (`004d628`, `8f9148e`, `7894417`); `004d628` narrowed exam rating from a 1–10 to a 1–5 star scale, which is a `schema.sql` change, and it carries a data-mutating `update` over `exam_difficulty_ratings`. The fingerprint therefore moved `021dd1387945` → **`29931beeb950`**, and that migration **has already been applied to prod** (verified read-only against ref `pebjdlbgbmizgfpuptjl`, `applied_at` 2026-08-28 11:53 UTC). Prod and `main` are in sync; the clean Phase 3.5 baseline for this feature's two new functions is `29931beeb950`, not the value recorded in the draft. `main` was merged into this branch so the UI Spec and Design Docs are written against the tree that actually ships. Re-verified as **unchanged** by that merge: `globals.css` gained only `.rich-text` table rules, so the token inventory the UI Spec depends on (still no `--success`/`--warning`) is unaffected. |
| 2026-08-28 | Corrected after codebase analysis. **(1)** The draft counted `service-role.ts` at five operations and this feature as "the sixth and seventh"; it holds **eleven**, and ADR-0010's kill criterion has **already fired on both limbs** — promoted from a Known-unknown to **Escalation 1**, an engineer decision this ADR does not resolve. **(2)** `telemetry_log` has no `attempt_id`, so Decision 3's telemetry claim is not reconstructible per attempt — **Escalation 2**. **(3)** AC-029 has a second coupled site (`checkAiKeyBundleSecrets.test.ts`, exhaustive `toEqual` + `length === 7`) — guidance #5. **(4)** A host-keyed Groq emission scan would capture `check-ai-key-bundle.mjs` itself — new guidance #5b separates the bundle marker from the scan key. **(5)** The Groq counter's duplicate-or-export choice named explicitly, since every helper it needs is module-private in `quota.ts`. |
