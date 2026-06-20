# Voult: MVP Execution Plan
**Based on an audit of the voult-dev GitHub organization | June 2026**

---

## Audit Summary: What Actually Exists

This plan is grounded in what is actually in the repos, not the original brief. The brief undersold your progress — you're further along than "pre-MVP" suggested. Here is the honest state of each re[...]

### `voult` (main API) — 638 commits, 3 open issues

**Implemented and real:**
- Email/password registration and login, with bcrypt hashing
- Username + password auth (added recently)
- JWT auth with token versioning (`tokenVersion`) — this is a correct, non-trivial pattern for revoking all sessions on password change
- Magic link / passwordless authentication, with **atomic token claiming** — this detail matters; naive magic link implementations have a race condition where the same token can be claimed twice, an[...]
- Redirect URI allowlisting for magic links (in progress) — this is the correct defense against open-redirect attacks in magic link flows, and most early-stage clones skip it
- Email verification flow, with login blocked for unverified/disabled accounts
- Password reset (forgot/reset)
- Soft delete and account re-enable
- `/me` endpoint
- CSRF protection via `csurf`, with both a `_csrf` form field path and a `GET /auth/csrf-token` + `X-CSRF-Token` header path for API clients — this is a more complete CSRF implementation than most e[...]
- Rate limiting on sensitive endpoints (login, magic link)
- `eslint-plugin-security` wired in with 11 rules enabled (object injection, unsafe regex, eval detection, timing attack detection, etc.) — this is unusually disciplined for a solo, pre-launch proje[...]
- A `src/secrets/` module: `SecretService` (singleton secret validation/retrieval) and `VersionTracker` (tracks secret rotation dates) — this is infrastructure most companies don't build until after[...]
- Jest test suite with mocks (`__mocks__/`, `tests/`)
- OAuth middleware exists, multi-provider config is explicitly marked "in development"

**Not yet real / explicitly incomplete:**
- OAuth is middleware-only — no provider is fully wired end-to-end yet
- Logout is broken on staging (`- [ ] Logout (staging.voult.dev)` is the only item in `todo.md` right now)
- No MFA
- No account management beyond soft-delete/re-enable (no profile editing, no email change flow visible)
- No webhook system
- No admin dashboard (referenced in landing page copy, not in this repo)

**Open issues (all unstarted, all from the same author):**
- #1 Frontend Revamp & UX Improvements
- #2 Developer Experience (DX) Improvements – V1
- #6 Feature Request: Team Collaboration & Multi-Developer Access

None of these are blocking an MVP. #6 in particular is a v2+ feature — multi-developer team access implies you already have paying teams, which you don't yet.

### `voult-sdk` — 36 commits

This is more complete than the brief suggested. It has:
- A real `VoultClient` class handling session state and HTTP communication
- Both a convenience default export and tree-shakeable named exports
- Custom typed error classes (`ValidationError`, `AuthenticationError`, `AuthorizationError`, `ConflictError`, `AccountLockedError`, `NetworkError`) — this is good API design; generic thrown errors [...]
- Documented password requirements with a client-side validator (`isValidPassword`) so apps can validate before hitting the network
- JSDoc type annotations for IDE autocomplete (not full TypeScript, but functional)
- Three internal planning docs: `SDK_DEVELOPMENT_GUIDE.md`, `SDK_FUNCTIONS_REFERENCE.md`, `SDK_IMPLEMENTATION_GUIDE.md`, plus a `TODO.md`, `mindmap.md`, and `notes.md`

This tells me the SDK was built with actual planning discipline, not improvised. That is a real asset.

**Gap:** the SDK is not published to npm yet (`npm install voult-sdk` is documented but the repo has no published releases — "No releases published" is shown on the repo page). The README also still[...]

### `voult-landing`

Live at voult.dev. Already has real positioning copy: "Bcrypt password hashing, JWT + refresh rotation, CSRF protection, rate limiting, and helmet headers — wired in by default," and a documented fr[...]

### `test-voult-sdk`, `test-voult-axios`

Sandbox/integration-testing repos, used to validate the SDK and raw API calls before building the real SDK surface. Reasonable practice — not something to invest more in.

### `.github`

Org profile README. Reasonably well written, but markets things not yet true ("Core platform services," "Infrastructure tooling," "Experimental projects," "Community resources" as if all exist as sepa[...]

---

## What This Changes From the Original Report

The original due diligence report assumed close to a blank slate. That was wrong on the specifics, right on the structural risks. Revised view:

- You are not pre-MVP in the sense of "nothing built." You are pre-MVP in the sense of "the core is real, but it isn't shippable to a stranger yet" — broken logout, incomplete OAuth, unpublished SDK[...]
- The security discipline already present (CSRF done properly, atomic magic-link claiming, redirect allowlisting, secret rotation tracking, security linting) is genuinely above the bar for a solo pre-[...]
- The actual remaining distance to MVP is smaller than 90 days of from-scratch building. It's closer to: fix what's broken, finish what's half-done, cut what's premature, and package it so a stranger [...]

---

## Execution Plan

Not a fixed 90 days — phases are scoped by what's actually left, with rough time bands. Work through them in order; each phase assumes the previous one is genuinely done, not "mostly done."

---

### Phase 0: Fix What's Broken (3–7 days)

This phase exists because of one fact: **logout is broken on staging right now**, and that is the only thing in your `todo.md`. An auth product where logout doesn't reliably work is not crossable — [...]

Tasks:
1. Fix the staging logout bug. Given the memory of your earlier debugging session, the likely causes are session cookie misconfiguration (`secure`/`sameSite`) or incomplete session destruction (not pr[...]
2. Add a test that specifically logs in, logs out, then attempts to use the old token/session — confirm it's rejected. This is the test that would have caught this bug before staging, and you should[...]
3. Reconcile the SDK README's repo links (`DevOlabode/voult` vs `voult-dev/voult`) so anyone landing there isn't confused about which is canonical.
4. Decide now whether the live waitlist on voult.dev stays or goes — see Phase 3. Don't leave it live by default while you also tell people there's no waitlist.

Exit condition: you can sign up, log in, log out, and confirm the session is actually dead — end to end, with a test proving it.

---

### Phase 1: Close the OAuth Gap (1–2 weeks)

OAuth middleware exists but no provider is fully wired. This is the single feature most likely to make or break early developer trust, because "email/password only" reads as incomplete to anyone evalu[...]

Tasks:
1. Pick exactly two providers: GitHub and Google. This covers the large majority of developer-tool sign-in demand — do not add more yet.
2. Wire one provider fully end-to-end first (authorization code exchange, profile fetch, account linking/creation, session issuance) and write a test for the full flow before starting the second.
3. Handle account linking explicitly: what happens when someone signs up with email/password, then later signs in with Google using the same email? Decide and document the behavior — this is a commo[...]
4. Add the OAuth flow to the SDK with the same typed-error treatment the rest of the SDK already has.

Exit condition: a developer can add "Sign in with GitHub" and "Sign in with Google" to a real app using only the SDK and your docs, with no direct API calls needed.

---

### Phase 2: Make the SDK Installable and Trustworthy (3–5 days)

The SDK is better-built than the brief suggested, but it isn't reachable by `npm install voult-sdk` yet in any verifiable way (no published release).

Tasks:
1. Publish an actual `0.1.0` (or similar pre-1.0) release to npm. Use semantic pre-1.0 versioning honestly — this signals "usable but not yet stable," which is accurate and fine.
2. Add a `CHANGELOG.md` to the SDK repo and start logging every release from this point forward. This becomes one of your strongest trust signals per the original report's findings on developer trust.
3. Resolve the internal planning docs question: `SDK_DEVELOPMENT_GUIDE.md`, `SDK_FUNCTIONS_REFERENCE.md`, `SDK_IMPLEMENTATION_GUIDE.md`, `mindmap.md`, and `notes.md` are useful to you but look like cl[...]
4. Add a minimal integration test that actually installs the published package and runs the documented quick-start against your staging API, so "the README example works" is verified by CI, not just t[...]

Exit condition: a stranger can `npm install voult-sdk`, follow the README exactly, and have working auth in under 10 minutes, with nothing in the repo root that looks unfinished or internal-only.

---

### Phase 3: Decide and Execute the Pre-MVP Site (3–5 days)

You told me you don't want a waitlist. The live site currently has one. This needs to be resolved, not left ambiguous.

Tasks:
1. Remove the waitlist CTA and replace it with a direct path: "Read the docs" / "View on GitHub" / a working signup against the real (not staging) API, gated by the rate limiting and account controls [...]
2. Add the security section the original report recommended: a plain-language explanation of what's hashed, what's stored, what CSRF/session model is used, and a `security@` contact. You already have [...]
3. Add a real, dated changelog page reflecting actual commits — logout fix, OAuth providers landing, SDK publish — as they ship. This turns Phase 0–2 work into visible trust-building in real tim[...]
4. Tighten the `.github` org README so it doesn't claim more maturity ("Infrastructure tooling," "Experimental projects," "Community resources") than a visitor will actually find when they click in.

Exit condition: voult.dev accurately represents what exists, with no feature claimed that isn't true, and no call-to-action that contradicts your stated intent.

---

### Phase 4: Get 5–10 Real Developers to Integrate It (2–4 weeks, runs partly in parallel with Phase 3)

This is the phase that actually tells you whether any of this matters. Everything before this is necessary but not sufficient.

Tasks:
1. Identify 5–10 developers — ideally people building small side projects or hackathon-style apps who need auth and don't have strong existing loyalty to Clerk/Supabase. Personal network, small Di[...]
2. Give them the SDK and docs with no hand-holding beyond what's in the README — if you have to explain it verbally, the docs aren't done.
3. Watch specifically for: where they get stuck, what they assume Voult does that it doesn't, and whether they trust it enough to actually deploy it (vs. just trying it locally).
4. Fix what they hit, in priority order of "blocks integration entirely" > "causes confusion but they work around it" > "cosmetic."

Exit condition: at least 3 of the 5–10 have a real, deployed (even if small) app using Voult in production, not just a local test.

---

### Phase 5: Operational Baseline Before Wider Sharing (1 week)

Before you post this anywhere public (Hacker News, Reddit, etc.), per the original report's findings on what makes developers refuse a new auth provider:

Tasks:
1. Set up a public status page (even a free Better Uptime / status.io page) monitoring the API uptime.
2. Write and publish a one-page responsible disclosure policy and a real `security@` address you'll actually check.
3. Confirm rate limiting and account lockout (`ACCOUNT_LOCKED` is already a defined SDK error — confirm the server side actually triggers and clears it correctly) are tested, not just present in cod[...]
4. Do one honest pass for secrets or credentials accidentally committed anywhere in the org's repo history — you already have a `cookies.txt` file committed to the `voult` repo root, which is exactl[...]

Exit condition: if a stranger finds Voult on Hacker News tomorrow and tries it, the absolute baseline of "what happens when something goes wrong" is answered before they ask.

---

## Sequencing at a Glance

| Phase | Focus | Realistic time | Hard dependency |
|---|---|---|---|
| 0 | Fix staging logout | 3–7 days | None — do this first, unconditionally |
| 1 | GitHub + Google OAuth, fully wired | 1–2 weeks | Phase 0 done |
| 2 | Publish SDK, changelog, clean repo | 3–5 days | Can start once Phase 1 OAuth is in SDK |
| 3 | Fix the live site (remove waitlist, add security page) | 3–5 days | Can run parallel to Phase 1–2 |
| 4 | Real developers integrating it | 2–4 weeks | Phases 0–3 substantially done |
| 5 | Status page, disclosure policy, secrets audit | 1 week | Before any public posting |

Realistic total: **6–10 weeks** of focused part-time work, not 90 days flat and not a fixed deadline — the actual gating factor is Phase 4 feedback, which can compress or extend everything after i[...]

---

## One Direct Note on the `cookies.txt` File

I want to flag this specifically rather than bury it in a checklist: there's a `cookies.txt` file committed at the root of the `voult` repo. This is almost certainly leftover from local `curl`/testing[...]

---

## What Stays Out of Scope (Per the Original Report, Still True)

MFA, team/multi-developer access (issue #6), webhooks, an admin dashboard, RBAC, and anything compliance-related (SOC 2) remain correctly out of scope for this phase. Building them now would be solvin[...]