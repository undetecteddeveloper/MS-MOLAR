# ADR-0011 Mastery Write Trust Boundary (Engine 1 Adaptive AI)

## Status

Accepted — 2026-08-08. Resolves PRD Undetermined Item U2 (`docs/prd/engine1-adaptive-ai-prd.md`, R3/AC-011). Direct precedent: ADR-0010 (Score Write Trust Boundary) — this ADR follows its reasoning shape and, where it diverges, states why.

- PRD: `docs/prd/engine1-adaptive-ai-prd.md` — R3 ("Mastery is written on real `submitExam`, not simulated" — D6), AC-011, Security NFR ("The mastery write path must respect the §11 trust boundary"), Risk R-d.
- Precedent: `docs/adr/ADR-0010-score-write-trust-boundary.md` — closes Critical #2 of `docs/security-review-2026-08-03.md`.
- Schema: `SOURCE/supabase/schema.sql` §18 (new — "MASTERY WRITE", this ADR). Sibling of §11 ("SCORE WRITE LOCKDOWN").
- Full mechanism detail, DDL, and integration point: `docs/design/engine1-adaptive-ai-backend-design.md` §"Architectural Decision — Mastery Write Trust Boundary (U2)" and §"Mastery Write Integration into submitExam".

## Context

`submitExam()` (`SOURCE/app/(layer2)/actions.ts:54-165`) runs against Postgres using the student's own JWT (the anon key + the student's session, via `SOURCE/lib/supabase/server.ts`) — at the database level, this Server Action and the student's own devtools are the same principal. ADR-0010 already established this exact fact for the score write and closed it: `results_insert_own`'s naive `user_id = auth.uid()` check let a student POST any score they liked, so score writes were moved behind `record_exam_result()`, callable only by `service_role`.

Engine 1's per-user skill mastery (`user_skill_mastery`, PRD scope diagram) is derived from the identical trusted input — `computeScore()`'s `perQuestion[].isCorrect`/`scored` — and reaches the database through the identical untrusted transport (`submitExam`, student's own JWT). Left unprotected, a mastery write reachable from that identity is exactly as forgeable as the pre-ADR-0010 score write: a student could inflate their own mastery rows directly via `PATCH /rest/v1/user_skill_mastery`, corrupting both their own adaptive routing (R5) and, if mastery data ever feeds a shared/aggregate signal in a later phase, other surfaces. PRD Risk R-d names this directly: "The mastery write path re-opens the §11 trust boundary."

Where this ADR's problem shape **differs** from ADR-0010's: the PRD's own Reliability NFR states "A failed mastery update must not break exam submission. Scoring and result recording are the load-bearing path; the adaptive model is an addition to it." Score writing has no such carve-out — a failed score write **must** fail loudly (the student needs their real result). This asymmetry is the deciding factor below.

## Decision

**Mirror ADR-0010's trust-boundary mechanism (privileged `service_role` identity, INVOKER function, user identity derived from the attempt row, never from a parameter) but do NOT extend `record_exam_result()`. Introduce a separate function, `record_skill_mastery()`, called as a second, independent, best-effort step from `submitExam()` after the score write has already succeeded.**

### Decision Details

| Item | Content |
|------|---------|
| **Decision** | New function `public.record_skill_mastery(p_attempt_id uuid, p_per_question jsonb) returns void`, `EXECUTE` revoked from `public`/`anon`/`authenticated`, granted only to `service_role`. Called from `SOURCE/lib/supabase/service-role.ts` (`recordSkillMastery()`), invoked by `submitExam()` immediately after `recordExamResult()` succeeds. Its own failure is caught and logged, never re-thrown — the redirect to the result page proceeds regardless. |
| **Why now** | D6 (PRD, locked) requires mastery to be written on real submission, not simulated, for the engine to learn from real users. The write path is a new client-forgeable surface the moment it exists; closing it must ship in the same change as introducing `user_skill_mastery`, not as a follow-up. |
| **Why this (separate function, not an extension of `record_exam_result()`)** | Extending `record_exam_result()` would make the mastery write and the score write atomic (same statement, same implicit transaction) — attractive for consistency, but it directly contradicts the PRD's explicit Reliability NFR: a malformed mastery-side join (e.g., a data anomaly in `p_per_question`) would raise inside `record_exam_result()` and roll back the **score** insert too, breaking exam submission for a reason the student has nothing to do with. A separate function, called as a second step from `submitExam()` (TS-level try/catch, not a SQL transaction boundary), decouples the two: the score is durably written first; the mastery update is attempted after and is allowed to fail without taking the score down with it. This is the primary way this ADR **diverges** from a literal mirror of ADR-0010, and the divergence is driven by an explicit, written NFR — not a preference. |
| **Why this (INVOKER, not SECURITY DEFINER)** | Exactly ADR-0010's reasoning, restated for this function: `service_role` already bypasses RLS and retains its table grants (a Supabase platform default, not declared in this schema — the same fact `record_exam_result()` already relies on), so `record_skill_mastery()` works correctly as `INVOKER`. Keeping it `INVOKER` means two independent misconfigurations are required before a student could reach it — `grant execute ... to authenticated` on the function, **and** `grant insert/update on public.user_skill_mastery to authenticated` on the table — not one. `SECURITY DEFINER` would collapse that to a single point of failure (the function itself) and would additionally require this new function to defend its own input the way `exam_answer_key()` must (§10a comment), for no benefit here since the only caller is already the privileged `service-role.ts` module. |
| **Why user_id is derived, not passed** | Same shape as `record_exam_result()` (§11b): `user_id` is selected from `exam_attempts` by `p_attempt_id`, requiring `status = 'submitted'`. The caller cannot name a different user's id, and cannot invoke this against an attempt that has not been legitimately closed by `claim_attempt_answer_key()` (§10b). |
| **Why the skill lookup happens in SQL, not in TypeScript** | The function joins `p_per_question`'s `questionId` values against `public.questions.skill_node_id` **inside** the SQL body, rather than requiring `submitExam()` to fetch `skill_node_id` into the `Question` TS type and pass a pre-computed skill-delta payload. This keeps `skill_node_id` out of the TS layer entirely for Sprint 1 (no new field on `Question`/`PerQuestionResult`, no second TS-side aggregation module whose output would need to be trusted or re-verified) — see the Design Doc's Minimal Surface Alternatives for the full comparison. This is aggregation over already-server-computed, already-trusted data (`p_per_question`, produced by `computeScore()` and already the exact payload `record_exam_result()` persists verbatim) joined against reference data (`questions.skill_node_id`) — not a re-implementation of scoring logic, so ADR-0010's "why not re-score in SQL" objection (two divergent implementations of a *judgment call*, like Vietnamese numeric equivalence) does not apply: there is exactly one thing being computed (a `GROUP BY` count), and it is computed once. |
| **Known unknowns** | Whether the "no telemetry row on mastery-write failure" choice (Design Doc, Error Handling) under-serves observability once real usage exists — currently mitigated only by a `console.error` line, mirroring `submitExam`'s existing `recordExamResult` failure handling. |
| **Kill criteria** | If a second feature ever needs a privileged, best-effort, derived-identity write of this shape, consider factoring the "derive user_id from a submitted attempt, INVOKER, service_role-only" pattern into a documented convention rather than a third bespoke function — but not before a second real consumer exists (YAGNI). If mastery-write failures turn out to be frequent enough that silent best-effort logging is insufficient, revisit whether they need a `telemetry_log` row (schema already supports an `event_type` extension) or an alerting hook. |

## Rationale

### Options Considered

1. **Extend `record_exam_result()` to also upsert `user_skill_mastery` in the same statement (atomic with the score write).**
   - Pros: Single trust boundary, single call site, mastery and score can never diverge (both commit or both roll back), zero new `EXECUTE` grant to manage.
   - Cons: Directly violates the PRD's Reliability NFR ("A failed mastery update must not break exam submission") — a mastery-side failure would roll back the score insert, breaking the load-bearing path for a non-load-bearing reason. Also broadens an already security-critical function's blast radius (more logic inside the one function every score write depends on).

2. **A new `SECURITY DEFINER` function, called directly by `submitExam()` (student's own JWT), guarded by its own entitlement check (mirroring `exam_answer_key()`'s pattern of re-deriving eligibility inside the function body).**
   - Pros: Does not require routing through `service-role.ts` at all; keeps the score-write module (`service-role.ts`) untouched.
   - Cons: `SECURITY DEFINER` means a single mistake (an over-broad `EXECUTE` grant) is sufficient to let a student call it with an arbitrary `p_attempt_id`/`p_per_question` pair — unlike the INVOKER options, there is no second, independent privilege check standing behind it. Also inconsistent with this project's own established convention: every other privileged write in this codebase (`record_exam_result`) is INVOKER-via-`service_role`, not DEFINER; introducing a DEFINER write here would be a second, differently-shaped trust boundary for a reader to reason about, for no stated benefit.

3. **Selected — separate INVOKER function (`record_skill_mastery`), `service_role`-only, called as a second, independent, best-effort step from `submitExam()` after the score write succeeds.**
   - Pros: Mirrors ADR-0010's proven mechanism exactly (two independent misconfigurations required to reopen the hole); satisfies the PRD's explicit Reliability NFR by construction (failure is caught in TS between the two RPC calls, not inside a shared SQL transaction); keeps `record_exam_result()`'s existing, already-audited logic untouched.
   - Cons: Score and mastery are no longer strictly atomic — a request that crashes between the two calls (extremely narrow window: after `recordExamResult()` returns, before `recordSkillMastery()` is awaited) leaves a submitted, scored attempt with no mastery update. Accepted: `submitExam()`'s existing idempotency guard (`attempt.status === 'submitted'` short-circuit, `SOURCE/app/(layer2)/actions.ts:82-84`) means the attempt is never re-scored on a retry, so this narrow gap is not self-healing — see Design Doc Risks and Mitigation for the accepted-risk statement.

## Consequences

### Positive Consequences

- Mastery data carries the same forgery-resistance guarantee ADR-0010 already established for scores: a student's own JWT can reach neither `user_skill_mastery`'s write path nor `record_skill_mastery()`'s `EXECUTE` privilege.
- Score submission (the load-bearing path, per the PRD's own framing) is unaffected by any failure mode in the mastery-derivation logic — satisfies the Reliability NFR by construction, not by convention.
- The mechanism is a direct, recognizable sibling of `record_exam_result()` — a maintainer who has read ADR-0010 needs no new mental model, only "same shape, second call, non-fatal."

### Negative Consequences

- Score and mastery are not transactionally atomic (see Option 3 cons above) — an accepted, narrow-window inconsistency, not a designed feature.
- A second `EXECUTE`-restricted function is now part of the surface `service-role.ts` exposes, incrementally growing the file ADR-0010's own "Known unknowns" flagged for exactly this kind of growth ("Whether `service-role.ts` stays narrow. Every operation added there widens a blast radius that bypasses all RLS.").

### Neutral Consequences

- `user_skill_mastery` gains no `INSERT`/`UPDATE` RLS policy for `authenticated` at all (unlike `exam_results`, which retains an unreachable-but-present `results_insert_own` policy as a second defensive layer) — there is no legitimate client-side mastery write to defend a policy shape for, so none is added. See Design Doc §Schema for the exact RLS.

## Architecture Impact

- **Components that change**: `SOURCE/supabase/schema.sql` (new table `user_skill_mastery`, new function `record_skill_mastery`), `SOURCE/lib/supabase/service-role.ts` (new export `recordSkillMastery()`), `SOURCE/app/(layer2)/actions.ts` (`submitExam()` gains a second, non-throwing post-score-write step).
- **New dependencies introduced**: none (no new library; reuses the existing `@supabase/supabase-js` service-role client already instantiated by `serviceRoleClient()`).
- **Architectural constraints added**: any future privileged write of this shape (derive identity from a submitted attempt, best-effort relative to some other write) should default to this same INVOKER + `service_role`-only + derived-identity pattern unless a documented reason justifies `SECURITY DEFINER`.
- **Architectural constraints removed**: none.

## Implementation Guidance

- Derive the acting user's identity from trusted server-side state (the attempt row), never from a caller-supplied parameter — apply this to any future privileged write, not only this one.
- Prefer `INVOKER` over `SECURITY DEFINER` for `service_role`-only functions unless the function must also be reachable (with its own entitlement re-check) from a non-`service_role` caller; `exam_answer_key()`/`claim_attempt_answer_key()` are the DEFINER precedent for that different case, not this one.
- When a new write's failure must not affect an already-existing, higher-priority write's success (per an explicit NFR), keep them as separate statements/calls with independent error handling — do not default to "one transaction is simpler" without checking whether an NFR already answered the atomicity question.
- Revoke `EXECUTE` from `public`, `anon`, **and** `authenticated` by name on every new function, every time — Supabase's default privileges grant `EXECUTE` to all three automatically, and `revoke ... from public` alone does not undo this (schema.sql §10b's own recorded incident, 2026-08-03).

## Related Information

- `docs/adr/ADR-0010-score-write-trust-boundary.md` — direct precedent, mechanism mirrored above.
- `docs/prd/engine1-adaptive-ai-prd.md` — R3, AC-011, Security NFR, Risk R-d, Undetermined Item U2.
- `docs/design/engine1-adaptive-ai-backend-design.md` — full DDL, integration point in `submitExam()`, and the Minimal Surface Alternatives analysis for keeping `skill_node_id` out of the TS layer.
- `SOURCE/supabase/schema.sql` §11 (`SCORE WRITE LOCKDOWN`) — the block this ADR's §18 sits beside.

## Update History

| Date | Version | Changes | Author |
|------|---------|---------|--------|
| 2026-08-16 | — | Decision **unchanged and verified end to end** (Final Phase Task 23). Confirmed in the shipped `schema.sql` §18: `record_skill_mastery()` declares no `security definer` and is therefore `INVOKER` as decided; `revoke all on function ... from public, anon, authenticated` is present by name, with `grant execute` to `service_role` alone; `v_user_id` is derived from the `exam_attempts` row and the function raises `check_violation` unless `status = 'submitted'`, so no caller can assert an identity or write against an unsubmitted attempt; `user_skill_mastery` additionally revokes `insert, update, delete` from `anon, authenticated` and exposes only a `mastery_select_own` read policy. Proven, not merely inspected: `recordSkillMastery.int.test.ts` Test 2 (a real student JWT calling `.rpc("record_skill_mastery", ...)` is denied) and `test-rls.ts` Phần 7 case `MM-b`. The accepted residual also held as written — the narrow window where a crash between `recordExamResult()` and `recordSkillMastery()` leaves a scored attempt with no mastery row is still not self-healing on retry, and is still the right trade against rolling back a score. | Final Phase Task 27 (Claude) |
