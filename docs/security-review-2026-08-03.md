# Security Review — TrangNguyenDigi (MS-MOLAR)

**Date:** 2026-08-03
**Scope:** Full codebase audit across all layers (Layer 1–4, HM, Supabase schema/RLS, dependencies)
**Reviewer:** Claude Code (manual read-through of schema.sql, all Server Actions, all queries.ts, middleware, RichText/XSS surface, dependency audit)
**Verdict (original, 2026-08-03):** Not ready to sell yet. Two critical flaws break the core product promise (exam integrity). Estimated fix time: 2–3 focused sessions, not a rewrite.

**Verdict (updated, 2026-08-04):** Every item below — both Criticals, High #3, all four Mediums, all four Lows — is fixed, applied to the database, and covered by an automated gate (`verify:schema` + `test-rls.ts`, 40+ new assertions). The one item not yet exercised by a human is `/admin` (#7) in an actual browser. See the progress table and per-item STATUS blocks below for what each fix actually does and how it was verified.

> This is a snapshot in time. Before acting on any item below, verify the referenced file/line still matches current code — things may have changed since this review.

---

## How to use this document

- 🔴 Critical = blocks launch, fix first
- 🟠 High = fix before accepting real users/payments
- 🟡 Medium = fix soon, not blocking
- 🟢 Low = cheap wins, do when convenient
- ✅ = already correct, don't touch without reason

---

## 🔴 Critical — blocks launch

### 1. Any logged-in student can read the answer key before submitting

> **STATUS 2026-08-03: ✅ CLOSED — applied to the database and verified.**
> `SOURCE/supabase/schema.sql` §10 adds column-level GRANTs plus two SECURITY
> DEFINER functions (`exam_answer_key`, `claim_attempt_answer_key`); all five
> app read paths go through them. Verified on the real DB: `verify:schema` green
> for §10, and `test-rls.ts` cases R-v…R-z2 all pass — a signed-in non-author now
> gets `42501` on `correct_answer`/`sub_answers`/`essay_answer` over REST.
>
> Was confirmed genuinely exploitable before the fix (not a theoretical reading
> of the policy): an ordinary signed-in account could read all three columns.
>
> ⚠ One residual, folded into the pending §12 paste: `EXECUTE` on both functions
> is still granted to `anon`. Harmless today (`auth.uid()` is null ⇒ 0 rows), but
> not the intended design — see the `REVOKE ... FROM PUBLIC` note under item 2.
>
> Re-running the *whole* file is riskier than its header claims: it aborted at
> §2 on 2026-08-03 (`23514`, `questions_type_check` narrowed there but widened in
> §8c — since fixed), and §8's `storage.objects` policies can still fail with
> `must be owner of table objects` depending on the project. Both abort before
> §10 is reached. See `docs/TECH-DEBT.md` TD-005.

**Layer 2 (Core Loop)** · `SOURCE/supabase/schema.sql` (questions RLS, ~line 273-280)

RLS (Row Level Security) controls **which rows** a user can see, not **which columns**. The policy `questions_select_visible` lets any authenticated user read questions from published exams — but that grants the *entire row*, including `correct_answer`, `sub_answers`, and `essay_answer`.

The app code is careful — `SOURCE/app/(layer2)/queries.ts` (`getExamForPlayer`) deliberately never selects those columns. But that protection lives only in application code. Supabase exposes a REST API directly to the browser (anon key + user's own JWT, both visible in devtools). Any student can call:

```
GET /rest/v1/questions?select=id,correct_answer,sub_answers,essay_answer
```

...and get every answer to every published exam. No exploit needed, just a documented Supabase REST call.

**Already known:** the project's own `security-reviewer` flagged this and the team knowingly deferred it as technical debt — see `PROCESS.md` around line 3511-3515 ("RLS column-level gap... correct_answer/sub_answers/essay_answer đều lộ được qua REST API trực tiếp"). Reasonable during development; not acceptable for a paid launch.

**Fix direction:** `REVOKE` the sensitive columns from the `authenticated` role, or move exam-taking reads behind a `SECURITY DEFINER` Postgres function that returns only safe columns.

---

### 2. Students can write their own scores into the database

> **STATUS 2026-08-03: ✅ CLOSED — applied to the database and verified.**
> `schema.sql` §11 revokes `INSERT/UPDATE/DELETE` on `exam_results` from
> `anon`/`authenticated` outright and routes the write through
> `record_exam_result()`. `submitExam` calls it via
> `SOURCE/lib/supabase/service-role.ts` (server-only, exports one narrow
> operation, covered by the bundle scan). Rationale and rejected alternatives:
> `docs/adr/ADR-0010-score-write-trust-boundary.md`.
>
> **Applied and verified:** `authenticated` gets `42501` on
> `INSERT INTO exam_results` — a student cannot fabricate a score. `test-rls.ts`
> S-a…S-e pass.
>
> **Both defence layers now confirmed:** `EXECUTE` on `record_exam_result` is
> revoked from `anon`/`authenticated` (S-c gets `42501` at the function door, not
> just at the `INSERT` inside). Cause of the original miss is worth
> remembering: on Supabase, `REVOKE ... FROM PUBLIC` restricts nothing, because
> `ALTER DEFAULT PRIVILEGES ... GRANT ALL ON FUNCTIONS TO anon, authenticated,
> service_role` gives every new `public` function *explicit* per-role grants that
> a `PUBLIC` revoke does not touch. **Every function added from now on must
> revoke each role by name.**
>
> **Also found while fixing:** the policy never constrained `attempt_id`, and
> `exam_results.attempt_id` is `UNIQUE` — so a user could insert a row against
> *someone else's* attempt and permanently break that user's real submission
> with `23505`. Low exploitability (attempt ids are unguessable UUIDs), same
> policy hole, closed by the same fix.

**Layer 2 / HM / Layer 3** · `SOURCE/supabase/schema.sql`, policy `results_insert_own` (~line 205-207)

```sql
create policy "results_insert_own" on public.exam_results
  for insert with check (user_id = auth.uid());
```

That's the only check. The database never verifies:
- the attempt actually belongs to this user (beyond user_id match on the *result* row itself),
- the attempt was actually submitted,
- the score matches what `computeScore` calculated server-side.

A student can `POST` directly to `/rest/v1/exam_results` with a fabricated `{ attempt_id, total_score: 10, correct: 40, total: 40 }` and get a perfect score. This flows straight into **History** (Layer HM, `app/(HM)/queries.ts`) and **Analytics** (Layer 3, `app/(layer3)/queries.ts`), both of which trust `exam_results` as ground truth.

Low damage today (no leaderboard/certificates), but becomes fraud the moment rankings, certificates, or school reporting are added.

**Interaction with the #1 fix (added 2026-08-03).** The #1 patch added `claim_attempt_answer_key`, which a client can call directly to close its own attempt and receive the answer key. That is safe on its own — the attempt is locked first, so the key arrives too late to cheat with. But while #2 is open, the chain "claim → read the key → POST a fabricated `exam_results`" still works. The patch did not create that chain (before it, you could read every answer key over REST *without* an attempt and fabricate a score, which is strictly easier), and it does not widen it. It is simply the reason #2 should not drift: after #1, `exam_results` is the last unguarded write on the scoring path.

**Fix direction:** Add `WITH CHECK` conditions requiring the attempt to belong to the user and have `status = 'submitted'`, or move result-writing behind a `SECURITY DEFINER` function so the client can't insert directly at all. If you take the definer route, folding it together with `claim_attempt_answer_key` into a single "submit" transaction is the natural shape.

---

## 🟠 High

### 3. Known-vulnerable dependencies — one is reachable via the upload pipeline

> **STATUS 2026-08-03: ✅ the reachable path is closed.** `next` 16.2.7 → 16.2.12,
> `sharp` 0.34.5 → 0.35.3 (breaking major, verified). No DB change.
>
> The live attack path the review named — `sharp` on user uploads via
> `lib/ugc/cropImages.ts` — now resolves to the **patched top-level sharp**
> (confirmed with `require.resolve`). The exact call chain that file uses
> (`metadata` → `extract` → `png` → `toBuffer`) was smoke-tested on 0.35: crops
> to the right dimensions, no API break.
>
> The Next.js **middleware/proxy bypass** advisory mattered most here because
> `proxy.ts` is the only route guard. Re-verified after the bump: all five
> protected routes 307 to sign-in, and `//exams`, `/exams%2f`, `/./exams`,
> `/exams?x=.js`, `/exams/` all end up guarded (redirect chains followed to
> completion). All 6 security headers still served.
>
> **`npm audit` still reports 3 high — do not "fix" them.** They are nested
> copies inside `next` (`next/node_modules/sharp` 0.34.5,
> `next/node_modules/postcss` 8.4.31) and npm's only proposed remedy is
> downgrading `next` to **9.3.3**. Neither is reachable: `next/image` is used
> only on two developer-shipped static PNGs and `images.remotePatterns` is
> unset (so remote URLs are refused), while user-uploaded exam images render
> through a plain `<img>` with an origin allowlist, never the optimizer.
> `postcss` runs at build time on developer-authored CSS. Full reasoning:
> `docs/TECH-DEBT.md` TD-007.
>
> Verified: 326 tests, `tsc`, production build, bundle scan, browser pass
> (sign-in → /exams → /me/exams, zero console errors).

`npm audit` (run 2026-08-03) reports **10 vulnerabilities (7 high)**:

| Package | Installed | Notable issues |
|---|---|---|
| `next` | 16.2.7 | 9 advisories incl. **middleware/proxy bypass in App Router + Turbopack**, unauthenticated disclosure of internal Server Function endpoints, SSRF in Server Actions, DoS |
| `sharp` | ^0.34.5 | libvips CVEs: CVE-2026-33327, CVE-2026-33328, CVE-2026-35590, CVE-2026-35591 |
| `postcss` (via next) | ≤8.5.17 | XSS via unescaped `</style>`, arbitrary file read via sourceMappingURL |

Two matter specifically here:
- **Proxy bypass** hits this exact setup — `SOURCE/proxy.ts` is the *only* route guard, and the project uses Turbopack.
- **`sharp` processes untrusted uploads.** `SOURCE/lib/ugc/cropImages.ts` runs `sharp` on images uploaded by any user during the UGC exam-upload pipeline. This is a live, reachable attack path, not theoretical.

**Fix:** `npm audit fix --force` (moves to next@16.2.12, sharp@0.35.3 — both are breaking-change bumps per npm, so re-run the full test suite after).

---

## 🟡 Medium

### 4. `exams_with_difficulty` view likely bypasses RLS entirely

> **STATUS 2026-08-04: ✅ CLOSED — applied to the database and verified.**
> Was confirmed worse than rated when found — measured against the real DB with a temporary draft
> fixture: `GET /rest/v1/exams_with_difficulty?select=*` with **only the anon key
> and no login at all** returns every exam, including unpublished drafts with
> `title`, `author_id` and `question_file_path` (the Storage path of the source
> upload). The review assumed a login was needed; it is not. This is closer to
> High than Medium.
>
> **The review's one-line fix would have silently broken the app.** Setting
> `security_invoker = true` also applies RLS to the ratings sub-query, and
> `ratings_select_own` restricts to your *own* rating — so `rating_count` /
> `avg_overall` would collapse to your own single rating, corrupting community
> difficulty (ADR-0008) with no error at all. `schema.sql` §12 therefore splits
> it: the aggregate moves into a `SECURITY DEFINER` function (counts/averages
> only, no rater identity), and only the `exams` read becomes invoker.
> `verify:schema` pins the aggregate against a service-role baseline so that
> silent regression cannot pass.
>
> **Applied and verified 2026-08-03.** A logged-out anon probe against a
> temporary draft fixture now returns 0 rows through the view, and `rating_count`
> still matches the service-role ground truth (aggregate did not collapse).

`SOURCE/supabase/schema.sql` (~line 548), `create or replace view public.exams_with_difficulty as select e.*, ...`

In Postgres 15+, views run with the **owner's** permissions by default (not the caller's) unless `security_invoker = true` is set. This view was created via the Supabase SQL Editor (owner = `postgres`), so RLS on the underlying `exams` table is likely skipped for direct queries against the view.

App code is safe because `listExams`/`getExam` in `app/(layer2)/queries.ts` manually add `.eq("status","published")`. But a direct call to `/rest/v1/exams_with_difficulty?select=*` would likely return every user's **unpublished drafts** — titles, schools, author IDs, storage paths.

**Verify with:**
```sql
select relname, reloptions from pg_class where relname = 'exams_with_difficulty';
```
If `reloptions` doesn't contain `security_invoker=true`, the leak is confirmed.

**Fix:** `alter view public.exams_with_difficulty set (security_invoker = true);`

---

### 5. No security response headers

> **STATUS 2026-08-03: FIXED and verified in a real browser.** No DB change needed.
>
> The premise turned out to be improvable at the source. The review's concern was
> "`httpOnly: false` ⇒ one XSS = account takeover, with no second line of
> defense." But `httpOnly: false` is only required so a *browser* Supabase client
> can read the cookie — and **nothing in this project imports
> `lib/supabase/client.ts`** (verified by repo-wide grep); every Supabase call is
> a Server Component / Server Action / route handler, and all auth is server-side
> PKCE `?code=`, including the password-reset email link. So the cookie can simply
> be `httpOnly`.
>
> - `SOURCE/lib/supabase/cookieOptions.ts` — `httpOnly: true`, `sameSite: lax`,
>   `secure` in prod, applied in **both** `server.ts` and `middleware.ts` (the
>   middleware refreshes tokens, so missing it there would silently rewrite the
>   cookie without `httpOnly`).
> - `lib/supabase/client.ts` now throws instead of returning a silently
>   *unauthenticated* client — that failure mode would have been RLS returning 0
>   rows with no error.
> - `SOURCE/next.config.ts` — CSP, `X-Frame-Options`, `X-Content-Type-Options`,
>   `Referrer-Policy`, `Permissions-Policy`, HSTS (prod only).
>
> **Verified**, not assumed: built, ran `next start`, drove a real browser through
> home → sign-in → /exams → exam detail → /history → /me/dashboard. Zero console
> errors on every page, login works, and `document.cookie === ""` while logged in.
>
> **Caveat:** `script-src` still carries `'unsafe-inline'` (Next.js hydration
> needs it without a nonce), so inline-XSS is not blocked by CSP — see
> `docs/TECH-DEBT.md` TD-006. `upgrade-insecure-requests` was deliberately
> omitted: it breaks `next start` on localhost, and HSTS already covers it.

`SOURCE/next.config.ts` has no `headers()` block — no CSP (Content Security Policy: tells the browser which script sources are trusted), no `X-Frame-Options`/`frame-ancestors` (prevents clickjacking — embedding the site invisibly in an attacker's page).

This matters more than usual here because Supabase's `@supabase/ssr` sets session cookies with `httpOnly: false` by default (confirmed in `node_modules/@supabase/ssr/dist/main/utils/constants.js` — `DEFAULT_COOKIE_OPTIONS`), which is required for the browser client to read them. That means **a single XSS bug = full account takeover**, with no second line of defense.

To be fair: the XSS defenses that do exist are strong. `SOURCE/components/shared/RichText.tsx` is properly hardened — no `rehype-raw`, KaTeX `trust:false`, sanitize runs last, backed by dedicated XSS regression tests. There is zero `dangerouslySetInnerHTML` anywhere in the codebase (verified by grep). But there's one wall and no backup wall.

---

### 6. Exam timer is client-side only, not enforced server-side

> **STATUS 2026-08-04: ✅ CLOSED — applied to the database and verified.**
> Policy chosen: **accept the submission, flag the overtime.** A late submit is
> still graded (a dropped connection shouldn't destroy a student's work), but
> `exam_results.overtime_seconds` records exactly how far over it went and the
> Result page says *"Submitted after time … the score is not a valid timed
> result."*
>
> Crucially the value is **computed inside `record_exam_result()`** from
> `started_at + duration_minutes`, exactly like `user_id` — it is not a
> parameter, so no call site (or tampered client) can under-report it. Disabling
> JS removes the countdown but not the record.
>
> Gate: `test-rls.ts` case **S-f** seeds two attempts differing only in
> `started_at` and asserts `0` vs `≈1800`.

`SOURCE/app/(layer2)/_components/ExamPlayer.tsx` (~line 127): `<ExamTimer durationMinutes={durationMinutes} onTimeUp={submit} />` runs entirely in the browser.

`submitExam` (`SOURCE/app/(layer2)/actions.ts`) never compares `exam_attempts.started_at + duration_minutes` against the current time. A student can disable JS, take unlimited time, and submit whenever. Not a data breach, but undermines the "timed exam practice" value proposition.

---

### 7. No admin/moderation tooling for user-uploaded content

> **STATUS 2026-08-04: ✅ CLOSED — applied, gated, and browser-verified end to
> end.** Full flow driven in a real browser (Playwright): signed in, reported
> `exam-ly-10`, confirmed it appeared in `/admin` under "Awaiting review" with
> the correct report count/reason, clicked Remove — the exam vanished from
> `/exams` **and** direct navigation to `/exams/exam-ly-10` 404'd immediately
> (not just hidden from the list). Clicked Restore — it returned to `draft`,
> not `published`, so it correctly stayed 404 until the author republishes.
> `exam_moderation_log` recorded both actions with the real actor id, reasons,
> and timestamps. All test data (report, log rows) cleaned up and the exam
> returned to its original `published` state afterward — no residue.
>
> One coordination note for future testing: `ADMIN_USER_IDS` only contains a
> production account, not a test account, so verifying required temporarily
> adding a test account's UUID to `.env.local` for the duration of the test,
> then reverting it exactly (confirmed via `git diff` — zero residual change).
>
> **Requires `ADMIN_USER_IDS`** (comma-separated Supabase user UUIDs) in the
> environment. Unset ⇒ nobody is an admin and `/admin` 404s — fail-closed by
> design, so forgetting to configure it can't expose the page.
>
> - `/admin` lists reported exams (most-reported first) with Remove / Restore.
> - Auth reuses the **existing Supabase login** against an env allowlist rather
>   than a shared admin password: no new secret to leak, MFA/OAuth still apply,
>   and `exam_moderation_log` records *who* removed *what* and *why*. A shared
>   password gives none of that.
> - ADR-0001's "no admin in the database" decision is preserved — there is still
>   no `is_admin()`, no role column, no admin policy. Authority lives in env and
>   writes go through `service_role`.
> - Restore returns an exam to `draft`, never straight to `published`, so
>   undoing a takedown can't silently republish content.
>
> The takedown has to hold against the *author*, who can call PostgREST directly
> with their own JWT — so it is enforced in RLS, not in the Server Action:
> `exams_update_author` / `exams_delete_author` now exclude `status = 'removed'`.
> Gate: `test-rls.ts` **M-a…M-d** (author can't republish, rename, or delete a
> removed exam; it's hidden from others but still visible to its author; the
> moderation log is unreadable by anyone but `service_role`).

Any user can upload and publish exams (Layer 4 UGC pipeline). `exam_reports` lets users flag content, but there is no admin interface — confirmed by the schema's own comment: *"Gỡ UGC published xấu: out-of-band bằng service-role"* (`SOURCE/supabase/schema.sql` ~line 322-323, i.e., "removing bad published UGC" requires manually running SQL with the service-role key).

For a platform serving minors in Vietnam, with zero moderation tooling beyond hand-written SQL, this is a legal/operational gap before accepting public uploads at scale.

---

## 🟢 Low

> **STATUS 2026-08-03: all four fixed in code.** No DB change.
>
> - **Password policy** → `lib/auth/passwordPolicy.ts`, shared by `signUp` (which
>   previously validated *nothing*) and `updatePassword`. Minimum 10, NIST-style
>   (length over composition rules), small common-password blocklist, and a
>   **72-byte ceiling** — bcrypt silently truncates past that, so longer
>   passwords were giving users false confidence. Byte-counted, since accented
>   Vietnamese costs 2–3 bytes per character. Existing accounts aren't locked out.
> - **Rate limiting** → `lib/security/rateLimit.ts`, sliding-window, applied to
>   all four named actions. Three of them already had the user id at hand; for
>   `rateExam` I reshaped the eligibility precheck to return `user_id` instead of
>   a count, keeping it at **one round trip** rather than adding `auth.getUser()`.
>   Honest scope: this is per-process memory, so it stops an authenticated
>   account hammering an endpoint — it is *not* infrastructure DoS protection
>   (see `docs/TECH-DEBT.md` TD-008).
> - **35MB body limit** → now **computed** as `2 × MAX_FILE_BYTES + 2mb` = 32mb,
>   so it tracks the real requirement instead of a hand-picked number. Note the
>   limit is global in Next (every action gets it), which is why rate limiting is
>   the actual mitigation here.
> - **`startAttempt`** → now requires `status = 'published'`, matching the guard
>   every other read path already used.

- **Weak password policy** — `signUp` (`SOURCE/app/(layer1)/actions.ts`) sets no explicit minimum; relies on Supabase's default (6 chars). `updatePassword` explicitly enforces only 6. Worth raising.
- **No rate limiting** on `submitExam`, `rateExam`, `reportExam`, `updateProfile`. Only UGC uploads are throttled (30/day — cost guard, `SOURCE/lib/ugc/limits.ts`, `MAX_UPLOADS_PER_DAY`).
- **35MB Server Action body limit** (`SOURCE/next.config.ts`, `serverActions.bodySizeLimit`) is a mild DoS amplifier, especially combined with the Next.js DoS advisory in item 3.
- **`startAttempt`** doesn't verify the exam is published before creating an attempt row. Low impact today (unpublished exam questions aren't readable anyway), but inconsistent with the "published-only" guard used everywhere else.

---

## ✅ What's already correct (don't touch without reason)

| Area | Status | Where |
|---|---|---|
| Secrets management | No `.env` committed; `GEMINI_API_KEY` is server-only with a **build-time check** it never reaches the client bundle | `SOURCE/lib/ugc/gemini.ts`, `scripts/check-ai-key-bundle.mjs` |
| Storage | Both buckets (`exam-images`, `exam-uploads`) private; 1-hour signed URLs; fails closed on error | `SOURCE/lib/ugc/imageUrl.ts` |
| Open redirect | Handled in two places — `ALLOWED_NEXT` whitelist in auth callback, `safeBackHref` on rate page | `SOURCE/app/auth/callback/route.ts`, `SOURCE/app/(layer2)/exams/[id]/rate/page.tsx` |
| Email enumeration | Password reset returns identical message whether or not the account exists | `SOURCE/app/(layer1)/actions.ts` (`requestPasswordReset`) |
| Server-side scoring | `computeScore` runs server-side using DB-fetched answers — client can't influence the score through normal app flow (only via direct API abuse, see Critical #2) | `SOURCE/app/(layer2)/actions.ts` (`submitExam`) |
| Author ownership | Every Layer 4 action re-verifies `author_id = user.id` in application code AND is backed by RLS | `SOURCE/app/(layer4)/actions.ts` |
| XSS in question content | Properly hardened, backed by regression + dedicated XSS tests | `SOURCE/components/shared/RichText.tsx` |
| Error handling | Internal errors logged server-side only; generic messages returned to users | throughout Server Actions |
| RLS test harness | `test-rls.ts` runs real two-user isolation tests against a real Postgres instance — most solo projects skip this entirely | `SOURCE/supabase/test-rls.ts` |

---

## Progress log (updated 2026-08-03)

| # | Item | Severity | Code | Database | State |
|---|---|---|---|---|---|
| 1 | Answer key readable pre-submit | 🔴 Critical | done | applied | ✅ closed |
| 2 | Students write own scores | 🔴 Critical | done | applied | ✅ closed |
| 3 | Vulnerable dependencies | 🟠 High | done | n/a | ✅ closed |
| 4 | View bypasses RLS | 🔴 (re-rated) | done | applied | ✅ closed |
| 5 | No security headers | 🟡 Medium | done | n/a | ✅ closed (browser-verified) |
| 6 | Client-side-only timer | 🟡 Medium | done | applied | ✅ closed |
| 7 | No moderation tooling | 🟡 Medium | done | applied | ✅ closed (browser-verified) |
| L1 | Weak password policy | 🟢 Low | done | n/a | ✅ closed |
| L2 | No rate limiting | 🟢 Low | done | n/a | ✅ closed |
| L3 | 35MB body limit | 🟢 Low | done | n/a | ✅ closed |
| L4 | `startAttempt` no published check | 🟢 Low | done | n/a | ✅ closed |

§10–§14 are all applied and verified (2026-08-04). `verify:schema` covers §10–§12
green; `test-rls.ts` is fully green including the newer gates — S-f (overtime
computed server-side, not client-reported) and M-a…M-d (a removed exam can't be
republished, renamed, or deleted by its author, but stays visible to them; the
moderation log is unreadable by anyone but `service_role`). The `getResult()`
embedded join through the rewritten view was re-checked against the real DB
after §12 changed the view's FROM clause — PostgREST still infers
`exam_attempts → exams_with_difficulty`, and community-difficulty aggregates are
still global.

One transient failure surfaced on the first post-DDL run of `test-rls.ts`
(`M-b`, delete-blocked-on-removed) — reproduced in isolation and on a clean
re-run, both passed, consistent with PostgREST's schema cache needing a moment
to pick up freshly dropped/recreated policies rather than an actual gap.

**Nothing remaining.** `/admin`'s Remove/Restore flow has now been driven end
to end in a real browser and confirmed correct — see item #7's STATUS block.

---

## Recommended fix order

1. **Lock the answer columns** (Critical #1) — this is the product's core integrity guarantee.
2. **Tighten `exam_results` insert policy** (Critical #2) — same skill set as #1, do in the same session.
3. **`npm audit fix --force` + re-run full test suite** (High #3) — ~1 hour, removes a live attack path on the upload pipeline.
4. **Set `security_invoker = true` on `exams_with_difficulty`** (Medium #4) — one line, verify first with the `pg_class` query above.
5. **Add security headers** (Medium #5) — one `headers()` block in `next.config.ts`.
6. **Enforce exam duration server-side** (Medium #6).
7. **Build minimal takedown tooling** (Medium #7) — even a password-gated internal page — before accepting public uploads commercially.

Items 1–5 mark the line between "well-built prototype" and "sellable." Item 7 is what stands between the team and a legal exposure once uploads are public.
