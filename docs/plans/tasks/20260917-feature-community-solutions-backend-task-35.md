# Task 35: `test-rls.ts` — the test task of migration 32 (admin RPC groups, report RPC groups, admin queue, `i_reported`, admin notes)

Metadata:
- **Layer**: backend → routed to `task-executor` + `quality-fixer`
- **Plan task**: P4-T4
- **Phase**: 4
- **Plan section**: `docs/plans/20260917-feature-community-solutions.md` (§ P4-T4)
- **Dependencies**: task 32 (P4-T1); dev `admin_users` seed from task 03
- **Provides**: real-DB proof of every object migration task 32 created — the admin gate, the reason/transition rules, the hard-delete cascade + log, the admin queue's membership and anonymity flags, the admin notes shape, both report RPCs, and the per-caller `i_reported`
- **Size**: Small (1 file)

## U1 — resolved (engineer decision 2026-09-17, backend DD v1.2; no gate remains)

Report writes go through `report_community_solution` / `report_community_comment`; `community_content_reports` has RLS enabled, every privilege revoked, **no policy and no grant**. The v1.1 policy `community_reports_insert_own` is gone from the design and was never applied to any database, so this task writes **RPC groups, not policy groups** (backend DD v1.9 § Test Boundaries "User-write RPC groups"). Never weaken a success group into a refusal expectation, and never add a grant or policy to make one pass.

## Implementation Content

This is **the test task of migration 32** (backend DD v1.9 § Integration Verification Points, binding "Task ownership" — which also places the `i_reported` case, the admin-notes case and **every** admin-queue case here). Every refusal case asserts `isAuthorizationDenial(error)` (or the pinned `22023`/`P0002`) and unchanged rows, re-read through the harness setup client.

In `SOURCE/supabase/test-rls.ts`:

- **Admin group** — one refusal (non-admin session B → `42501 <function>: not an admin`, no row and no log row changed) and one success (the dev-seeded admin session from task 03) for each of `admin_list_community_reports`, `admin_get_community_solution_notes`, `admin_moderate_community_solution`, `admin_moderate_community_comment`. Plus:
  - `admin_moderate_community_solution`: a **non-admin call with an empty reason** → `42501 … not an admin` (the admin gate runs first); `'hide'`/`'delete'` with an empty, blank or `null` reason → `22023 admin_moderate_community_solution: reason required`, no row changed; `'hide'`, `'restore'` and `'delete'` on a **draft** solution, `'hide'` on a hidden one, `'restore'` on a published one → `22023 … invalid transition`, no row and no log row changed; an invalid action (e.g. `p_action='purge'`) → `22023`, no row, no log row; `'hide'` with a reason on a published solution that has Helpful rows, a visible comment and the pin, then a **reason-less `'restore'`** → `status = 'published'` with the same `helpful_count`, `comment_count` and `is_pinned` as before the hide; `'delete'` on a published **and** on a hidden solution → `deleted`; **exactly one** `community_moderation_log` row with `target_type = 'solution'` per accepted call.
  - `admin_moderate_community_comment`: the same reason / transition / invalid-action cases for the comment state machine; one log row per accepted call with `target_type = 'comment'`, the commenter as `target_user_id` and the solution's exam as `exam_id`; after `'delete'` the comment's `community_content_reports` rows are gone and the log row remains.
  - The `admin_moderate_community_solution('delete')` success case asserts **AC-084** on real DB: the solution row and every dependent note/helpful/comment/report row are gone, and exactly one `community_moderation_log` row exists for it with non-null `exam_id` and `target_user_id`.
  - **SN-1 (work plan § Open Items, resolved 2026-09-20)**: tasks 05, 16 and 27 set their hidden fixtures up with the harness setup client because the admin RPCs did not exist yet. **This task re-runs those hidden cases through the real admin RPCs** — hide a solution then confirm `save_community_solution` refuses it with `42501` and no DETAIL (task 05's case), and hide a comment then confirm the detail read and `delete_community_comment` behave exactly as tasks 16 and 27 asserted against the setup-client fixture.
- **`report_community_solution` / `report_community_comment` groups** — refusals, each `42501` with zero rows: (a) own content; (b) a caller with no submitted attempt; (c) a `draft` solution / a comment under a draft solution; (d) `anon`; (e) **table closure** — a direct `.from("community_content_reports").insert(...)` by an eligible reporter is an authorization denial and creates zero rows; (f) AC-004 — the exam is now `draft`; (g) AC-004 — the exam author is now banned. Success: `[{ already_reported: false }]` and one row; the same call again → `[{ already_reported: true }]`, still one row (AC-074, AC-076, M4).
- **`i_reported` arrives from the read** — on a published solution of writer W with one visible comment by reader Q: reader R reads `community_solution_detail` and gets `i_reported = false` on the header and on Q's comment; after `report_community_solution(<solution>, 'x')` the header reads `true` and Q's comment still `false`; after `report_community_comment(<Q's comment>, 'y')` both read `true`; a third user T, who reported nothing, reads `false` on both; W reads `false` on their own header. **Every assertion is made with no write by the reading caller in between** — the flag is per caller, never a global "has been reported" signal (AC-073–AC-076).
- **Admin notes shape** — on a solution with notes at exam positions 1 and 3 and none at 2, `admin_get_community_solution_notes` returns exactly 2 rows; their keys equal exactly `{question_number, question_id, body}` (set equality both ways); the `question_number` values are `[1, 3]` **in that order**; each `question_id` is the exam's id at that position and each `body` the note's raw text. The admin need not have submitted that exam. A non-admin caller → `42501 admin_get_community_solution_notes: not an admin` (Reference Contract Value #16).
- **Admin queue hidden comments** — on a published solution with one reported visible comment and one comment reported by two readers, the admin hides the second with reason `'spam'`: `admin_list_community_reports()` still returns the solution's row in "Chờ xử lý", with the same row-level `report_count` and the first comment still in `reported_comments`; the hidden comment appears **once** in `hidden_comments` with its `id`, a `question_number` matching the exam's current order, `body`, the commenter's **real** `commenter_display_name`, `hidden_reason = 'spam'`, a `hidden_at` equal to the `created_at` of its `'hide'` log row, and `report_count = 2`. After a `'restore'` and a second `'hide'` with reason `'abuse'` the entry carries `'abuse'` and the newer `hidden_at`. With the first comment's report deleted, so the only open report is on the hidden comment, the row is still returned with its subsection. `'restore'` moves the entry back to the visible list with its reports; `'delete'` removes the entry and its reports. Removing the hidden comment's question from `exams.question_ids` leaves the entry in place with `question_number = null` and every other field unchanged (AC-047, AC-081, AC-107, AC-108, R17, S5, S19).
- **A hidden solution stays in the queue (Reference Contract Value #26)** — on a published solution whose ONLY open report is on one of its comments, the admin hides the solution and then hard-deletes that comment (its report cascades away): the solution's row is **still** returned, in "Đã ẩn", with `report_count = 0` and one fewer `hidden_comments` entry, so "Khôi phục" still has a row (AC-082). `'restore'` returns it to `published`, and the row returns to "Chờ xử lý" only if a report of either kind remains — with none left it leaves the queue, with one left it stays. Also required: a hidden solution that **never had any report** is a row in "Đã ẩn" from the moment it is hidden and leaves the queue only on `'restore'` (to "Chờ xử lý" if a report remains, out of the queue if none does) or `'delete'` (R17, AC-081, AC-082, AC-108, AC-109).
- **The commenter and author anonymity flags** — a comment posted with `p_is_anonymous => true` and then hidden appears in `hidden_comments` with the commenter's REAL `commenter_display_name` **and** `commenter_is_anonymous_to_readers = true`; a second comment posted with `p_is_anonymous => false` and hidden the same way carries the same real name with the flag `false`. The row's own `author_is_anonymous_to_readers` is `not cs.show_profile` in the same read — `true` for a `show_profile = false` solution, `false` otherwise — with `author_display_name` the writer's real name in **both** cases (AC-081, S5).
- **Name-resolution regression** — `admin_moderate_community_solution` (`'hide'`, `'restore'`, `'delete'`), `admin_moderate_community_comment` (`'hide'`, `'restore'`, `'delete'`), `report_community_solution` and `report_community_comment` run their success paths with no `42702`.

## Acceptance Criteria

From the plan (§ P4-T4): **AC-017, AC-073–AC-076, AC-081, AC-082, AC-084, AC-085, AC-106–AC-109, R17, S5, S19, M4; Reference Contract Values #16, #26**.

Carried hard constraints that apply to this task:
- **TD-029 (explicit acceptance criterion)**: this task performs zero writes to and zero reads through `SOURCE/lib/supabase/service-role.ts` — the admin session used here is a plain Supabase Auth session, not the service-role client (the harness's existing setup client is used only for fixture setup, as in existing cases).
- The test re-verifies the **mechanism**, not `ADMIN_USER_IDS`/`admin_users` membership drift (an operational risk named in ADR-0021, mitigated by task 52's deploy step).
- `npm run verify:schema` green on dev first.

## Target Files
- [x] `SOURCE/supabase/test-rls.ts`

## Investigation Targets
- `SOURCE/supabase/test-rls.ts` (Phần 5 M-a–M-d moderation groups; tasks 05/16/27 groups; `ensureUser`/`signInAs`)
- `SOURCE/supabase/schema.sql` (task 32's six functions; the `community_content_reports` table block from task 13 — RLS on, zero policies, zero grants)
- `SOURCE/lib/auth/admin.ts` (dev admin id used by the seeded admin session)
- `SOURCE/lib/supabase/service-role.ts` (confirm this task imports nothing from it)
- `docs/design/community-solutions-backend-design.md` (§ Integration Verification Points — the `test-rls.ts` admin group (its `admin_moderate_community_comment` v1.4 and `admin_moderate_community_solution` v1.5 reason/transition cases) and every case marked "(test task 35; migration task 32)": "Admin queue hidden comments", "A hidden solution stays in the queue", "The commenter anonymity flag on a hidden comment", "`i_reported` arrives from the read", "Admin notes shape", "Name-resolution regression")
- `docs/design/community-solutions-backend-design.md` (§ Test Boundaries — "User-write RPC groups": the `report_community_solution` and `report_community_comment` rows, incl. the table-closure case (e) and the AC-004 cases (f)/(g))
- `docs/plans/20260917-feature-community-solutions.md` (§ Open Items — SN-1: this task re-runs tasks 05/16/27's hidden cases through the real admin RPCs; § Reference Contract Values #16, #26)
- `docs/design/community-solutions-backend-design.md` (§ Data Contracts — Admin RPCs contract: single transaction, capture-before-delete, one log row per call; Queue row condition, Queue row columns, Entry condition, Hidden-comment columns)
- `docs/adr/ADR-0021-community-solutions-data-model-anonymity-and-admin-moderation.md` (§ Known Unknowns — `admin_users`/`ADMIN_USER_IDS` drift)
- `docs/adr/ADR-0021-community-solutions-data-model-anonymity-and-admin-moderation.md` (§ Implementation Guidance)
- `docs/prd/community-solutions-prd.md` (AC-074, AC-084, AC-085)

## Binding Decisions

| Source | Axis | Decision | Compliance Check |
|---|---|---|---|
| `docs/adr/ADR-0021-community-solutions-data-model-anonymity-and-admin-moderation.md` (§ Implementation Guidance) | dependency_direction | Do not add, rename, or widen the write-target set of any function in `service-role.ts` for this feature, under any framing | No test case in this task calls a function exported from `SOURCE/lib/supabase/service-role.ts`, and `git diff --stat SOURCE/lib/supabase/service-role.ts` is empty |

## Reference Contracts

(Contract Type is derived during decomposition — the work plan's Reference Contract Values table has no Contract Type column.)

| Source | Contract Type | Required Observable Value | Compliance Check |
|---|---|---|---|
| `docs/design/community-solutions-backend-design.md` (§ Integration Verification Points "Admin notes shape"; work plan Reference Contract Value #16) | structure-order | "their keys equal exactly `{question_number, question_id, body}` (set equality both ways); the `question_number` values are `[1, 3]` in that order" | The admin-notes case asserts key set equality in both directions and the `[1, 3]` order on a solution with no note at position 2 |
| `docs/design/community-solutions-backend-design.md` (§ Data Contracts Admin RPCs "Queue row condition"; work plan Reference Contract Value #26) | state-lifecycle-negative | "a hidden solution is a row for as long as it is hidden, whatever its report count" | The queue-membership case hides a solution, hard-deletes the comment carrying its last open report, and still finds the row in "Đã ẩn" with `report_count = 0` |

## Investigation Notes
(Append observations here before implementation begins. Record each Binding Decision / Reference Contract Compliance Check result.)

### Pre-implementation (2026-09-26)

- **Baseline**: `npm run verify:schema` first run → 2 FAIL (TD-016 `subject` residue `rls-cs16-exam-q*`, `rls-rating-*`, `rls-ugc-*` — leftover fixtures of an earlier crashed `test-rls.ts` run, not schema drift; fingerprint `cb08928767f8` matched). One full `test-rls.ts` run cleaned them → `verify:schema` re-run fully green. Baseline `test-rls.ts`: 217 ✓, 4 ✗ = `R-p/R-r/R-t/R-u` (Rating) — the known pre-existing, out-of-scope failures recorded in the Phase 2/3 completion notes (`INITIAL_RATING_SCORES = {5,6,7}` violates `ratings_scores_range_check` 1..5); every Community Solutions case green.
- **`SOURCE/supabase/test-rls.ts`**: `main()` builds one service-role *setup client* (`admin`) for fixtures + re-reads, signs A/B/C in with `signInAs` (anon key + password); `isAuthorizationDenial()` accepts `42501`/RLS messages only. Phần 10/11/12 (tasks 05/16/27) each wrap in `{ }` with prefixed exam ids and idempotent `cleanup*` before/after. SN-1 fixtures: Phần 10 hides `csSolutionId` by setup-client update + hand-inserted `'hide'` log row, then asserts `save_community_solution` → `42501` with no DETAIL; Phần 11 hides `SOL_HELPFUL` (S7 own-preview: every `comment_count` null, `comments` empty; other reader 0 rows; restore → counts back) and comment B (`'spam'`, author reads `is_hidden_by_admin=true`; writer/third reader `comment_count=2`, no row; a 2nd hand-inserted `'abuse'` log → `hidden_reason='abuse'`) — note task 16 had no `'restore'` between the two hides because no RPC existed; Phần 12 sets the writer's own comment `hidden` by hand and asserts `delete_community_comment` → `42501`, status still `hidden`.
- **`schema.sql` §23 (task 32)**: `report_community_solution(p_solution_id, p_reason)` / `report_community_comment(p_comment_id, p_reason)` → `returns table (already_reported boolean)`; one `not exists` eligibility (published solution, not own, exam published + author not banned, caller submitted) → `42501 '<fn>: not eligible'`; `insert … on conflict … do nothing`, `already_reported = (row_count = 0)`. `admin_moderate_community_solution/_comment(id, action, reason)` → `returns table (status text)`; order: `is_admin_user()` → `42501 not an admin`; action ∉ {hide,restore,delete} → `22023 invalid action`; hide/delete with `btrim(coalesce(reason,''))=''` → `22023 reason required`; missing target → `P0002`; transition (solution: hide←published, restore←hidden, delete←published|hidden; comment: hide←visible, restore←hidden, delete←any) → `22023 invalid transition`; exam_id/author captured into variables BEFORE the update/delete; one `community_moderation_log` insert per accepted call (`reason = nullif(btrim(p_reason),'')`). `admin_list_community_reports()` → 10 columns; row condition `status='hidden' OR (published AND ≥1 report on the solution or on ANY of its comments)`; `report_count` = solution-level reports only; `reported_comments` = visible comments with ≥1 report; `hidden_comments` = every hidden comment with `hidden_reason`/`hidden_at` from the newest `'hide'` log row, `question_number = array_position(e.question_ids, …)` (null when removed), real `commenter_display_name`, `commenter_is_anonymous_to_readers = c.is_anonymous`; `author_is_anonymous_to_readers = not cs.show_profile`, `author_display_name` real. `admin_get_community_solution_notes(p_solution_id)` → `(question_number int, question_id text, body text)`, only notes of current questions, ordered by position, no submitted-attempt gate. `community_content_reports`: RLS on, `revoke all`, zero policies, zero grants (task 13 block, unchanged).
- **`community_solution_detail`**: header `i_reported = exists(report by auth.uid() on the solution)`, each comment `i_reported = exists(report by auth.uid() on the comment)` — per caller by construction.
- **`SOURCE/lib/auth/admin.ts`**: admin = id in env `ADMIN_USER_IDS` (server-only; cannot be imported by the tsx script). Task 03 seeded dev `admin_users` with the single dev `ADMIN_USER_IDS` id. The harness therefore reads `ADMIN_USER_IDS` from the same `.env.local` it already loads, intersects it with `admin_users` (setup-client read), and obtains a **plain Supabase Auth session** for that user: the setup client's Auth Admin API mints a magic-link token (`generateLink`, sends no email, changes no password), and a fresh anon-key client exchanges it with `verifyOtp` → an `authenticated` JWT whose `auth.uid()` is the seeded admin. RPCs are then called on that session client exactly like A/B/C. If no seeded id is found the run stops with "re-run task 03's seed" (task § Failure response).
- **`SOURCE/lib/supabase/service-role.ts`**: not imported by `test-rls.ts` (it creates its own clients from `@supabase/supabase-js`); this task adds no import of it.
- **DD § Integration Verification Points / § Test Boundaries / § Data Contracts, work plan SN-1 / RCV #16 / #26, ADR-0021 § Known Unknowns + § Implementation Guidance, PRD AC-074/084/085**: read; cases mapped 1:1 to the groups below. Membership drift (`admin_users` vs `ADMIN_USER_IDS`) is operational (task 52), not tested here.
- **Fixture plan**: three new prefixed exams (`rls-cs35-report`, `rls-cs35-mod`, `rls-cs35-queue`), 3 questions each, author A, submitted attempts for A/B/C/D; a fourth persistent test user D (`+rlstestd`, same convention as C) is needed because the `i_reported` case requires four distinct non-admin users (W, Q, R, T). The admin has no attempt on any fixture exam (proves AC-081 "need not have submitted").

### Binding Decision Check (pre-implementation)

| Axis | Planned approach | Compliance Check | Result |
|---|---|---|---|
| dependency_direction | Admin calls go through a signed-in anon-key session client; `service-role.ts` is neither imported nor edited | No test case calls a `service-role.ts` export; `git diff --stat SOURCE/lib/supabase/service-role.ts` empty | Y (planned) |

### Reference Contract Check (pre-implementation)

| Row | Planned approach | Result |
|---|---|---|
| RCV #16 admin notes shape | Solution with notes at positions 1 and 3 only; assert 2 rows, `Object.keys` sorted-equal `{body, question_id, question_number}` for every row (both directions via exact sorted array equality), `question_number` array `[1,3]` in returned order | Y (planned) |
| RCV #26 hidden solution stays in queue | Solution whose only open report is on its (admin-hidden) comment; admin hides the solution, hard-deletes that comment; assert row still returned with `status='hidden'`, `report_count=0`, `hidden_comments` one shorter | Y (planned) |

### Implementation (2026-09-26) — `test-rls.ts` Phần 13

- **Where**: new file-level constants `CS35_*_EXAM_ID`, `EMAIL_D`, `cleanupCs35Fixtures()`, `signInAsSeededAdmin()`; new block "Phần 13" after Phần 12, wrapped in `{ }` like Phần 11/12. No existing case was modified.
- **Groups (97 new checks, all ✓ on dev)**: report refusal (a)–(g) ×2 RPCs (14) · `i_reported` + report success/repeat (9) · fixture baseline (1) · AC-085 non-admin refusal ×4 functions + empty-reason gate-first (5) · solution reason ×6 / transition ×4 / invalid action (11) · solution hide/restore success + SN-1 task 05 + SN-1 task 16 S7 (8, incl. `'hide'` on hidden) · comment reason ×6 / transition / invalid action (8) · comment hide/restore/re-hide/restore/delete + SN-1 task 16 S19 + SN-1 task 27 (b) (9, incl. `'hide'` on hidden) · AC-084 + delete-on-hidden (4) · admin notes shape (4) · admin queue hidden comments (8) · RCV #26 + anonymity flags (8) · name-resolution regression (8).
- **Refusal proof**: every admin refusal / `22023` case runs through `assertRefusedUnchanged`, which snapshots the whole fixture exam (solutions incl. `updated_at`/`is_pinned`, notes, helpfuls, comments, both report kinds, every `community_moderation_log` row of the exam) through the setup client before and after the call and requires equality; report refusals assert `42501` + exact `not eligible` message + `isAuthorizationDenial` + zero rows re-read through the setup client.
- **Refactor**: shared setup is factored inside Phần 13 (`setupCs35Exam`, `insertCs35Solution`, `postCs35Comment`, `worldOf`, `assertRefusedUnchanged`, `readQueue`) and reuses the file-level helpers (`insertSubmittedAttempt`, `csWords`, `isAuthorizationDenial`, `ensureUser`/`signInAs`, `MCQ_CHOICES`). Phần 5/10/11/12 were deliberately not rewritten to use them — that would modify committed tasks' tests (escalation rule "existing test modification").
- **RED-phase discrimination proof**: the AC-085 case `admin_moderate_community_solution('hide', reason)` was temporarily switched from `userB` to `adminSession`; full `npx tsx supabase/test-rls.ts` → that assertion went ✗ ("nhận: KHÔNG CÓ LỖI, trạng thái ĐÃ ĐỔI"), plus one knock-on ✗ (the later `'restore'` on published succeeded because the solution had actually been hidden). Reverted to `userB`; next full run green. A comment at the call site records this.
- **Green run**: `npx tsx supabase/test-rls.ts` → 314 ✓ / 4 ✗; the 4 ✗ are the known pre-existing Rating `R-p/R-r/R-t/R-u` (out of scope). `serviceRoleSurface.test.ts` 6/6 ✓, `git diff --stat SOURCE/lib/supabase/service-role.ts` empty. `npm run verify:schema` ✅. `npm test` 189 files / 2502 tests ✓. `npx tsc --noEmit` exit 0. `eslint supabase/test-rls.ts` clean.

### Exit Gate re-evaluation (against the final implementation)

| Check | Result | Evidence |
|---|---|---|
| Binding Decision — dependency_direction (no `service-role.ts` export called; empty diff) | **Y** | `grep service-role supabase/test-rls.ts` → only two comments; no import; `git diff --stat SOURCE/lib/supabase/service-role.ts` empty; `serviceRoleSurface.test.ts` unmodified and green |
| RCV #16 admin notes shape | **Y** | ✓ "đúng 2 dòng, khoá … set-equal cả hai chiều" (sorted `Object.keys` of every row equals `["body","question_id","question_number"]`) and ✓ "question_number = [1, 3] ĐÚNG THỨ TỰ …" on `SOL_N` with notes at positions 1 and 3 only; admin has 0 attempts on that exam |
| RCV #26 hidden solution stays in queue | **Y** | ✓ "ẩn bài giải rồi xoá hẳn bình luận mang báo cáo mở CUỐI CÙNG → hàng VẪN được trả ở 'Đã ẩn', report_count=0, hidden_comments ngắn đi đúng một entry" (2 → 1); restore with no report → leaves the queue; restore with one report → stays as "Chờ xử lý"; never-reported solution enters on hide, leaves on restore / delete |
| Proof Obligation AC-085 | met | 4 functions × session B refused `42501 '<fn>: not an admin'`, `data === null`, whole-exam snapshot identical (incl. log rows) |
| Proof Obligation `i_reported` per caller | met | R false/false → true/false → true/true; T false/false; W false/false — every value read from `community_solution_detail` |
| Proof Obligation AC-084 | met | before `{solution 1, notes 3, helpfuls 1, comments 1, solutionReports 1, commentReports 1}` → after all 0; exactly 1 log row, `exam_id`/`target_user_id` non-null |
| SN-1 tasks 05/16/27 re-run through real admin RPCs | done | task 05: hidden solution → `save_community_solution` `42501`, no DETAIL; task 16 S7: own-preview null counts / empty comments, other reader 0 rows, restore returns counts; task 16 S19: author sees `spam`, writer + third reader `comment_count=2`, `restore`→`hide 'abuse'` reads `abuse`, final restore visible to all; task 27 (b): own hidden comment delete → `42501`, still `hidden` |

### Findings to surface (no committed code changed)

1. **No conflict with migration 32** — every case passed against the committed §23 functions, no schema change needed.
2. **SN-1 fixture drift, task 16 (informational)**: task 16's second hide inserted a second `'hide'` log row by hand while the comment was still hidden. Through the real RPCs that sequence is impossible (`'hide'` on a hidden comment → `22023 invalid transition`); the real path is `restore` → `hide 'abuse'`, which this task uses and which gives the same observable result. Task 05/16's hand-written log rows also used the writer as `actor_id`; the real RPC writes the admin's id. Neither changes any assertion of tasks 05/16/27.
3. **Not covered (outside this task's text)**: DD "Admin-hidden comment in detail" also mentions "an admin with a submitted attempt on the exam" getting no row for the hidden comment; task 16 never asserted that part and task 35 only requires re-running what tasks 16/27 asserted.
4. **Admin-session mechanism — engineer awareness**: the seeded dev admin (`admin_users` ∩ `ADMIN_USER_IDS`) is a real account with no known password, so each run mints a magic-link token for it through the Auth Admin API and verifies it on a fresh anon client (no email sent, no password change), then signs that one session out with `scope: 'local'`. Running the file against prod (`SCHEMA_ENV_FILE`) would do the same for the prod admin account.
5. **New persistent test user** `smithnguyen247+rlstestd@gmail.com` (D) now exists on dev (same convention as A/B/C).
6. **Pre-existing, out of scope**: Rating `R-p/R-r/R-t/R-u` (fixture scores `{5,6,7}` violate `ratings_scores_range_check` 1..5); and the first `verify:schema` run of the day was red only because an earlier crashed `test-rls.ts` run had left TD-016 `'Toán'` fixture rows behind — a full run cleaned them.

## Implementation Steps (TDD: Red-Green-Refactor)

### 1. Red Phase
- [x] Read all Investigation Targets and record key observations
- [x] Write the groups; prove discrimination (e.g. run a refusal case with the admin session and confirm the refusal assertion turns red; revert)

### 2. Green Phase
- [x] Run against dev; all groups green without schema changes (a needed schema change means task 32 is wrong — stop and escalate)

### 3. Refactor Phase
- [x] Share setup with existing moderation groups
- [x] Confirm tests still pass

## Quality Assurance Mechanisms
- `npx tsx supabase/test-rls.ts` — Config: `SOURCE/supabase/test-rls.ts`
- `serviceRoleSurface.test.ts` — re-run; must stay green unmodified
- `npm run verify:schema`, `npm test`, `npx tsc --noEmit`, commit gate list (run inside `SOURCE/`)
- **Skeleton lane rule (decomposer resolution R1)**: `test:localdb` with `--exclude "tests/e2e/service/community-solutions.service.e2e.test.ts"` until task 47.

## Operation Verification Methods
- **Verification method**: `npx tsx supabase/test-rls.ts` from inside `SOURCE/` against dev.
- **Success criteria**: every case in § Implementation Content green — 4 admin refusal + 4 admin success groups (incl. the reason/transition/invalid-action `22023` cases and the AC-084 cascade/log assertion), both report RPC groups with their table-closure and AC-004 cases, the `i_reported` per-caller case, the admin-notes shape, the admin-queue hidden-comment and hidden-solution-membership cases, both anonymity flags, the SN-1 re-runs and the name-resolution regression.
- **Failure response**: if the admin success group fails because `admin_users` is empty on dev, re-run task 03's out-of-band seed — do not change the test.
- **Verification level**: L2 (real-DB tests added and passing)

## Proof Obligations
- **Claim** (AC-085, verbatim): "the system shall reject every admin-moderation RPC call from a caller whose `auth.uid()` is not present in `admin_users`, with no row changed."
- **Primary failure mode**: one of the four RPCs omits or misplaces the `is_admin_user()` check (e.g. after a read).
- **Boundary to exercise**: live `.rpc()` from session B for all four functions.
- **State assertion**: target rows and `community_moderation_log` count identical before and after each refused call.
- **Mock boundary rationale**: none — real dev DB.
- **Residual**: membership drift is operational (task 52).

- **Claim** (AC-073–AC-076): `i_reported` arrives **from the read**, per caller, with no write by the reading caller in between.
- **Primary failure mode**: the flag is global ("someone reported this"), so a report leaves a visible trace for every reader (AC-075), or the already-reported state can only be inferred from a `report_*` response the caller never made in this session — and `UI Spec C-25`/`C-26`'s already-reported menu item has nothing to render from.
- **Boundary to exercise**: live `community_solution_detail` from R's, T's and W's sessions around R's two report calls.
- **State assertion**: R `false`/`false` → report solution → header `true`, comment `false` → report comment → both `true`; T reads `false`/`false`; W reads `false` on their own header.
- **Mock boundary rationale**: none — real dev DB.
- **Residual**: the menu/row rendering of the state is tasks 36 and 37.

- **Claim** (Reference Contract Value #26 / AC-082, AC-108, R17): a hidden solution keeps its queue row after its last open report is hard-deleted.
- **Primary failure mode**: the row disappears, the admin loses the only "Khôi phục" path, and the solution stays `hidden` and locked against its own writer forever.
- **Boundary to exercise**: live `admin_list_community_reports()` from the admin session across hide → hard-delete-comment → restore.
- **State assertion**: row present in "Đã ẩn" with `report_count = 0` and one fewer `hidden_comments` entry; after `'restore'` the row stays only if a report of either kind remains.
- **Mock boundary rationale**: none.
- **Residual**: the "Đã ẩn" section rendering is task 38.

- **Claim** (AC-084): hard delete removes the solution and all dependents in one transaction and leaves exactly one complete log row.
- **Primary failure mode**: dependents survive (missing cascade) or the log row has null `exam_id`/`target_user_id`.
- **Boundary to exercise**: live `admin_moderate_community_solution(id, 'delete', reason)` from the admin session.
- **State assertion**: before — solution + ≥1 note, helpful, comment, report; after — zero of each for that solution; log rows for `target_id = id` = 1 with non-null `exam_id`, `target_user_id`.
- **Mock boundary rationale**: none.
- **Residual**: the one-time reason display to the writer is proven in task 08.

## Completion Criteria
- [x] All added tests pass
- [x] Operation verified per Operation Verification Methods above
- [x] Each Proof Obligation is met
- [x] Every Binding Decision and Reference Contract Compliance Check evaluates to `Y`, with evidence in Investigation Notes
- [x] The SN-1 hidden cases of tasks 05, 16 and 27 have been re-run here through the real admin RPCs

## Notes
- Impact scope: gates Phase 4 admin UI (task 38) on a verified backend.
- Scope boundary: no schema edits; fixtures prefixed and cleaned idempotently.
- Do not stage or revert the engineer's uncommitted changes: `.claude/*`, `.mcp.json`, `SCREENSHOT/*`, `TECH-DEBT.md`, `skills-lock.json`, `test_file/`, `SOURCE/.ts`. Stage only this task's files by explicit path.
