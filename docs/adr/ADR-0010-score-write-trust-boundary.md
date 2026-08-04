# ADR-0010 Score Write Trust Boundary (Privileged Identity vs. Re-scoring in SQL)

## Status

Accepted — 2026-08-03. Closes Critical #2 of `docs/security-review-2026-08-03.md`.

- Security review: `docs/security-review-2026-08-03.md` — Critical #2 ("Students can write their own scores into the database").
- Sibling: ADR-0001 (owns the RLS-enforcement posture this ADR makes an exception to).
- Schema: `SOURCE/supabase/schema.sql` §11. Gate: `SOURCE/supabase/test-rls.ts` cases S-a…S-e.

## Context

`results_insert_own` was `for insert with check (user_id = auth.uid())` and nothing else. The database never verified that the attempt belonged to the writer, that it had been submitted, or that the score matched what `computeScore` produced. Two abuses followed:

1. **Self-graded scores** — `POST /rest/v1/exam_results {total_score: 10, correct: 40, total: 40}` with the student's own JWT.
2. **Attempt-slot squatting** — `exam_results.attempt_id` is `UNIQUE`, so a row pointing at *another* user's attempt permanently breaks that user's real submission with `23505`. Hard to exploit (attempt ids are unguessable UUIDs) but the same policy hole.

The structural cause is that **`submitExam` is server code that authenticates to Postgres as the student.** It uses the anon key plus the user's own JWT (`lib/supabase/server.ts`), so at the database level a Server Action and the student's devtools are the same principal. Anything the server may write, the student may write directly.

Tightening the policy alone cannot close abuse (1): a student can legitimately submit, then supply any score they like for their own submitted attempt. Scoring correctness cannot be expressed as a `WITH CHECK` predicate, because the DB has no way to know what `computeScore` would have returned.

## Decision

**Remove the client's write access to `exam_results` entirely, and route the score write through a privileged identity (`service_role`) whose only entry point is a narrow, server-only module.** Do **not** reimplement scoring in SQL.

### Decision Details

| Item | Content |
|------|---------|
| **Decision** | `revoke insert, update, delete on public.exam_results from anon, authenticated` (§11a). Score writes go through `record_exam_result()` (§11b), `EXECUTE`-granted to `service_role` only, called from `SOURCE/lib/supabase/service-role.ts`. |
| **Why this** | Keeps scoring logic in exactly one implementation (`lib/scoring/computeScore.ts`, unit-tested), while making "only the server may write a score" true at the database level rather than by convention. |
| **Why not re-score in SQL** | `computeScore` is not cheaply portable: `short_answer` does Unicode NFC normalization plus Vietnamese numeric-equivalence parsing with an explicit ambiguity rule (`1.234.567` falls back to text compare), and `true_false` decodes the `"a:Đ,b:S"` codec. A PL/pgSQL twin would have to reproduce `String.normalize("NFC")` and JS `Number()` edge semantics. Two implementations of a grading rule diverge silently, and the symptom is wrong marks on real students' exams. |
| **Why not policy-only** | Closes squatting and unsubmitted writes, leaves self-graded scores open — the review's third missing check. Acceptable only while no leaderboard/certificate/reporting exists, which is precisely the condition about to change. |
| **Known unknowns** | Whether `service-role.ts` stays narrow. Every operation added there widens a blast radius that bypasses all RLS. |
| **Kill criteria** | If `service-role.ts` grows beyond a handful of tightly-scoped operations, or if a second caller needs privileged writes, revisit: either a dedicated least-privilege Postgres role (INSERT on `exam_results` only, via direct connection) or moving scoring server-side behind a real backend identity. |

### Containment of the privileged identity

`SUPABASE_SERVICE_ROLE_KEY` bypasses **all** RLS, column privileges (§10c) and author policies. Before this ADR it appeared only in local scripts; this is its first use in a request path. Four containments, in order of how early they fail:

1. **`import "server-only"`** in `lib/supabase/service-role.ts` — the build fails if a client component ever imports it.
2. **No client is exported.** `serviceRoleClient()` is private; the module's public surface is one named operation. Nobody can import "an admin client" and reuse it.
3. **Enforcement lives in SQL, not at the call site.** `record_exam_result()` derives `user_id` from the attempt (the caller cannot name a user) and rejects any attempt that is not `status = 'submitted'`. A wrong call site still cannot write a score to the wrong account or for an unfinished exam.
4. **Bundle scan** — `scripts/check-ai-key-bundle.mjs` fails the build if the key value, `SUPABASE_SERVICE_ROLE_KEY`, or the `record_exam_result` marker appears in `.next-build/static`.

### Defence in depth on the DB side

`record_exam_result()` is deliberately **not** `SECURITY DEFINER`. `service_role` already bypasses RLS and retains its table grants, so the function works as `INVOKER`. The consequence is that two independent mistakes are required before a student could write a score: someone must both re-grant `INSERT` on `exam_results` **and** grant `EXECUTE` on the function to `authenticated`. The (now unreachable) `results_insert_own` policy is likewise kept and tightened, so a careless `grant all on schema public` does not on its own reopen abuse (1) or (2).

## Consequences

- `submitExam` no longer writes through the user's client; a regression to `supabase.from("exam_results").insert(...)` is a `42501` in production, and is caught earlier by `submitExam.int.test.ts` obligation (f).
- Deployment now has a second hand-applied SQL section that must land with the code (`docs/TECH-DEBT.md` TD-005). `npm run verify:schema` checks §10 and §11 together and distinguishes "permission revoked" (`42501`) from "merely blocked by the foreign key" (`23503`), so a half-applied §11 cannot read as green.
- `exam_results` is now append-only from every client's perspective. Any future "retake / rescore" feature must go through the same privileged path rather than an `UPDATE` policy.
