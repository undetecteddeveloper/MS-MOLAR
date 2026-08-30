// Essay (Tự luận) Auto-Scoring — SERVICE-INTEGRATION-E2E lane skeleton
// Design Docs: docs/design/essay-auto-scoring-backend-design.md (v1.3, § Nhóm 3
//                — hai hàm đặc quyền :1584, § Test Boundaries :2181,
//                § Integration Verification Points :2201)
// UI Spec:     docs/ui-spec/essay-auto-scoring-ui-spec.md (v1.3) — no UI in this lane
// PRD:         docs/prd/essay-auto-scoring-prd.md (v1.2, AC-009, AC-045, AC-062,
//                AC-063, AC-064)
// ADR:         docs/adr/ADR-0018-essay-async-grade-write.md (Accepted; D1, D1b, D3,
//                D4; Implementation Guidance #6 and #7 mandate exactly these two
//                cases, in exactly this shape)
// Generated:   2026-08-29 | Budget used: integration 3/3, fixture-e2e 3/3, service-e2e 2/2
//
// =============================================================================
// FILE STATUS — read before editing
// =============================================================================
// BOTH CASES ARE SKELETONS (`it.todo`), and they describe a database that DOES NOT
// EXIST YET. Nothing in this feature has been applied to any database:
// `claim_essay_grading_attempt()` and `record_essay_grade()` have not been written,
// no DDL has been run on dev or prod, and the schema fingerprint is still
// `29931beeb950`. These are therefore descriptions of the assertions to write, not
// assertions parked behind a flag.
//
// HOW THIS LANE RUNS: `npm run test:localdb` (from `SOURCE/`), i.e.
// `vitest run --config vitest.localdb.config.ts`, which globs
// `tests/e2e/service/**/*.test.{ts,tsx}`. It is deliberately OUT of the `npm test`
// CI gate because it needs a real Supabase dev database — a missing credential
// would turn CI red for the environment rather than for a defect. The file is
// collected by that config from the moment it is committed; `it.todo` is what keeps
// `npm run test:localdb` from reporting "No test suite found in file" and exiting 1
// while the cases are unwritten.
//
// PRECONDITION, BLOCKING — do not run this file before all three hold:
//   1. The two functions and their grant block exist in `SOURCE/supabase/schema.sql`
//      (new section after §11, cross-referenced from it — ADR-0018 Implementation
//      Guidance #1).
//   2. The DDL has been APPLIED TO DEV, and `npm run verify:schema` is GREEN on
//      dev — including the two new grant assertions and the ESSAY_MAX_ATTEMPTS pin.
//   3. Phase 3.5 has been observed for prod: compare prod
//      `schema_version.fingerprint` against the new literal, get the engineer's
//      confirmation BEFORE applying, and verify afterwards BY REAL QUERY, not by a
//      "success" message.
//   Running this file against a database that has not received the DDL produces
//   `PGRST202` failures that look exactly like implementation defects and are not.
//   That is TD-005's failure shape, which has already fired FOUR times in this
//   repository. If this file is red and precondition 2 is not green on dev: FIX THE
//   DATABASE, DO NOT FIX THE TEST.
//
// -----------------------------------------------------------------------------
// PLACEMENT — an open question the engineer should settle, not a decision made here
// -----------------------------------------------------------------------------
// The backend Design Doc assigns these exact proofs to `SOURCE/supabase/test-rls.ts`
// § Part 10, cases EG-a..EG-e (:2201). It does not mention
// `SOURCE/tests/e2e/service/**`, `vitest.localdb.config.ts` or
// `npm run test:localdb` anywhere — although that lane exists, is committed, and
// its own config comment states its purpose in the same words the Design Doc uses
// ("properties of real Postgres that a mocked Supabase client cannot prove").
// `test-rls.ts` has no npm script and is run by hand with `npx tsx`.
// This skeleton is placed in the runnable lane because that is the one a CI-adjacent
// command executes and a reviewer can re-run. THE OBLIGATIONS BELOW ARE THE SAME
// EITHER WAY: SVC-1 = EG-c + EG-d, SVC-2 = EG-a + EG-b + EG-e. If the engineer
// prefers the Design Doc's placement, move the obligations into `test-rls.ts`
// Part 10 VERBATIM and DELETE this file — do not fill both, or the two homes drift
// and the duplicate becomes the one nobody runs.
//
// -----------------------------------------------------------------------------
// MOCK BOUNDARY
// -----------------------------------------------------------------------------
// NOTHING IS MOCKED IN THIS FILE. That is the entire reason the lane exists:
// backend DD § Mock Boundary Decisions marks the two SQL functions "KHÔNG — Postgres
// thật", because a mock cannot prove (a) that `jsonb_agg` without `order by`
// shuffles the array, (b) that `where … <> 'graded'` matches ZERO ROWS rather than
// raising, or (c) that the `revoke`/`grant` pair was actually applied to the
// database. All three are the subject here.
// @real-dependency: real Postgres (Supabase dev), real `service_role` key, real
//   student JWTs for the negative cases.
// ZERO PROVIDER CALLS: neither case contacts Groq, and neither can. Grading ships
//   DISABLED behind the AC-067 human gate (Zero Data Retention) and no Groq account
//   exists; these two SQL functions have no network reach by construction. Note the
//   seam honestly: SVC-2 proves the CLAIM REFUSES; it does not by itself prove "with
//   zero provider calls", because no provider is reachable from SQL. The
//   zero-call half of AC-064 belongs to the orchestrator case (`gradeEssays`
//   claim -> budget -> provider -> settle ordering), which is the top UNSELECTED
//   integration candidate (ROI 57) — see the generation report. Do not let SVC-2's
//   name imply it discharges that half.
//
// FIXTURE HYGIENE — follow `SOURCE/supabase/test-rls.ts` Part 7 (:133-153) and
// `recordSkillMastery.int.test.ts`: an isolated id prefix per case ("eg-svc-"),
// idempotent setup and teardown, each case creating its own user + exam + attempt +
// exam_results row and deleting them afterwards. Order independence must be
// MEASURED, not assumed: run the file under `--sequence.shuffle.tests` with several
// seeds and run each case alone with `-t` before claiming it. The shipped claim in
// `subscription.service.e2e.test.ts` was once written from assumption and was wrong
// in the most dangerous direction — it read as a guarantee.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  adminClient,
  EG_PREFIX,
  HAS_LIVE_DB,
  readPerQuestion,
  setUp,
  tearDown,
  type EssayFixture,
} from "./essayGradeWriteFixtures";
// KHONG BAO GIO go `3` thanh mot literal o day: tran luot la mot hop dong giua
// SQL va TypeScript, va `verify:schema` ghim hai ben khop nhau. Go lai so la
// tao mot loi khai THU BA.
import { ESSAY_MAX_ATTEMPTS } from "@/lib/scoring/essayLifecycle";

const admin: SupabaseClient = HAS_LIVE_DB ? adminClient() : (undefined as never);

// =============================================================================
// SVC-1 — RESERVED SLOT. The settle write: array order survives, and the second
//         band for one pair is refused as a VALUE, not an exception
// =============================================================================
// AC: EG-BE-005 — "When record_essay_grade() runs on an attempt with three essay
//   questions and writes the band for the SECOND, the system must leave the
//   per_question array with an UNCHANGED questionId sequence."
// AC: EG-BE-006 — "When record_essay_grade() is called a second time for an
//   (attempt_id, question_id) pair that is already graded, the system must return
//   false (0 rows affected), must NOT raise, and the stored band must equal exactly
//   the first write."
// AC: EG-BE-007 — "When record_essay_grade() is called on an element in `failed`,
//   the system must be able to write (failed -> graded and failed -> failed are both
//   legal); `graded` is absorbing."
// AC: EG-BE-009 — "Both functions must not take a user_id parameter and must not
//   mention total_score, correct, total, topic_breakdown or overtime_seconds
//   anywhere in the function body."
// Also discharges: PRD AC-009, AC-062, AC-063; ADR-0018 D1b, D3, and its
//   Implementation Guidance #6 and #7 (which prescribe this case's exact shape);
//   backend DD Integration Verification Points EG-c and EG-d; risk R-01.
// ROI: 100 (BV:10 x Freq:9 + Legal:0 + Defect:10)
//   BV 10 — R-01 is rated "Cao": a missing `order by ord` reorders EVERY question
//     on the review page the first time any essay is graded. The student sees their
//     answers attached to the wrong questions. Nothing about the band looks wrong.
//   Freq 9 — every graded essay in the system executes this statement.
//   Defect 10 — `order by ord` reads like decoration inside a `jsonb_agg`, and
//     Postgres is FREE to return a different order without it, so the defect is
//     both easy to omit and non-deterministic to reproduce. ADR-0018 wrote the case
//     shape down precisely because "the band landed" passes while the page shuffles.
//   RESERVED-SLOT JUSTIFICATION: the journey's correctness depends on a real DB
//   write — data persisted through `jsonb_agg` in real Postgres, and a `WHERE`
//   predicate matching zero rows rather than raising. Neither is expressible with
//   fixtures: a mocked client would assert the mock's own return value.
// Behavior: seed one submitted attempt whose exam_results.per_question holds three
//   essay elements in a known order (plus non-essay elements around them) -> call
//   record_essay_grade() as service_role for the MIDDLE essay -> read the row back
//   by real query -> the full questionId sequence is unchanged and only the target
//   element's keys moved -> call it a second time for the same pair with a
//   DIFFERENT band -> it returns false and changes nothing.
// @category: service-integration-e2e
// @lane: service-integration-e2e
// @dependency: full-system (real Supabase dev Postgres, real service_role client,
//   real schema.sql functions)
// @complexity: high
// @real-dependency: real Postgres — nothing mocked
// Primary failure mode: the update rebuilds `per_question` with
//   `jsonb_agg(...)` and no `order by ord`, so the array comes back in an
//   unspecified order; the band is correct, the test that only checks the band is
//   green, and every question on /result/detail is now paired with the wrong
//   answer text. The second mode: first-write-wins is implemented as a read-then-
//   write in TypeScript or as a RAISE inside the function, so a duplicate settle
//   either overwrites a band (losing the first, authoritative one) or surfaces to
//   the student as an error — when AC-062 requires it to be an ordinary,
//   never-displayed outcome routed to telemetry.
// Proof obligation — what the implemented test must assert:
//   (a) FULL SEQUENCE, not the band: after settling the SECOND of three essays,
//       `per_question.map(e => e.questionId)` toEqual the independently authored
//       literal array captured BEFORE the write, element for element, including the
//       non-essay elements. Asserting "the second element is still the second
//       element" is not enough — assert the whole sequence. This is the assertion
//       whose absence ADR-0018 Implementation Guidance #6 names explicitly.
//   (b) ELEMENT SCOPE: every OTHER element in the array is byte-identical to its
//       pre-write value (deep equality against the captured literal), and the target
//       element differs ONLY in essayState / essayEarned / essayMax /
//       essayLowConfidence / essayGradedAt. `essayAttempts` must NOT be touched by
//       the settle — it belongs to the claim (D4).
//   (c) COLUMN SCOPE: `total_score`, `correct`, `total`, `topic_breakdown` and
//       `overtime_seconds` on the row are unchanged after the write (read back and
//       compare to the seeded literals). This is AC-009 proven against the database
//       rather than against the function's source text.
//   (d) DUPLICATE SETTLE IS A VALUE: a second call for the same
//       (attempt_id, question_id) with a DIFFERENT band returns FALSE / zero rows —
//       assert the RETURN VALUE, and assert the call did not throw (wrap so a raise
//       fails the case with a message that says "raised instead of returning
//       false"). Then read the row back: the stored band equals the FIRST write, and
//       `essayState` is still `graded`.
//   (e) `failed` IS NOT ABSORBING: settle an element to `failed`, then settle the
//       same pair to `graded` — the second call returns TRUE and the band lands.
//       Then settle it again -> false. This distinguishes "the predicate blocks
//       everything" from "the predicate blocks only `graded`", which (d) alone
//       cannot.
//   (f) NOT-SUBMITTED REFUSAL (EG-BE-008 settle half): calling settle for an attempt
//       that is not `submitted` raises `check_violation` — assert the SQLSTATE, not
//       the message text.
//   (g) SOURCE-TEXT SCAN (EG-BE-009): read `SOURCE/supabase/schema.sql`, isolate the
//       two function bodies, and assert neither contains `user_id` as a parameter
//       nor any of the five forbidden column names. Cheap, and it is the only
//       assertion that keeps a later "just add a user_id param" from compiling
//       past review.
describe.skipIf(!HAS_LIVE_DB)(
  "record_essay_grade() on real Postgres — array order and first-write-wins (SVC-1)",
  () => {
    let fx: EssayFixture;

    beforeAll(async () => {
      fx = await setUp(admin, "svc1", 3);
    });
    afterAll(async () => {
      await tearDown(admin, fx);
    });

    it("preserves the full questionId sequence when grading the second of three essays, restricts the write to one element and one column, and refuses a duplicate settle by returning false with the first band intact", async () => {
      const before = await readPerQuestion(admin, fx.attemptId);
      expect(before.map((r) => r.questionId)).toEqual(fx.questionIds);

      // ── (a) Cham cau THU HAI trong ba ─────────────────────────────────
      const { data: settled, error } = await admin.rpc("record_essay_grade", {
        p_attempt_id: fx.attemptId,
        p_question_id: fx.questionIds[1],
        p_state: "graded",
        p_earned: 0.75,
        p_max: 1,
        p_low_confidence: false,
      });
      expect(error).toBeNull();
      // `returns table (...)` ⇒ PostgREST tra ve MOT MANG.
      expect(Array.isArray(settled) ? settled[0].written : settled).toBe(true);

      const after = await readPerQuestion(admin, fx.attemptId);

      // ── (b) THU TU MANG giu nguyen. Day la mot trong ba tinh chat ma mot
      //        client bi mock KHONG the chung minh: ham SQL dung
      //        `jsonb_agg(... order by ord)` tren
      //        `jsonb_array_elements(...) with ordinality`, va neu ai do bo
      //        menh de `order by` thi Postgres duoc phep tra ve thu tu khac —
      //        cau hoi cua hoc sinh se doi cho tren man hinh.
      expect(after.map((r) => r.questionId)).toEqual(fx.questionIds);
      expect(after).toHaveLength(3);

      // ── (c) DUNG MOT phan tu bi doi, va trong phan tu do dung nhom khoa
      //        `essay*`. Hai phan tu kia phai GIONG TUNG BYTE.
      expect(after[0]).toEqual(before[0]);
      expect(after[2]).toEqual(before[2]);

      const target = after[1];
      expect(target.essayState).toBe("graded");
      expect(Number(target.essayEarned)).toBe(0.75);
      expect(Number(target.essayMax)).toBe(1);
      expect(target.essayLowConfidence).toBe(false);
      expect(target.essayGradedAt).toBeTruthy();
      // Cac truong KHONG thuoc nhom vong doi cua chinh phan tu ay khong duoc
      // dung toi: ham chi duoc ghi cot `per_question`, mot phan tu, nhom khoa.
      expect(target.selected).toBe(before[1].selected);
      expect(target.isCorrect).toBe(before[1].isCorrect);
      expect(target.scored).toBe(before[1].scored);

      // ── (d) GHI TRUNG BI TU CHOI — la mot GIA TRI TRA VE, khong phai mot
      //        exception (ADR-0018 Decision 3). Vi tu `<> 'graded'` khop ZERO
      //        dong, va band DAU TIEN o nguyen.
      const { data: dup, error: dupErr } = await admin.rpc("record_essay_grade", {
        p_attempt_id: fx.attemptId,
        p_question_id: fx.questionIds[1],
        p_state: "graded",
        p_earned: 0.25,
        p_max: 1,
        p_low_confidence: true,
      });
      expect(dupErr).toBeNull();
      expect(Array.isArray(dup) ? dup[0].written : dup).toBe(false);

      const afterDup = await readPerQuestion(admin, fx.attemptId);
      // Band cu THANG. Neu vi tu bi bo, gia tri o day se la 0.25 — tuc mot
      // luot chay thua vua ghi de diem that cua hoc sinh.
      expect(Number(afterDup[1].essayEarned)).toBe(0.75);
      expect(afterDup[1].essayLowConfidence).toBe(false);
      expect(afterDup.map((r) => r.questionId)).toEqual(fx.questionIds);
    });

    it("`failed` KHONG hap thu: mot cau `failed` van settle duoc thanh `graded` (EG-BE-007)", async () => {
      // `graded` la trang thai HAP THU, `failed` thi KHONG — day dung la thu
      // lam cho nut "cham lai" co nghia. Mot vi tu viet nham thanh
      // `essayState = 'pending'` se lam ca nay do.
      const qid = fx.questionIds[2];
      const failed = await admin.rpc("record_essay_grade", {
        p_attempt_id: fx.attemptId,
        p_question_id: qid,
        p_state: "failed",
        p_earned: null,
        p_max: null,
        p_low_confidence: false,
      });
      expect(Array.isArray(failed.data) ? failed.data[0].written : failed.data).toBe(true);

      const regraded = await admin.rpc("record_essay_grade", {
        p_attempt_id: fx.attemptId,
        p_question_id: qid,
        p_state: "graded",
        p_earned: 1,
        p_max: 1,
        p_low_confidence: false,
      });
      expect(Array.isArray(regraded.data) ? regraded.data[0].written : regraded.data).toBe(true);

      const rows = await readPerQuestion(admin, fx.attemptId);
      const row = rows.find((r) => r.questionId === qid);
      expect(row?.essayState).toBe("graded");
      expect(Number(row?.essayEarned)).toBe(1);
    });
  }
);

// =============================================================================
// SVC-2 — The retry cap is spent at CLAIM time: three claims that never settle
//         still exhaust it, and neither function is reachable by a student
// =============================================================================
// AC: EG-BE-010 — "When claim_essay_grading_attempt() succeeds, the element's
//   essayAttempts must increase by exactly 1, and must NEVER be decremented by any
//   statement in the repo."
// AC: EG-BE-011 — "When essayAttempts already equals ESSAY_MAX_ATTEMPTS,
//   claim_essay_grading_attempt() must return claimed = false, reason = 'exhausted'
//   and must not lead to any provider request."
// AC: EG-BE-012 — "When the element is graded, claim_essay_grading_attempt() must
//   return claimed = false, reason = 'already_graded'."
// AC: EG-BE-008 (claim half) — "If p_attempt_id points at an attempt that does not
//   exist or is not submitted, claim_essay_grading_attempt() must return one row
//   with claimed = false, reason = 'not_submitted'."
// AC: EG-BE-013 — "With a student's JWT, .rpc() to BOTH functions must return
//   42501, and a direct UPDATE public.exam_results must be refused at the
//   privilege layer."
// Also discharges: PRD AC-045, AC-063, AC-064; ADR-0018 D4 and its containment list;
//   backend DD Integration Verification Points EG-a, EG-b, EG-e.
// ROI: 63 (BV:9 x Freq:6 + Legal:0 + Defect:9)
//   BV 9 — the cap is the only thing standing between a systematically-failing
//     grade and an unbounded retry button on a single unmetered project budget
//     (PRD R-j). It is also a security boundary: these two functions are the first
//     writers ever allowed to mutate `exam_results` after insert.
//   Freq 6 — the cap is reached only on repeatedly failing questions, but the claim
//     path itself runs on every grading attempt of every essay.
//   Defect 9 — D4 is counter-intuitive by design. The natural implementation
//     increments the counter on the SETTLE write, which is correct-looking and
//     wrong exactly where it matters: by F3, an abandoned pass writes NOTHING, so a
//     settle-time counter never records the interrupted attempts, the stored count
//     stays below three, and the cap fails precisely in the failure mode
//     (a student watching a stuck "đang chấm" and clicking retry) that it exists
//     to handle.
//   SECOND SLOT: ROI 63 > 50, the service-lane threshold. Selected as the one
//   additional case beyond the reserved slot.
// Behavior: seed one submitted attempt with a pending essay at essayAttempts 0 ->
//   call claim three times as service_role, NEVER settling in between (simulating
//   three passes cut off by the platform) -> each returns claimed = true with an
//   incrementing count -> the fourth returns claimed = false, reason 'exhausted' ->
//   then prove neither function is callable by a student JWT.
// @category: service-integration-e2e
// @lane: service-integration-e2e
// @dependency: full-system (real Supabase dev Postgres, real service_role client,
//   two real authenticated student sessions)
// @complexity: high
// @real-dependency: real Postgres — nothing mocked
// Primary failure mode: the attempt counter is incremented by the SETTLE rather
//   than by the CLAIM, so three interrupted passes cost nothing, the fourth,
//   fifth and Nth claims all succeed, and each one reserves a fresh Groq budget
//   block for the shared, unmetered project budget. The security variant: the
//   functions are created without the `revoke ... from public, anon, authenticated`
//   half of the grant block (revoking from `public` alone leaves them callable by
//   students, per the §10b note on Supabase default privileges), so a student can
//   call the settle function directly and write their own band.
// Proof obligation — what the implemented test must assert:
//   (a) COUNTER MOVES ON CLAIM, WITHOUT ANY SETTLE: three consecutive claims with
//       NO settle between them return claimed = true and a returned count of 1, 2,
//       3 in order; read the row back after each and assert the STORED
//       `essayAttempts` equals the returned count. Asserting the return value alone
//       would pass for a function that computes the number and never persists it.
//   (b) FOURTH CLAIM REFUSED: claimed = false and reason === 'exhausted' exactly
//       (assert the literal reason string — 'exhausted', 'already_graded',
//       'not_submitted' are three different branches and a single generic refusal
//       collapses them), and the stored `essayAttempts` is STILL 3 — the refused
//       claim must not increment.
//   (c) CAP VALUE IS PINNED, NOT ASSUMED: the number of successful claims equals
//       `ESSAY_MAX_ATTEMPTS` imported from `lib/scoring/essayLifecycle.ts` (3), not
//       a literal 3 typed into this file. This is the one unavoidable double
//       declaration in the design (TS constant vs SQL literal, because ADR-0018
//       fixed the function's two-parameter signature); `verify:schema` carries the
//       pin gate, and this case must not become a third, independent copy.
//   (d) NO DECREMENT PATH (EG-BE-010, second half): scan `SOURCE/supabase/schema.sql`
//       and `SOURCE/lib/**` and assert no statement decrements `essayAttempts`. A
//       "refund on failure" is the change a future session will reach for first,
//       and it silently reopens the unbounded-retry hole.
//   (e) ALREADY-GRADED CLAIM: on an element in `graded`, claim returns
//       claimed = false, reason === 'already_graded', and `essayAttempts` does not
//       move (AC-063: a retry on a question that already has a band is a no-op).
//   (f) NOT-SUBMITTED CLAIM: on an attempt that is not `submitted`, claim returns
//       ONE ROW with claimed = false, reason === 'not_submitted' — a returned row,
//       not an empty result set and not a raise (the settle's not-submitted branch
//       raises `check_violation` instead; the asymmetry is deliberate and both
//       halves must be pinned, the settle half in SVC-1(f)).
//   (g) STUDENT JWT IS REFUSED ON BOTH (EG-BE-013): with a real authenticated
//       student session, `.rpc()` to `claim_essay_grading_attempt` and to
//       `record_essay_grade` each fail with code `42501`. DISTINGUISH THE CODES
//       explicitly, following the `MM-b` template (`test-rls.ts:1652-1671`):
//       `PGRST202` means the schema was never applied (precondition 2 failed, not a
//       security finding), and any other code means the `revoke` is missing or
//       partial. A case that asserts only "it failed" reports a green security
//       property on an unapplied database.
//   (h) OWNERSHIP IS DERIVED IN SQL: with `service_role` — the identity that CAN
//       call the functions — a claim naming student B's attempt still behaves
//       correctly with NO user_id passed, because there is no user_id parameter to
//       pass (SVC-1(g) proves the parameter's absence; this proves the function
//       still resolves ownership from the attempt row rather than trusting a
//       caller-supplied identity).
//       Note the direct-UPDATE half of EG-BE-013 is ALREADY covered by the shipped
//       `S-b` case (`test-rls.ts:1314-1320`); do not duplicate it here.
describe.skipIf(!HAS_LIVE_DB)(
  "claim_essay_grading_attempt() on real Postgres — claim-time cap and grants (SVC-2)",
  () => {
    let fx: EssayFixture;

    beforeAll(async () => {
      fx = await setUp(admin, "svc2", 3);
    });
    afterAll(async () => {
      await tearDown(admin, fx);
    });

    it("spends one of three attempts per claim even when no settle ever follows, and refuses the fourth with reason 'exhausted' without incrementing", async () => {
      const qid = fx.questionIds[0];

      // ── (a) BA luot claim, KHONG luot settle nao ────────────────────────
      //     Day la nua quan trong cua D4: luot duoc tieu luc CLAIM, khong phai
      //     luc settle. Mot invocation bi nen tang cat giua chung van tieu mot
      //     luot — va do la ly do UI-D9 quyet dinh KHONG hien so luot con lai.
      for (let i = 1; i <= ESSAY_MAX_ATTEMPTS; i += 1) {
        const { data, error } = await admin.rpc("claim_essay_grading_attempt", {
          p_attempt_id: fx.attemptId,
          p_question_id: qid,
        });
        expect(error).toBeNull();
        const row = Array.isArray(data) ? data[0] : data;
        expect(row.claimed).toBe(true);
        expect(row.attempts).toBe(i);
      }

      const afterThree = await readPerQuestion(admin, fx.attemptId);
      const spent = afterThree.find((r) => r.questionId === qid);
      expect(spent?.essayAttempts).toBe(ESSAY_MAX_ATTEMPTS);
      // Trang thai KHONG doi: claim chi tang bo dem, no khong ghi band.
      expect(spent?.essayState).toBe("pending");

      // ── (b) Luot THU TU bi tu choi, va bo dem KHONG tang them ───────────
      const { data: fourth, error: fourthErr } = await admin.rpc(
        "claim_essay_grading_attempt",
        { p_attempt_id: fx.attemptId, p_question_id: qid }
      );
      expect(fourthErr).toBeNull();
      const refused = Array.isArray(fourth) ? fourth[0] : fourth;
      expect(refused.claimed).toBe(false);
      expect(refused.reason).toBe("exhausted");

      const afterFour = await readPerQuestion(admin, fx.attemptId);
      // Neu bo dem van tang o luot bi tu choi, tran se troi xa dan sau moi lan
      // bam — mot hoc sinh khong bao gio duoc thu du ba lan.
      expect(afterFour.find((r) => r.questionId === qid)?.essayAttempts).toBe(
        ESSAY_MAX_ATTEMPTS
      );
    });

    it("phan biet `already_graded` voi `no_element`", async () => {
      const qid = fx.questionIds[1];
      await admin.rpc("record_essay_grade", {
        p_attempt_id: fx.attemptId,
        p_question_id: qid,
        p_state: "graded",
        p_earned: 1,
        p_max: 1,
        p_low_confidence: false,
      });

      const { data: graded } = await admin.rpc("claim_essay_grading_attempt", {
        p_attempt_id: fx.attemptId,
        p_question_id: qid,
      });
      const gradedRow = Array.isArray(graded) ? graded[0] : graded;
      expect(gradedRow.claimed).toBe(false);
      // AC-063: mot cau da co band KHONG duoc claim lai — neu duoc, mot luot
      // chay thua se ghi de diem that.
      expect(gradedRow.reason).toBe("already_graded");

      const { data: missing } = await admin.rpc("claim_essay_grading_attempt", {
        p_attempt_id: fx.attemptId,
        p_question_id: `${EG_PREFIX}svc2-khong-ton-tai`,
      });
      const missingRow = Array.isArray(missing) ? missing[0] : missing;
      expect(missingRow.claimed).toBe(false);
      expect(missingRow.reason).toBe("no_element");
    });

    it("tra 42501 cho JWT hoc sinh tren CA HAI ham — EXECUTE chi service_role", async () => {
      // Day la tinh chat thu ba ma mot client bi mock khong the chung minh:
      // GRANT that tren database that. Mot ban `revoke` chi go khoi `public`
      // se de ca hai ham VAN goi duoc bang JWT hoc sinh, va khong test mock nao
      // nhin thay dieu do.
      const claim = await fx.studentClient.rpc("claim_essay_grading_attempt", {
        p_attempt_id: fx.attemptId,
        p_question_id: fx.questionIds[0],
      });
      expect(claim.error?.code).toBe("42501");

      const settle = await fx.studentClient.rpc("record_essay_grade", {
        p_attempt_id: fx.attemptId,
        p_question_id: fx.questionIds[0],
        p_state: "graded",
        p_earned: 1,
        p_max: 1,
        p_low_confidence: false,
      });
      expect(settle.error?.code).toBe("42501");

      // Va KHONG dong nao bi doi boi hai luot goi bi tu choi ay.
      const rows = await readPerQuestion(admin, fx.attemptId);
      expect(rows.find((r) => r.questionId === fx.questionIds[0])?.essayState).toBe("pending");
    });
  }
);
