# ADR-0017 `/about` Admission to PUBLIC_PATHS

## Status

Accepted — 2026-08-17. Resolves PRD `docs/prd/profile-and-about-prd.md` R11 / AC-062 through AC-066 (the `/about` route must be reachable without a session).

- PRD: `docs/prd/profile-and-about-prd.md` — R10 (public static contact page), R11 (allowlist + test + robots + sitemap change).
- Constraint being amended: `SOURCE/lib/supabase/middleware.ts:9-37` (`PUBLIC_PATHS` and its header comment), asserted by `SOURCE/lib/supabase/__tests__/publicPaths.test.ts:21-47`.
- Constraint's origin: `docs/prd/subscription-prd.md` AC-032 and AC-038.
- Related but NOT resolved here: ADR-0014 (payOS webhook trust boundary) is referenced by the existing comments but has never been written.

## Context

`PUBLIC_PATHS` is not an ordinary configuration array. It is a **counted security constraint** with an automated gate, and both the array's header comment and its test file say so in as many words.

The array today is exactly:

```ts
export const PUBLIC_PATHS = ["/", "/login", "/auth/callback", "/terms", "/refund-policy"];
```

Everything not matching it, for a request with no session, is redirected to `/?auth=signin` (`middleware.ts:115-120`). Matching is equality-or-segment-prefix, so `/terms` covers `/terms/abc` but deliberately not `/terms-of-service`.

Three coupled artifacts each carry a comment stating they must track this list:

- `SOURCE/lib/supabase/__tests__/publicPaths.test.ts:22-32` asserts the array by exact value and pins the count, with a header comment reading: *"Một mục thứ tư lọt vào đây phải là một quyết định mới, không phải hệ quả tình cờ của một PR nào đó."* (A fourth entry slipping in here must be a new decision, not the incidental consequence of some PR.)
- `SOURCE/app/robots.ts:14-16` — the disallow list must cover every non-public route.
- `SOURCE/app/sitemap.ts:8-15` — must list the readable public pages, with `/login` and `/auth/callback` as documented omissions.

The complication is arithmetic, not policy. Subscription PRD AC-032 budgeted **exactly six** entries for the whole subscription feature — the five present today plus one future payOS webhook, which is described as "đúng 1 mục cho phép ghi" (exactly one write-permitting entry). The test pins 5 *now* and its comment explains that 6 arrives with the backend phase. `/about` would take the count to 6 **before** the webhook lands, so the assertion "6 total, 1 of them a write path" would be satisfied by the wrong six. Adding `/about` silently would leave a security invariant whose stated meaning no longer matches what it counts.

The alternative — gating `/about` behind login — is not viable on the merits. It is a contact page whose entire audience is people who do not yet have an account: a prospective student, a parent checking who runs the site, someone who needs the phone number because they cannot sign in. A login-walled About page is the one configuration that fails everyone it exists for. The PRD's final check also states outright that `/about` performs no auth check.

## Decision

**Admit `/about` to `PUBLIC_PATHS` as a read-only entry, and re-state the counted constraint in terms of write-permitting entries rather than total entries.**

The array becomes six entries, with `/about` carrying its own inline reason comment per the file's stated convention. The test is updated to assert the new exact array, and — the substantive part — its prose is rewritten so the invariant it guards is the one that actually matters:

- **Before:** "exactly 6 entries, exactly 1 of which permits writes" (total count is load-bearing).
- **After:** "exactly 0 write-permitting entries today; the payOS webhook of ADR-0014 will be the first and, at that point, the only one." Total count becomes descriptive, pinned by the exact-array assertion, rather than the thing the security claim rests on.

This is a strictly stronger invariant. The number of entries is a proxy the original author reached for; the property they were protecting is that no unauthenticated **write** path exists without a deliberate decision. Counting reads and writes together made a read-only marketing page indistinguishable from a webhook. Separating them means the next `/about`-shaped addition is a routine one-line change, while the next webhook-shaped addition still stops a reviewer cold — which is what the gate was built for.

### Decision Details

| Item | Content |
|------|---------|
| **Decision** | `/about` joins `PUBLIC_PATHS` as entry six. The test's counted claim is restated as a count of write-permitting entries (currently zero), not of total entries. |
| **Why now** | The page cannot ship otherwise: without the entry, signed-out visitors — the entire audience — are bounced to `/?auth=signin`, and the developer, being signed in, sees the page work perfectly. That is a failure with no in-app symptom, which is exactly the class of bug this allowlist's tests exist to catch. |
| **Why this framing** | AC-032's "exactly 6, exactly 1 write" was written when every entry was a read path and the webhook was the only anticipated addition. It conflates two different risks under one number. Restating it as a write count preserves the real guarantee, survives further read-only public pages, and keeps the webhook addition as conspicuous as it was. |
| **Scope guard** | `/about` is a **read** path. It performs no data fetching, no auth check, and exposes no Server Action. It must never grow a form that posts. If it ever needs one, that is a new decision under the restated invariant, not a quiet extension of this one. |
| **Naming hazard** | Matching is per-segment, so the entry must be exactly `/about`. A page later added at `/about-us` would NOT be covered and would silently redirect signed-out visitors; the test already pins this class of mistake for `/terms-of-service` and should gain the equivalent case for `/about`. |
| **Kill criteria** | If AC-032's total-count framing turns out to be load-bearing for something not visible in the repository — an external compliance claim, a review checklist held elsewhere — revert to the total-count assertion and give `/about` its own separate justification line, accepting that the count reads 6-now / 7-later. Nothing in the code depends on the number itself. |

## Consequences

- `SOURCE/lib/supabase/middleware.ts:26-37` gains `/about` with an inline reason comment, and the header comment's "đúng 6 mục, đúng 1 mục cho phép ghi" sentence is rewritten to the write-count framing.
- `SOURCE/lib/supabase/__tests__/publicPaths.test.ts` — the exact-array assertion and the describe-block prose are both updated. Add `expect(isPublic("/about-us")).toBe(false)` alongside the existing `/terms-of-service` case, since `/about` is a short and easily-extended prefix.
- `SOURCE/app/sitemap.ts` gains `/about`. Absent it, the page is publicly reachable but invisible to search — a failure with no in-app symptom, per that file's own comment.
- `SOURCE/app/robots.ts` — no disallow entry (the page is meant to be indexed); `/profile` **does** gain one, since that file's rule is that the disallow list tracks every non-public route.
- The page must declare `alternates: { canonical: "/about" }`. The root layout defaults canonical to `/` (`SOURCE/app/layout.tsx:52`), so omitting it makes `/about` declare itself a duplicate of the homepage — visible only in Search Console. `/terms` and `/refund-policy` both re-declare theirs for this reason.
- **Link surface is unresolved and deliberately deferred.** `NAV_ITEMS` is capped at five on purpose (`SOURCE/lib/nav/items.ts:20-21`, `BottomNav.tsx:18-20`: cell position is muscle memory and must not shift with auth state), and the repository has no footer component. `/about` therefore ships reachable by URL and via the sitemap, with no in-app link for signed-out visitors. Creating a link surface — most plausibly a footer, which would be a new shared component — is out of scope for this change and should be tracked separately.
