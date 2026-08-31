# ADR-0019 Continuing With `service_role` After ADR-0010's Kill Criterion Fired

## Status

**Accepted — 2026-08-31.** Decides the architecture half of `TECH-DEBT.md` TD-029, which had been open since 2026-08-28 with three paths kept and none chosen.

- Parent: **ADR-0010** (score write trust boundary) — this ADR does not overturn it. It answers the question ADR-0010 told a later reader to ask, and it **replaces ADR-0010's kill criterion**, which has been spent and cannot fire again.
- Siblings: **ADR-0011** (mastery), **ADR-0012** (support admin allowlist — carries the read half of the risk this ADR leaves uncovered), **ADR-0013/0014** (payments), **ADR-0018** (essay grade write — the last two operations to land).
- Gate: `SOURCE/lib/supabase/__tests__/serviceRoleSurface.test.ts`. Debt entry: `TECH-DEBT.md` TD-029.

## Context

### The criterion fired, and it cannot fire again

ADR-0010 wrote its own kill criterion:

> *"If `service-role.ts` grows beyond a handful of tightly-scoped operations, **or if a second caller needs privileged writes**, revisit: either a dedicated least-privilege Postgres role (INSERT on `exam_results` only, via direct connection) or moving scoring server-side behind a real backend identity."*

Both clauses were satisfied by 2026-08-28, and TD-029 recorded it. The engineer chose to continue and open a debt line rather than block ADR-0018 mid-flight — payments and support are what pushed the count past "a handful", so halting essay grading would not have fixed what had already broken.

That decision was correct and is not revisited here. What is revisited is the state it left behind: **a kill criterion that has already fired is not a criterion.** "A handful" cannot fire a second time, and the next person to add an operation would read ADR-0010, see a threshold, and reasonably conclude it had not yet been crossed.

### What the surface actually looks like (measured 2026-08-31)

`grep -c "^export async function" SOURCE/lib/supabase/service-role.ts` → **13**. Split by how each one reaches the database:

| Shape | Count | Operations |
|---|---|---|
| `.rpc()` into a SQL function that re-derives its own authorization | 6 | `recordExamResult`, `recordSkillMastery`, `changeSupportTicketStatus`, `recordPaymentSettlement`, `claimEssayGradingAttempt`, `recordEssayGrade` |
| `.from(…)` **read** | 3 | `listReportedExams`, `listSupportTickets`, `readPaymentOrderForSettlement` |
| `.from(…)` **write** | 4 | `moderateExam`, `flagSupportTicketNotifyFailed`, `addSupportTicketNote`, `recordPaymentOrder` |

This split, not the number 13, is where the residual risk lives — and TD-029 named the risk correctly but attributed it to the wrong quantity. `service_role` bypasses all RLS, so:

- A `.rpc()` operation is safe against a wrong call site **by construction**. `record_exam_result()` does not accept a `user_id`; it derives the owner from the attempt and refuses anything that is not `status = 'submitted'`. A call site that passes garbage still cannot write a score to the wrong account.
- A `.from(…).update(…)` operation is **exactly as correct as its caller**. The privileged identity forwards whatever parameter it is handed, and there is no layer beneath it that will object.

Six of thirteen operations were already in the safe shape before this ADR. Nobody had written that down, so nothing preserved it.

## Decision

**Keep `service_role`. Do not introduce a second database identity. In exchange, make "a privileged write goes through `.rpc()`" an enforced property rather than an observed accident, and replace ADR-0010's spent kill criterion with criteria that can actually fire.**

### Decision Details

| Item | Content |
|------|---------|
| **Decision** | Path (c) of TD-029 — continue with the existing privileged identity. No new Postgres role, no direct connection, no new secret, no new dependency. |
| **What is added** | `serviceRoleSurface.test.ts` grows from one gate (operation count) to two. The second pins the **write shape**: an exported operation may not reach a table with `.insert/.update/.upsert/.delete` unless its name appears in `DIRECT_WRITERS_AT_ADR_0019` — a list of exactly the four that predate this ADR. |
| **Why enforce shape rather than count** | The count was always a proxy. Thirteen `.rpc()` operations would be safer than four direct writes, and the count cannot tell them apart. Shape measures the property the risk is actually made of. |
| **Why not (a): least-privilege role via direct connection** | ADR-0010 named it, and it is the textbook answer. On this deployment it costs a Postgres connection pooler, a `pg`/`postgres.js` driver, a second data-access path alongside PostgREST, and a database password in Vercel's environment — permanent maintenance surface for a two-person project. It also would not fix the four direct writes: a narrowly-granted role still forwards a wrong `id` into a table it is allowed to write. Deferred, not rejected on merit. |
| **Why not (b): scoring behind a real backend identity** | Larger than (a) and cuts across scoring, mastery, payments and support simultaneously. Proportionate to a team that can run a migration of that size; this one cannot right now. |
| **Why (c) is not "do nothing"** | "Do nothing" leaves the surface free to get worse silently, which is how it reached 13 in the first place. Under this ADR the fifth direct write is a red test in the author's own pull request, naming the SQL-function pattern and the six operations already using it. |
| **Known unknowns** | Whether the four grandfathered writes can each be expressed as a SQL function. `moderateExam` writes two tables and wants a transaction; `recordPaymentOrder` returns generated columns to the caller. Neither was attempted here. |

### Kill criteria (replacing ADR-0010's)

ADR-0010's criterion was prose about a quantity nobody re-measured. These are assertions in `serviceRoleSurface.test.ts`, and each fails in the pull request that violates it:

1. **A fifth direct write** — an exported operation reaching a table with a write verb, not listed in `DIRECT_WRITERS_AT_ADR_0019`.
2. **A fourteenth operation** — `OPERATIONS_AT_LAST_REVIEW`, carried over unchanged.
3. **A second privileged client** — more than one `createClient(` or more than one read of `process.env.SUPABASE_SERVICE_ROLE_KEY` in the module. Without this, operation fourteen needs no new `export` at all: it only needs a second client inside a function that already exists, and criteria 1 and 2 both keep reading green.

A fourth criterion stays in prose because no test can express it: **a third proposal to mutate `exam_results` in place** (ADR-0018 spent the first two — claim and settle).

Raising a threshold is a valid response to any of these. Raising it *silently* is not: each failure message says so, and asks for a line in TD-029 in the same commit.

## What this ADR does not fix

Stated plainly so that a later reader does not mistake a boundary for a repair:

- **No privilege was reduced.** All thirteen operations still run as `service_role` and still bypass every RLS policy, column privilege and author check in `schema.sql`. TD-029 stays open, and its own definition of done — *name an operation that no longer needs `service_role`, and prove it in `test-rls.ts`* — is unchanged and unmet.
- **The four grandfathered writes still trust their call sites.** They are recorded, not repaired.
- **Reads are not covered.** `listSupportTickets` reads every ticket in the system as `service_role`. What stands between that and a leak is the admin allowlist of ADR-0012 and Next.js routing — not the database. The write-shape gate deliberately does not claim otherwise; adding reads to it would make it fail on `listReportedExams` on day one, and a gate that is red on arrival gets deleted.
- **The gate reads source text, not semantics.** It strips comments first — the first draft failed on a doc comment containing the literal string `.from().update()`, written to warn a future reader *against* doing that. A construction it cannot see (a table name built at runtime, a helper in another module) is a construction it cannot stop.

## Consequences

- `service-role.ts` now has a documented shape, not just a documented size. New privileged writes are expected to arrive as SQL functions, which moves enforcement into the database and shrinks what a call-site bug can do — the same reasoning ADR-0010 used for `record_exam_result()`, now stated as a rule instead of an example.
- Converting a grandfathered write to `.rpc()` turns the gate **red on good news**, until its name is removed from the list. This is intentional: a list that quietly overstates the privileged surface is worse than no list, because the next person sizes the risk from it.
- TD-029 changes character. It is no longer "an unmade decision"; it is "a decision made, with a cost accepted and a date on it." The three paths remain in the debt entry, and (a) is the one to reach for first if the constraint that ruled it out — maintenance capacity — changes.
