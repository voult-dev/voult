# Voult: Launch Plan
**For the post-Phase-5 launch window, once Phase 0–5 of the execution plan are genuinely done**

---

## Before Any of This: The Gate

Do not run any part of this plan until the execution plan's Phase 0–5 are actually complete — specifically: logout fixed and tested, the `cookies.txt` issue resolved, OAuth (GitHub + Google) fully wired, the SDK published to npm with a changelog, the live site's waitlist resolved one way or the other, and the status page + disclosure policy live.

This matters because every channel below — Reddit, Hacker News, Discord communities — gives you exactly one good first impression. If someone tries Voult while logout is broken, they don't come back to try it again later. Launching is not a separate event from the execution plan; it's what the execution plan was building toward. Don't compress the order to launch sooner.

---

## Part 1: Getting the First 3–5 Real Developers (Before Any Public Posting)

This is deliberately separate from, and earlier than, public launch. Public posting is for momentum once you have a working product with at least a little proof. These first few users are for finding out if it actually works for someone who isn't you.

### Where to find them

**Your existing network first.** Anyone you know — from school, online communities, Discord servers you're already in — who is building something and needs auth. This sounds obvious but founders skip it because it feels less impressive than "I posted and got 50 signups." It is the highest-quality source of honest feedback you have, because they already have some baseline trust in you and will actually tell you what's wrong instead of disappearing silently.

**Small, specific Discord/Slack communities for indie devs and hackathon builders.** Not big general-purpose servers — ones organized around building things (indie hacker communities, hackathon Discords, "100 days of code" type groups). Post in the right channel (usually something like #show-and-tell or #feedback, never general chat) with a short, honest framing: "I built an auth API as a side project, looking for 3-5 people to try integrating it into something real and tell me what breaks." Being upfront that you want harsh feedback, not praise, gets you better responses than a polished pitch.

**People building something this week, not "developers" broadly.** Someone with an active project who needs auth right now is far more likely to actually integrate something than someone with no current need. Hackathon participants, people in "build in public" threads, and recent bootcamp grads building portfolio projects are good targets because they need auth on a short timeline and have lower switching costs than someone with an existing production app.

### What to send them

Not a generic "check out my app" message. Send something with three parts:
1. What it is, in one sentence, with zero marketing language: "An auth API — email/password and magic links, GitHub/Google OAuth — I built from scratch, looking for real feedback before I post it publicly."
2. What you want from them, specifically: "Could you try integrating it into [their actual project] and tell me where it's confusing or where it breaks? Should take under 15 minutes if the docs are good — if it takes longer, that's exactly the feedback I need."
3. A direct way to reach you — not a contact form, your actual Discord handle or email, so friction to report a problem is near zero.

### How to actually get legitimate feedback, not just politeness

People are bad at giving critical feedback to someone who built something themselves, especially a known acquaintance. Counter this directly:

- Ask specific questions, not "what do you think?" — "Where did you get stuck?" "What did you expect to happen that didn't?" "Would you trust this with a real user's password today?" Specific questions get specific answers; open questions get "looks good!"
- Watch them use it live if you can (screen share, or sit with them) at least once. What people say afterward and what you watch them struggle with in real time are often different things — people forget or downplay friction once they've solved it.
- Treat silence as a data point. If someone you sent it to never tries it, that's information about how compelling the ask was, not bad luck. Follow up once, gently, then let it go.
- Explicitly tell them you want the harsh version. Say "please don't be nice about this" out loud. Most people default to encouragement unless told otherwise.

---

## Part 2: What to Fix Before Public Posting

Whatever the 3–5 developers find, fix the blocking issues before Part 3. A public post amplifies whatever state the product is in — broken things get noticed faster in public than in private.

---

## Part 3: Public Launch Channels

Ranked by fit for an early-stage, solo-built auth API specifically — not a generic "best channels" list.

### Hacker News (Show HN) — highest ceiling, do this once you're genuinely ready

This is the single highest-leverage channel for a developer tool, and also the least forgiving of a weak product or weak post.

**What makes a Show HN post work, based on how the format actually performs:** the title needs to be precise and undersold, not punchy. The pattern that performs is "Show HN: [Name] – [precise, technical description]," not a tagline. The repo link, not the landing page, should be what you submit — a GitHub link signals it's an actual working product, not a marketing page, and HN's audience reads that signal correctly.

**For Voult specifically, a title like:**
`Show HN: Voult – an auth API I built from scratch (JWT, magic links, OAuth, CSRF)`

Avoid: superlatives, "the next Supabase," "revolutionary," or anything that reads as a pitch. HN admins' own guidance is to talk to the audience as fellow builders, avoid superlatives like fastest/biggest/first/best, and treat modest language as the stronger choice.

**In the post body:** explain what it actually is, what's real today (be honest that OAuth covers two providers, not twenty; that it's young; that you're a solo builder), what specifically you want feedback on, and link the repo. The single underlying truth of HN performance is that there's no real hack beyond making something people genuinely want to engage with — the post format just gets out of the way of that.

**Timing:** Tuesday or Wednesday morning tends to perform better than weekends, though this varies and isn't worth over-optimizing — a good post on an average day beats a weak post on a perfect day.

**Be present for the comments.** This is not optional. HN's value isn't the traffic spike, it's the brutal, specific technical feedback in the comments. When criticized, find something to agree with first, even if it's just the positive intent behind the comment, before responding. Answer every technical question honestly, including "no, that's not built yet."

**Be honest about your age and stage if it comes up.** Don't lead with it as a hook ("teen builds X" reads as a stunt to this audience), but if someone asks or it's relevant, answer plainly. HN respects genuine technical work regardless of who built it, and respects honesty more than a polished narrative.

### Reddit: r/SideProject

The most self-promotion-friendly of the relevant subreddits, but it still rewards a specific format over a bare link. A bare link to a landing page won't get traction — the post needs to tell the story of what you built, why, what stack you used, and what feedback you want. The community respects shipping over planning and responds well to honest metrics and technical detail rather than polished marketing copy.

**Format that works:** "I built an auth API from scratch — here's what's in it and what I'm still figuring out." Include your actual stack (Node/Express/MongoDB), mention the security details that are genuinely good (CSRF handling, atomic magic link claiming), and ask a specific question, not "thoughts?" — e.g., "would the OAuth-only-on-two-providers limitation be a dealbreaker for you?"

Weekend mornings tend to see the highest engagement on this subreddit specifically, which is a different timing pattern than HN — don't post both on the same schedule logic.

### Reddit: r/webdev

Larger audience, stricter about self-promotion — check current pinned rules before posting, as they change. The reliable way in is a "Showoff Saturday" or equivalent weekly thread if the subreddit still runs one, rather than a standalone post, which is more likely to get removed as promotional.

### Discord/Slack indie-dev and hackathon communities

Lower reach per post than HN or Reddit, but much higher trust-to-effort ratio, and this is where your earlier Part 1 outreach already built some relationships. A short, honest "I'm launching this publicly today, here's what changed since you tried it" follow-up to the people who already gave you feedback is both a courtesy and a way to get a few more genuine early users.

### What's not worth your time right now

Product Hunt (developer-tool audience there is thin and the format rewards polish over substance, which isn't where your current advantage is), cold outreach to strangers, paid ads of any kind, and X/Twitter unless you already have an audience there — building one from zero in parallel with everything else is a separate, slow project, not a launch channel.

---

## Part 4: What to Actually Post — Content, Not Just Channel

The same underlying content should flex slightly per channel, but the substance should be consistent and honest everywhere:

**What it is:** an authentication API — not "the next Supabase," not "authentication done right" — specific: email/password, magic links with atomic claiming, GitHub/Google OAuth, JWT with session revocation, CSRF protection on both form and API paths.

**Why you built it:** the real reason, briefly. Started as a learning project, became something you wanted to make genuinely good. Don't manufacture a more dramatic origin story than the true one — the true one (a self-taught student building something real) is already a good story, and an invented one will read as fake to a technical audience that's good at detecting that.

**What's NOT done yet:** say this explicitly and early in the post, not buried. MFA isn't built. Only two OAuth providers. No team/multi-developer access yet. This isn't weakness — undersized claims followed by a product that overdelivers relative to the post beats the opposite, and HN/Reddit's technical audiences specifically reward founders who are upfront about limitations over those who oversell.

**What you want from them:** be explicit per channel — HN wants technical critique, r/SideProject wants product/UX feedback and encouragement mixed with critique, Discord communities want hands-on testers.

**Where to send them:** the GitHub repo as primary link (per the HN guidance above, this applies broadly — a repo signals "real" more than a landing page does), with the live docs/site as secondary.

---

## Part 5: Receiving Feedback Without Drowning or Dismissing It

Once posts are live, feedback will arrive faster than you can act on it. A system matters more than good intentions here.

**Triage in three buckets, same day if possible:**
1. Blocking bugs (auth doesn't work, data loss risk, security concern) — fix or acknowledge within hours, not days.
2. Friction/confusion (docs unclear, error messages unhelpful, setup took too long) — log these, fix in priority order over the following days.
3. Feature requests (MFA, more OAuth providers, teams) — log these, do not act on them yet. Per the execution plan, these are correctly out of scope for this stage; the volume and pattern of requests is useful signal for what to build next, not a queue to start working through immediately.

**Respond to everyone who took the time to report something**, even just "thanks, logged this, will look into it" — people who get acknowledged are far more likely to test the fix and stay engaged than people who get silence.

**Keep the changelog public and updated in real time during this period.** When someone reports a bug and you fix it within a day, that fix showing up in a dated changelog entry is one of the strongest trust signals available to a brand-new product — it's proof of active maintenance that the original due diligence report flagged as a key trust factor.

**Don't take a defensive posture in public threads**, even when a critique feels unfair or misinformed. Finding something to agree with first, even just the positive intent, before responding to criticism keeps the thread useful and keeps you looking like someone worth trusting with other people's user data — which, for an auth company specifically, is the entire point of how you come across in public.

---

## Sequencing Summary

| Step | What | Gate to move forward |
|---|---|---|
| 1 | Finish execution plan Phases 0–5 | All genuinely done, not "mostly" |
| 2 | Recruit 3–5 developers privately (network, small Discords) | At least 3 have actually integrated it |
| 3 | Fix what they found | Blocking issues resolved |
| 4 | Show HN post | Confident in the product surviving technical scrutiny |
| 5 | r/SideProject post (can run near-simultaneously with HN, different timing) | Same |
| 6 | r/webdev (via appropriate weekly thread) | Ongoing, lower priority |
| 7 | Triage and respond to all feedback, update changelog publicly | Continuous |

Do not skip step 2 to get to step 4 faster. The private round is what prevents the public round from being where you find out logout is still broken.