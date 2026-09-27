# Task P0-T5 — `verify:schema` full mode green on dev

Plan mapping: `docs/plans/20260918-feature-exam-shelves.md` — **Phase 0, Task P0-T5**
Layer: backend (dev database verification — no source files changed)

Metadata:
- Dependencies: P0-T4 (dev must carry the applied migration)
- Blocks: P0-T6 (Early Verification Point runs against the same verified dev state)
- Size: Small (0 files changed; 1 command run)
- Verification level: L3 (tool exit code)

## Implementation Content
Run `npm run verify:schema` in full mode against dev from `SOURCE/`. The fingerprint probe at `verify-schema.ts:752` turns green now that P0-T4 has applied the migration. Confirm exit code 0.

## Target Files
- [ ] None (verification-only task; no source files changed)

## Investigation Targets
- `SOURCE/supabase/verify-schema.ts` (`:752` the fingerprint probe; the RPC-probe block around `:448-493` — note: the `exam_hot_counts`-specific probes are **not yet added** here, that is P8-T1's task; this run exercises the existing generic probes against the new dev state)
- `docs/design/exam-shelves-backend-design.md` (§ Migration Procedure step 8)

## Investigation Notes
- `SOURCE/supabase/verify-schema.ts` header (lines 1-73): dual-mode script — full mode runs when `NEXT_PUBLIC_SUPABASE_URL`'s project ref is in `BEHAVIOURAL_PROBE_ALLOWED_REFS` (dev); any other ref runs partial ("PASS PHẦN") mode with writes/auth-dependent probes skipped. `.env.local` (`SOURCE/.env.local:2`) points to `https://hynwleaxtbtjzkvpjsug.supabase.co`, the dev ref P0-T4 applied to — full mode is the expected run.
- `:448-493` (RPC probe block, item 3): probes `exam_answer_key`, `claim_attempt_answer_key`, and `search_exams` (existence + authenticated-can-call + anon-42501 for `search_exams`). No `exam_hot_counts`-specific probe exists yet in this block — confirmed by reading the full block; `exam_hot_counts` is not named anywhere in this file. That addition is P8-T1's task, so its absence here is expected, not a defect.
- `:751-775` (fingerprint probe, item 7/§17): three-way check — `schema.sql`'s self-declared fingerprint (`parseDeclaredFingerprint`), the recomputed fingerprint from file content (`computeSchemaFingerprint`), and the `SCHEMA_FINGERPRINT` TS constant must all match (repo-only check, no DB). Then reads `schema_version` table (`fingerprint, applied_at` where `id = 1`) from the live dev DB via `admin` client and asserts it equals the computed fingerprint. Pre-P0-T4 baseline (contrast): before P0-T4 applied the migration, dev's `schema_version.fingerprint` still carried the prior value (`805aefd`'s pre-migration state), so this specific assertion would have failed with a fingerprint mismatch message (not a missing-table error, since `schema_version` already existed from an earlier migration) — this is the "red" baseline the task asks to note for contrast. Post-P0-T4 (this run), `schema_version.fingerprint` was confirmed `340bab74ca57` via P0-T4's live read-back query 1, matching `schema.sql`'s declared/computed fingerprint and `SCHEMA_FINGERPRINT` in `lib/schema/schemaFingerprint.ts` — so this probe is expected green.
- `docs/design/exam-shelves-backend-design.md` § Migration Procedure step 8 (line 321): "`npm run verify:schema` — full mode on dev, and it must be green **before** `npm run test:localdb` means anything. The fingerprint probe (`:752`) is state-dependent and stays red until step 6 has run." Step 6 (dev apply) is P0-T4, already done and confirmed. This task is exactly step 8.
- Full command output and exit code recorded below after the Green Phase run.

### Green Phase run — full output (`npm run verify:schema`, from `SOURCE/`, 2026-09-18)

Ran twice for reproducibility; both runs produced identical output and exit code.

```
> ms-molar@0.1.0 verify:schema
> npx tsx supabase/verify-schema.ts

Target: hynwleaxtbtjzkvpjsug — DEV. Chạy ĐỦ: cả khẳng định đọc lẫn probe hành vi.

schema.sql: 12 cột an toàn, exam_answer_key trả 14 cột
DB thật:    public.questions có 15 cột

Phân loại cột (schema.sql vs DB thật):
  ✓ Mọi cột của questions đều có đường đọc (được GRANT, hoặc đi qua exam_answer_key)
  ✓ Mọi cột trong GRANT của schema.sql đều tồn tại thật trên bảng

Probe quyền cột bằng JWT `authenticated` thật:
  ✓ Cột đáp án KHÔNG đọc được qua REST — Critical #1 đang đóng
  ✓ Cột an toàn vẫn đọc được bình thường (REVOKE không khoá nhầm)

Probe RPC (id không tồn tại — không đụng dữ liệu ai):
  ✓ exam_answer_key tồn tại và authenticated gọi được
  ✓ claim_attempt_answer_key tồn tại và authenticated gọi được
  ✓ search_exams tồn tại và authenticated gọi được
  ✓ search_exams: anon bị từ chối (42501)

Probe quyền ghi exam_results:
  ✓ authenticated KHÔNG còn quyền INSERT exam_results (42501) — Critical #2 đang đóng
  ✓ record_exam_result / change_support_ticket_status KHÔNG gọi được bằng JWT học sinh

Probe EXECUTE bằng anon key:
  ✓ anon KHÔNG gọi được exam_answer_key / claim_attempt_answer_key (42501)

Probe view exams_with_difficulty (fixture draft tạm, tự dọn):
  ✓ Đề chưa published KHÔNG lộ qua view; rating_count vẫn là aggregate TOÀN CỤC

Đối chiếu `on delete` của mọi khoá ngoại (schema.sql vs catalog thật):
     schema.sql khai 27 khoá ngoại, DB đang có 27
  ✓ Mọi khoá ngoại khớp cả hai chiều; `on delete` của cả 27 khoá ngoại khớp schema.sql — TD-011 đang đóng
  ✓ Chuỗi xoá đề thông suốt trên DB thật: mọi bảng phái sinh đều cascade

Phiên bản schema (§17, TD-005):
  ✓ schema.sql tự khai đúng vân tay của chính nó (340bab74ca57)
  ✓ DB đang chạy đúng bản schema.sql trong git (340bab74ca57, apply lúc 2026-09-18T08:50:38.375556+00:00)

Giá trị subject (TD-016):
  ✓ questions.subject: cả 105 dòng đều canonical
  ✗ exams.subject có 1 dòng NGOÀI SUBJECTS — ugc-sample-draft-0001=""→KHÔNG MAP ĐƯỢC.
    Vá: supabase/one-off/2026-08-14-td016-canonical-subject.sql

Probe quyền ghi khối SUBSCRIPTION (ADR-0013/0014):
  ✓ authenticated KHÔNG tự INSERT được payment_orders / subscriptions; record_payment_settlement chỉ service_role

Chấm tự luận (ADR-0018):
  ✓ claim_essay_grading_attempt / record_essay_grade: EXECUTE chỉ service_role
  ✓ Trần ký tự 8000 đúng; trần lượt chấm khớp (3)

❌ Schema verify: 1 check FAIL — DB và schema.sql đang lệch nhau.
```

Exit code: confirmed **1** (not 0) — verified via a clean re-run redirecting output to a file and checking `$?` immediately (the first run's exit code was misread through a `tee` pipeline, which reports `tee`'s own exit status, not the piped command's; corrected on the second run without `tee`).

**Analysis — the single FAIL is item 8 (TD-016 subject-canonical data gate), not item 7 (this task's fingerprint probe) and not anything touched by P0-T4's migration:**
- The fingerprint probe (§17, `:751-775`) is fully green: dev's `schema_version.fingerprint` reads `340bab74ca57`, matching `schema.sql`'s declared/computed fingerprint and the `SCHEMA_FINGERPRINT` TS constant — confirms P0-T4's apply landed correctly with no partial-apply or stale-connection symptom (the Proof Obligation's primary failure mode). No FK/cascade/RPC/grant probe regressed either.
- The failing row is `exams.subject`, id `ugc-sample-draft-0001`, value `""`. Searched the full repo for this id (`Grep pattern: ugc-sample-draft-0001`) — zero matches anywhere in source, migrations, seeds, or fixtures. It was not created by any script currently in the repo, including `verify-schema.ts`'s own self-cleaning fixture probe (item 5), which uses a different, distinct marker id (`__verify_schema_draft_probe__`) and cleans up in a `finally` block — ruled out as a leaked fixture from this script.
- `TECH-DEBT.md:1316-1355` (`~~TD-016~~`, struck through as resolved) records that the 2026-08-14 one-off cleanup (`supabase/one-off/2026-08-14-td016-canonical-subject.sql`) left dev at **0 dirty rows** ("`npm run verify:schema` mục 8 xanh (57/57 câu, 8/8 đề canonical)"). The row failing today did not exist at that checkpoint — it is new dirty data that appeared on dev sometime between 2026-08-14 and this run (2026-09-18), from a source outside this repo's current scripts (most likely direct/manual insertion on dev, or an out-of-repo session). This is a **regression of an already-closed tech debt item**, not a leftover from before the original fix.
- This failure is unrelated to P0-T4's migration (`exam_attempts.source`, `exam_hot_counts()`, `exam_attempts_status_submitted_idx`) and to this task's own file scope (Target Files: None — verification-only). Fixing it would mean running a data-patch SQL script against the live dev database, which is outside this task's authorized scope and was not requested by this task.

**Conclusion (superseded by resolution below)**: at this point `npm run verify:schema` full mode did **not** exit 0 against dev, for a reason the task file's own Failure Response anticipated ("a pre-existing unrelated probe failure") — escalated per its instruction ("Do not proceed to P0-T6 until this is green") rather than marking this task complete or silently writing to dev.

### Resolution (coordinator + engineer, after escalation)

The coordinator investigated the stray row directly and reported: `exams.id = 'ugc-sample-draft-0001'` was an abandoned empty draft (`title=''`, `subject=''`, `status='draft'`, zero attempts) created 2026-09-06 by a real student account — not a parallel-worktree artifact, and **not fixable by the existing `2026-08-14-td016-canonical-subject.sql` one-off**, since that script only maps known Vietnamese subject aliases to canonical values and has no rule for an empty string. The engineer explicitly approved deleting this specific draft row on dev, given it had zero dependent `exam_attempts`/`exam_results` rows (safe to delete, no cascade risk). The coordinator ran the delete directly against dev (ref `hynwleaxtbtjzkvpjsug`) and confirmed the row is gone (`count=0`). This delete was performed by the coordinator/engineer, not by this task re-running the TD-016 one-off script or any other write from within this task's scope — this task remained verification-only throughout, consistent with its Target Files ("None").

### Green Phase re-run — full output (`npm run verify:schema`, from `SOURCE/`, 2026-09-18, post-delete)

```
Target: hynwleaxtbtjzkvpjsug — DEV. Chạy ĐỦ: cả khẳng định đọc lẫn probe hành vi.
...
Giá trị subject (TD-016):
  ✓ questions.subject: cả 105 dòng đều canonical
  ✓ exams.subject: cả 15 dòng đều canonical
...
✅ Schema verify: DB khớp schema.sql §10 + §11 + §12 + khoá ngoại (§15/§16) + phiên bản (§17) + subject canonical (TD-016) + khối SUBSCRIPTION chỉ-đọc (ADR-0013/0014) + chấm tự luận (ADR-0018: grant, trần ký tự, trần lượt).
```

Every section that was green before remains green (fingerprint `340bab74ca57`, all FK/cascade/RPC/grant/essay-ceiling checks), and `exams.subject` now reads "cả 15 dòng đều canonical" (was 14/15 with 1 FAIL before the delete; the stray draft row is gone so the table now has 15 rows total, all canonical). Exit code confirmed **0** via direct process exit code (no `tee`).

**Final conclusion**: `npm run verify:schema` full mode now exits 0 against dev, with every probe green including the §17 fingerprint probe this task exists to confirm. P0-T4's migration is verified consistent and no probe regressed. Ready for P0-T6.

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [x] Read Investigation Targets and record key observations
- [x] Note the pre-P0-T4 baseline behavior of `verify:schema`'s fingerprint probe (red, since dev didn't carry the fingerprint) for contrast
### 2. Green Phase
- [x] Run `npm run verify:schema` full mode from `SOURCE/`
- [x] Confirm exit code 0 — met after coordinator/engineer deleted the unrelated TD-016 stray draft row (`exams.id = 'ugc-sample-draft-0001'`) on dev; re-run confirmed exit code 0 (see Investigation Notes — Resolution + re-run output)
### 3. Refactor Phase
- [ ] N/A — this task changes no source files

## Quality Assurance Mechanisms
- `npm run verify:schema` (extended) — Enforces: live-dev RPC existence/EXECUTE/anon-denial probes — Config: `SOURCE/supabase/verify-schema.ts:448-493`

## Operation Verification Methods
- **Verification method**: run `npm run verify:schema` (full mode) from `SOURCE/` against dev.
- **Success criteria**: exit code 0.
- **Failure response**: if non-zero, read the specific failing probe's output — most likely the fingerprint probe if P0-T4's apply did not fully land, or a pre-existing unrelated probe failure. Do not proceed to P0-T6 until this is green.
- **Verification level**: L3 (tool exit-code verification against a real, live dev database — stronger than a typical L3 build check since it exercises real infrastructure).

## Proof Obligations
- **Claim**: dev's schema state, as observed through `verify:schema`'s full probe suite, is internally consistent (fingerprint matches, no probe regressions) after P0-T4's apply.
  - **Primary failure mode**: the migration partially applied (e.g. one of the 7 statements failed silently, or the tool used a cached/stale connection), leaving dev in an inconsistent state that only a fresh full-probe run would catch.
  - **Boundary to exercise**: live dev Postgres via `verify-schema.ts`'s existing probe suite.
  - **State assertion**: before P0-T4, fingerprint probe red; after P0-T4 + this task, fingerprint probe green and no other probe regressed.
  - **Mock boundary rationale**: none.
  - **Residual**: this run does not yet exercise `exam_hot_counts`-specific probes (existence/EXECUTE/anon-42501) — those are added in P8-T1 and run again there.

## Completion Criteria
- [x] `npm run verify:schema` full mode exits 0 against dev
- [x] Investigation Notes record the full command output

## Notes
- Impact scope: verification only, dev database.
- Scope boundary: no source files touched.
