// exam_hot_counts() — Kho đề theo kệ [service-integration-e2e] Test Skeleton
// Design Doc: docs/design/exam-shelves-backend-design.md (v1.2, § The SQL objects
//               :210-296, § Test Boundaries and Placement :609-633 "test-rls.ts
//               Phần 10 — what proves the aggregate leaks no identities", row for
//               this exact file at :620)
// ADR:        docs/adr/ADR-0021-cross-user-hot-aggregate-and-attempt-source.md
//               (D1 aggregate shape + security argument, D6 what the DDL leaves
//               alone)
// PRD:        docs/prd/exam-shelves-prd.md (v1.2, AC-018, AC-025, AC-027, AC-028)
// Generated:  2026-09-18 | Budget used: service-integration-e2e 1/2 (1 reserved
//               slot; 2nd slot intentionally left unfilled — the backend DD names
//               no second service-e2e file for this feature, and no further
//               candidate here needs a live Postgres to be provable)
//
// =============================================================================
// FILE STATUS — read before editing
// =============================================================================
// IMPLEMENTED (P8-T4). All 6 proof obligations below are real `it` cases; the
// `describe` is wrapped in `describe.skipIf(!HAS_LIVE_DB)`, importing
// `HAS_LIVE_DB` from `./examHotCountsFixtures` (P8-T3) — the exact shape
// `exam-search.service.e2e.test.ts:31` already uses. `public.exam_hot_counts()`
// must exist on the target database (backend DD's Migration Procedure,
// schema.sql §20c) before this file is run; `HAS_LIVE_DB` only guards for
// missing credentials, never for the migration having landed — a red run on a
// database that has not received the DDL looks like a code defect and is not
// (`vitest.localdb.config.ts`'s own header states the schema-gate precondition
// in capital letters).
//
// HOW THIS LANE RUNS: `npm run test:localdb` (from `SOURCE/`), i.e.
// `vitest run --config vitest.localdb.config.ts`, which globs the WHOLE directory
// `tests/e2e/service/**/*.test.{ts,tsx}` with NO exclude list — every file here is
// collected unconditionally. This lane is MANUAL / opt-in — it is deliberately
// NOT part of `npm test` or the default CI gate (`vitest.localdb.config.ts`'s own
// header: "CHẠY TAY tại máy dev — cố ý tách khỏi npm test").
//
// FIXTURES MODULE: `SOURCE/tests/e2e/service/examHotCountsFixtures.ts` (P8-T3) —
// re-exports `HAS_LIVE_DB`/`adminClient`/`anonClient` from
// `essayGradeWriteFixtures.ts`, adds its own `serviceClient()`, the `HC_PREFIX`
// isolation prefix, and `setUp`/`tearDown`. `setUp` seeds two real users (A =
// always the RPC caller, never banned; B = submitter and the author who gets
// banned/unbanned) and four exams (`published`, `unpublished`, `bannedAuthor`,
// `hourBoundary`) with `exam_attempts` rows shaped for obligations (a)-(f) below
// — see that file's own header for exactly what each exam id proves and why A
// is never reused for the banned-author role.
//
// -----------------------------------------------------------------------------
// MOCK BOUNDARY — the opposite of every other lane in this generation round
// -----------------------------------------------------------------------------
// NOTHING IS MOCKED. Backend DD Test Boundaries states this as a hard rule, not a
// preference: "the function's behaviour, grants, predicates and RLS isolation are
// never mocked — only real Postgres proves that a definer function counts another
// user's rows, that anon is refused, or that a grant landed." Every assertion
// below runs against the real dev Postgres instance (ref `hynwleaxtbtjzkvpjsug`),
// through real `SupabaseClient`s carrying real JWTs for two real seeded users.
// @real-dependency: Postgres (dev), `exam_attempts`, `exams`, `exam_hot_counts()`
//   and its grants/revokes — none of this is mocked; that is the entire point of
//   this lane existing separately from `shelves.int.test.ts`.
//
// -----------------------------------------------------------------------------
// WHY THIS IS THE RESERVED SLOT, NOT an ROI>50 opportunistic pick
// -----------------------------------------------------------------------------
// Per the reserved-slot rule: a service-integration-e2e slot is reserved when the
// journey's correctness depends on real cross-service/cross-boundary behaviour
// that fixture-e2e (mocked backend) cannot verify. A `security definer` function
// crossing another user's `exam_attempts` RLS boundary is EXACTLY that class of
// claim — a mocked `{ from, rpc }` client can assert "the code calls rpc() with
// these arguments" but can never prove that the object it calls (a) actually
// bypasses RLS, (b) actually excludes `anon`, or (c) actually excludes an
// unpublished/banned-author exam once real Postgres evaluates its predicates.
// ROI: 110 (BV:10 x Freq:10 + Legal:0 + Defect:10)
//   BV 10 — a leak here is a real privacy incident (another student's identity or
//     activity crossing a boundary the PRD/ADR both state must stay aggregate-only),
//     not a UX regression.
//   Freq 10 — this ONE RPC underlies every hot-shelf render, every ?sort=hot flat
//     grid, and every home-block render, for every signed-in user — the highest
//     call frequency of any new surface this feature adds.
//   Defect 10 — maximal: no lane other than this one and the manual `test-rls.ts`
//     suite can detect an RLS-bypass or grant defect at all; a mocked test cannot
//     fail this way even when the real function is broken.
// Behavior: two real, distinct, seeded student users (A, B) exist on dev, each
//   with their own `exam_attempts` rows -> A's authenticated client calls
//   `exam_hot_counts(...)` -> the returned row for an exam ONLY B submitted has
//   `total_count >= 1`, proving the aggregate crosses users through a real JWT ->
//   the returned row's key set is exactly the four declared columns, proving no
//   identity/timestamp/score column leaked -> rows for an in_progress attempt, an
//   unpublished exam and a banned author's exam are each absent -> the window
//   boundaries snap to the HOUR server-side, not to the caller's raw argument ->
//   `p_max_rows` clamps against the imported `LIST_ROW_CEILING`/`POSTGREST_MAX_ROWS`
//   constants, not hand-copied literals -> anon gets 42501; service_role gets an
//   array.
// @category: core-functionality
// @lane: service-integration-e2e
// @dependency: full-system (real dev Postgres, real Supabase Auth, real RLS,
//   `public.exam_hot_counts()`) + `examHotCountsFixtures.ts`
// @complexity: high
// @real-dependency: Postgres (dev, ref hynwleaxtbtjzkvpjsug), exam_attempts, exams,
//   exam_hot_counts() — see Mock Boundary above; nothing in this file may be mocked
// Primary failure mode: the function is deployed without `security definer` (or the
//   grant to `authenticated` is missing/misconfigured), so A's call to
//   `exam_hot_counts` returns 0 rows / a permission error instead of counting B's
//   real submission — the exact failure the backend DD's own Verification Strategy
//   names as "the single assumption the whole feature rests on...checkable in one
//   query", now automated instead of only checked once by hand on dev. The second,
//   subtler failure mode: the returned row carries an extra column (e.g. a
//   `submitted_at` or `user_id` the `returns table` signature was widened to
//   include by mistake) — HS-c is written precisely because "asserting values alone
//   would pass while a column leaked."
// Proof obligation — what the implemented test must assert:
//   (a) HS-b (cross-user proof): with only user B having a submitted attempt on a
//       given exam, user A's authenticated `.rpc("exam_hot_counts", {...})` call
//       returns a row for that exam id with `total_count >= 1` — a mocked client
//       could never fail this way even when the real grant is broken, which is the
//       entire justification for this lane existing;
//   (b) HS-c (the leak proof): for at least one returned row,
//       `Object.keys(row).sort()` is exactly
//       `["exam_id", "recent_count", "total_count", "wide_count"]` — no `user_id`,
//       `submitted_at`, `id` or `total_score` — assert the KEY SET, not just that
//       expected values are present, per the backend DD's own explicit warning;
//   (c) an `in_progress` (not `submitted`) attempt contributes 0 to every count for
//       its exam; an exam whose `exams.status <> 'published'` is absent from the
//       result set entirely, even though it has qualifying submitted attempts; an
//       exam whose author is banned (`auth.admin.updateUserById(..., {
//       ban_duration })`) is absent, then present again once the ban is lifted
//       (mirrors `test-rls.ts` HS-d/HS-f, automated here for CI-adjacent coverage);
//   (d) HOUR-SNAPPED WINDOW BOUNDARIES: seed one attempt 1 second before
//       `date_trunc('hour', p_since_recent)` and one attempt 1 second after it —
//       assert the first is EXCLUDED from `recent_count` and the second is
//       INCLUDED, proving the boundary snaps server-side to the hour of the
//       caller-supplied argument, not to the raw argument itself (the mechanism
//       that stops a JWT holder from bisecting the time axis to localise another
//       student's submission to the second);
//   (e) `p_max_rows` clamp is asserted against the IMPORTED `LIST_ROW_CEILING` /
//       `POSTGREST_MAX_ROWS` constants from `@/lib/supabase/boundedRead`, not
//       against hand-copied literals (501/1000) — a change on either side of that
//       equality must turn this obligation red, per the backend DD's own
//       instruction ("the service e2e clamp case asserts against the imported
//       constants...so a change on either side turns that case red instead of
//       drifting");
//   (f) GRANT BOUNDARY: an anonymous client's call to `exam_hot_counts` resolves
//       with `error.code === "42501"`; a `service_role` client's call resolves with
//       an array and no error (mirrors HS-e).

import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { LIST_ROW_CEILING, POSTGREST_MAX_ROWS } from "@/lib/supabase/boundedRead";
import {
  anonClient,
  HAS_LIVE_DB,
  HC_PREFIX,
  serviceClient,
  setUp,
  tearDown,
  type HotCountsFixture,
} from "./examHotCountsFixtures";

const SLOT = "hc1";

describe.skipIf(!HAS_LIVE_DB)(
  "exam_hot_counts() — real Postgres dev: cross-user count, leak-proof column set, exclusion predicates, hour-snapped windows, row-cap clamp, grant boundary (AC-018, AC-025, AC-027, AC-028)",
  () => {
    const admin = serviceClient();
    let fx: HotCountsFixture | undefined;

    beforeAll(async () => {
      fx = await setUp(admin, SLOT);
    }, 60_000);

    afterAll(async () => {
      await tearDown(admin, fx, SLOT);
    }, 60_000);

    /** Hình dạng một hàng `exam_hot_counts()` trả — khai LOCAL, không import từ
     *  `hotCounts.ts` (không export ở đó): obligation (b) cần đọc tập khoá THẬT
     *  của hàng trả về, nên file này không được áp một hình dạng lên nó trước. */
    type HotCountsRow = {
      exam_id: string;
      recent_count: number | string | null;
      wide_count: number | string | null;
      total_count: number | string | null;
    };

    /** Điểm gọi RPC DÙNG CHUNG cho cả sáu obligation — cùng lý do `hotCounts.ts`
     *  giữ một điểm gọi duy nhất: đối số mặc định (`hourBoundaryArgs` của fixture,
     *  `p_max_rows: 500`) không tự nó chứng minh gì, `overrides` mới là nơi từng
     *  ca nói ra đúng đối số đang kiểm. */
    async function callHotCounts(
      client: SupabaseClient,
      overrides: Partial<{ p_since_recent: string; p_since_wide: string; p_max_rows: number }> = {}
    ): Promise<{ data: HotCountsRow[] | null; error: { code?: string; message: string } | null }> {
      const { data, error } = await client.rpc("exam_hot_counts", {
        p_since_recent: fx!.hourBoundaryArgs.sinceRecent,
        p_since_wide: fx!.hourBoundaryArgs.sinceWide,
        p_max_rows: 500,
        ...overrides,
      });
      return { data: data as HotCountsRow[] | null, error };
    }

    it("user A's authenticated call counts an exam only user B submitted (HS-b, obligation a)", async () => {
      const { data, error } = await callHotCounts(fx!.userA.client);
      expect(error).toBeNull();
      const row = data!.find((r) => r.exam_id === fx!.examIds.published);
      expect(row).toBeDefined();
      expect(Number(row!.total_count)).toBeGreaterThanOrEqual(1);
    });

    it(
      "a returned row's key set is exactly {exam_id, recent_count, wide_count, total_count} — no user_id/submitted_at/id/total_score (HS-c, obligation b)",
      async () => {
        const { data, error } = await callHotCounts(fx!.userA.client);
        expect(error).toBeNull();
        const row = data!.find((r) => r.exam_id === fx!.examIds.published);
        expect(row).toBeDefined();
        expect(Object.keys(row!).sort()).toEqual(["exam_id", "recent_count", "total_count", "wide_count"]);
      }
    );

    it(
      "in_progress attempts, unpublished exams and banned-author exams are excluded; a banned author's exam reappears once the ban is lifted (HS-d/HS-f, obligation c)",
      async () => {
        const before = await callHotCounts(fx!.userA.client);
        expect(before.error).toBeNull();

        // published: chỉ attempt SUBMITTED của B được cộng — attempt in_progress
        // của A trên CHÍNH đề này không được cộng vào total_count.
        const publishedRow = before.data!.find((r) => r.exam_id === fx!.examIds.published);
        expect(publishedRow).toBeDefined();
        expect(Number(publishedRow!.total_count)).toBe(1);

        // unpublished (status='draft'): vắng mặt dù B đã nộp một attempt hợp lệ.
        expect(before.data!.some((r) => r.exam_id === fx!.examIds.unpublished)).toBe(false);

        // bannedAuthor: có mặt TRƯỚC khi ban.
        expect(before.data!.some((r) => r.exam_id === fx!.examIds.bannedAuthor)).toBe(true);

        const { error: banErr } = await admin.auth.admin.updateUserById(fx!.userB.userId, {
          ban_duration: "24h",
        });
        expect(banErr).toBeNull();

        const during = await callHotCounts(fx!.userA.client);
        expect(during.error).toBeNull();
        expect(during.data!.some((r) => r.exam_id === fx!.examIds.bannedAuthor)).toBe(false);

        const { error: unbanErr } = await admin.auth.admin.updateUserById(fx!.userB.userId, {
          ban_duration: "none",
        });
        expect(unbanErr).toBeNull();

        const after = await callHotCounts(fx!.userA.client);
        expect(after.error).toBeNull();
        expect(after.data!.some((r) => r.exam_id === fx!.examIds.bannedAuthor)).toBe(true);
      },
      30_000
    );

    it(
      "window boundaries snap to the HOUR server-side: an attempt 1s before date_trunc('hour', p_since_recent) is excluded, 1s after is included (obligation d)",
      async () => {
        const { data, error } = await callHotCounts(fx!.userA.client);
        expect(error).toBeNull();
        const row = data!.find((r) => r.exam_id === fx!.examIds.hourBoundary);
        expect(row).toBeDefined();
        // recent_count chỉ đếm attempt gieo 1s SAU mốc chẵn giờ đã date_trunc — cái
        // gieo 1s TRƯỚC mốc đó bị loại. Nếu server dùng thẳng đối số thô (lệch 37
        // phút so với mốc chẵn) thay vì date_trunc('hour', ...), CẢ HAI attempt đều
        // rơi trước ngưỡng thô đó và recent_count sẽ đọc 0, không phải 1.
        expect(Number(row!.recent_count)).toBe(1);
        expect(Number(row!.total_count)).toBe(2);
      }
    );

    it(
      "p_max_rows clamps against the imported LIST_ROW_CEILING/POSTGREST_MAX_ROWS constants, not hand-copied literals (obligation e)",
      async () => {
        // Gieo NHIỀU HƠN LIST_ROW_CEILING đề ứng viên thật (published, có attempt
        // submitted) để trần thật sự phải cắt bớt — không thì phép thử này rỗng.
        const clampCount = LIST_ROW_CEILING + 20;
        const clampExamIds = Array.from({ length: clampCount }, (_, i) => `${HC_PREFIX}${SLOT}-clamp-${i}`);
        const clampExams = clampExamIds.map((id) => ({
          id,
          title: `${HC_PREFIX}${SLOT} clamp exam`,
          question_ids: [] as string[],
          duration_minutes: 30,
          subject: "Toán",
          grade: 10,
          status: "published",
        }));
        const { error: examErr } = await admin.from("exams").insert(clampExams);
        expect(examErr).toBeNull();

        const clampAttempts = clampExamIds.map((examId) => ({
          user_id: fx!.userB.userId,
          exam_id: examId,
          status: "submitted",
          submitted_at: new Date().toISOString(),
        }));
        const { error: attemptErr } = await admin.from("exam_attempts").insert(clampAttempts);
        expect(attemptErr).toBeNull();
        // `${HC_PREFIX}${SLOT}-clamp-*` khớp đúng tiền tố `tearDownBySlot` đã dọn
        // (`${HC_PREFIX}${slot}-%`) — không cần dọn riêng ở đây.

        // "Trước": một lượt đọc KHÔNG bị cắt (p_max_rows dưới POSTGREST_MAX_ROWS,
        // nhưng vượt xa số ứng viên vừa gieo) chứng minh tập ứng viên thật trên dev
        // đã VƯỢT LIST_ROW_CEILING — tiền đề khiến phép cắt dưới đây có ý nghĩa để
        // quan sát, không rỗng.
        const unclamped = await callHotCounts(fx!.userA.client, { p_max_rows: 999 });
        expect(unclamped.error).toBeNull();
        expect(unclamped.data!.length).toBeGreaterThan(LIST_ROW_CEILING);

        // "Sau": đúng hình dạng lời gọi thật (`hotCounts.ts`'s
        // `p_max_rows: LIST_ROW_CEILING + 1`) bị cắt ở
        // min(LIST_ROW_CEILING + 1, POSTGREST_MAX_ROWS) — TÍNH từ hai hằng số NHẬP,
        // không chép tay, nên một lần chỉnh lại của một trong hai hằng kéo theo kỳ
        // vọng này thay vì để nó trôi lệch.
        const clamped = await callHotCounts(fx!.userA.client, { p_max_rows: LIST_ROW_CEILING + 1 });
        expect(clamped.error).toBeNull();
        expect(clamped.data!.length).toBe(Math.min(LIST_ROW_CEILING + 1, POSTGREST_MAX_ROWS));
      },
      30_000
    );

    it("anon gets 42501; service_role gets an array (HS-e, obligation f)", async () => {
      const anonResult = await callHotCounts(anonClient());
      expect(anonResult.error?.code).toBe("42501");

      const serviceResult = await callHotCounts(serviceClient());
      expect(serviceResult.error).toBeNull();
      expect(Array.isArray(serviceResult.data)).toBe(true);
    });
  }
);
