# Founding Member Launch Plan

> Source of truth for the Founding Member pricing tier launching alongside the desktop in-app announcement.
> Captures decisions, copy, consent language, code-level changes, and phased rollout.

---

## Context

GimmeJob currently ships two pricing tiers (`lib/stripe/constants.ts`):

- **Free** — $0
- **Pro** — $39/mo or $348/yr ($29/mo equivalent, 26% savings)

The desktop submission engine is launching in-app this week. The product needs:

1. Cash now to fund continued development of the desktop model + in-app integration.
2. Real-world testers for the desktop submission engine across diverse ATSes (Workday, Greenhouse, Ashby, Lever, etc.).
3. A community of believers who will give feedback, file bug reports, and evangelize.

**Solution:** a time-limited and seat-capped "Founding Member" tier — a one-time payment that bundles lifetime Pro access, pre-release desktop access, and private community access. A *separate*, *optional*, *non-payment-conditional* opt-in lets Founders contribute application data to internal model training.

This is a **pilot**, not permanent pricing. It launches with the LinkedIn announcement, runs until either the seat cap fills or the time window closes, then never reopens.

---

## Decisions

| Decision | Value | Rationale |
|---|---|---|
| Tier name | "Founding Member" | Never use "investment" / "investor" / "equity" — Howey-test risk |
| Price | $499 one-time | Round number, ~14 months of Pro yearly equivalent, feels like a deal |
| Cap | 100 seats OR 30 days, whichever first | Hard cap on both. Never reopens. |
| Stripe mode | One-time payment (new Price object) | Current setup is subscription-only |
| Data contribution | Separate opt-in inside the program | NOT a payment condition |
| Community | Private Discord (or Slack) | Recommend Discord — better for product communities |
| Refund policy | 14 days, no questions; after that, no refunds | Standard for one-time-deal products |
| Badge | "Founding Member" badge in-app profile | Status signal, social proof |

---

## Open decisions

- **Flat $499 vs tiered ladder** ($299 → $499 → $799 as seats fill). Flat is simpler; tiered creates urgency.
- **Community platform**: Discord vs Slack vs email list. Recommend Discord.
- **Pre-release liability**: clear language that the desktop agent is alpha, real applications are at stake, use at own discretion.

---

## Marketing copy

### Hero — `app/(marketing)/founding/page.tsx` (new)

> # Founding Member Pass
>
> One payment. Lifetime Pro. Early access to the desktop agent. A seat at the table while we build the future of job applications.
>
> **100 seats. Closes when full or in 30 days.**
>
> [ Join the Founding 100 — $499 ]

### Sub-hero / pitch

> Most products charge you forever. This isn't most products. GimmeJob is being built in public, with a small group of people who get it: the job application process is broken, employers have used AI to filter candidates for a decade, and AI-assisted automation is how candidates take that asymmetry back.
>
> Become a Founding Member, get GimmeJob free for life, and help shape what comes next.

### What's included

- **Lifetime Pro access.** Everything in the Pro plan, forever, at $0 ongoing.
- **Desktop agent — pre-release.** The desktop app submits applications end-to-end. You get it first.
- **Private Founder channel.** Direct line to the founder. Weekly updates. Feature voting. Roadmap influence.
- **Founding Member badge.** Shown on your profile in-app.
- **Right of first refusal** on future programs (recruiter pull portal, verified profile credential).

### Honest list (sits below "What's included")

- Pre-release software. Things will break. We'll fix them fast, but bring patience.
- Real applications. Real money. Use the desktop agent on roles you'd genuinely apply to.
- Active feedback loop. We'll ask what's working. Quietly using it is fine; engaging is rewarded.
- Pricing changes after the cap. Standard pricing resumes; this offer never returns.

### Optional data contribution section

> ### Help train the model (optional)
>
> Founding Members can opt in to contribute anonymized application data to model training. **Opting in doesn't change your price or access.** You control:
>
> - What gets contributed (per-application toggle)
> - What stays out (sensitive answers, EEO fields, specific employers)
> - When to stop (revoke contribution any time)
>
> You're not paying us to take your data. You're choosing to make the product better, faster.

### Pricing page update — banner above existing tiers

`app/(marketing)/pricing/pricing-cards.tsx`

> 🟢 **Founding Member program now open** — 100 seats, lifetime Pro + pre-release desktop access, $499 one-time. [Learn more →](/founding)

### Homepage section (above CTA)

`app/(marketing)/components/landing/founding-member-section.tsx` (new)

> ### The first 100
>
> The Founding Member program is open. Lifetime Pro, pre-release desktop access, and a seat in our private build channel — for one payment. Closes when full or in 30 days.
>
> [ See the Founding Member Pass → ]

---

## Consent language (training data opt-in)

This sits in the in-app Settings, separate from the founding-member checkout flow. Default OFF. User must actively toggle on.

### Short form (UI toggle)

> **Help train the GimmeJob model**
>
> Contribute anonymized application data to improve job-fit scoring, field mapping, and reply classification. Used only by GimmeJob, never sold, never sent to third parties for training. Revocable any time.
>
> [ Show me what's included → ]

### Detailed disclosure (modal opened from the toggle)

> **What you're contributing**
>
> - Job postings you've applied to (already public)
> - Answers you provided to application questions
> - Outcome events tied to those applications (interview invite, rejection, etc.)
> - Replies received in your GimmeJob inbox, with sender redacted
>
> **What stays private**
>
> - Your résumé content (separate toggle required)
> - Identifying details — your name, email, exact employers are removed or hashed before training
> - Any application you mark "private" in your dashboard
>
> **How it's used**
>
> - Training and fine-tuning GimmeJob's internal models (job-fit, reply classification, field mapping, closed-posting detection)
> - Internal evaluation and accuracy testing
>
> **What doesn't happen**
>
> - Your data is never sold
> - Your data is never sent to a third-party model provider for training
> - Other users never see your individual application data
>
> **Your controls**
>
> - Pause contribution at any time from Settings
> - Delete your raw contributed data (data already used in completed training runs cannot be retroactively removed from those model weights, but no new data flows after deletion)
> - Per-application exclusion toggle
>
> [ I've read this and want to contribute ]

### ToS addition (legal)

Add to Terms of Service or as a separate "Data Contribution Agreement":

> **Founding Member Program — Data Contribution Terms**
>
> If you opt in to data contribution, you grant GimmeJob a non-exclusive, royalty-free, revocable license to use the specified data for the sole purpose of training, evaluating, and improving GimmeJob's internal machine learning models. You retain ownership of your data. Contribution can be revoked at any time via your account settings, after which no new data will be included in training. Data already used in completed training runs cannot be retroactively removed from those model weights, but you may request deletion of your raw contributed data from our records. We do not sell your data, transfer it to third parties for training purposes, or expose individual application data to other users.

---

## Code-level changes

### `lib/stripe/constants.ts` — extension

```ts
// Add alongside existing PRICING

export const FOUNDING_MEMBER = {
  amount: 499,
  display: '$499',
  oneTime: true,
  capSeats: 100,
  closesAt: '2026-06-15T00:00:00Z', // set on launch day
} as const;

// Extend PLANS

export const PLANS = {
  PRO: { /* ...existing */ },
  FOUNDING: {
    name: 'GimmeJob Founding Member',
    productId: process.env.STRIPE_FOUNDING_PRODUCT_ID!,
    priceId: process.env.STRIPE_FOUNDING_PRICE_ID!,
    features: [
      'AI-Guided Job Application Assist',
      'Automated Application Submission',
      'Advanced Resume Optimization',
      'Priority Job Matching',
      'Desktop Agent (Pre-Release)',
      'Founding Member Badge',
      'Private Founder Channel Access',
    ],
  },
} as const;

// New feature flag set

export const FOUNDING_FEATURES = [
  ...PRO_FEATURES,
  'desktop_agent_prerelease',
  'founding_member_badge',
  'private_channel_access',
] as const;

export type FoundingFeature = (typeof FOUNDING_FEATURES)[number];
```

### Prisma schema additions

```prisma
model User {
  // ...existing fields

  isFoundingMember         Boolean   @default(false)
  foundingMemberJoinedAt   DateTime?
  foundingMemberSeatNumber Int?      @unique // 1..100, optional badge detail

  contributesTrainingData    Boolean   @default(false)
  trainingDataConsentAt      DateTime?
  trainingDataConsentVersion String?   // store which version of the consent language they agreed to
}

model ApplicationSubmission {
  // ...existing fields

  excludeFromTraining Boolean @default(false)
}

model FoundingMemberSeatCounter {
  id            String   @id @default(cuid())
  // singleton row — use a fixed id like "global"
  seatsTaken    Int      @default(0)
  capSeats      Int      @default(100)
  closesAt      DateTime
  lastUpdatedAt DateTime @updatedAt
}
```

### Stripe webhook handler

Extend the existing handler to:

1. On `checkout.session.completed` where `mode: payment` and `price.id === STRIPE_FOUNDING_PRICE_ID`:
   - Increment `FoundingMemberSeatCounter.seatsTaken` atomically
   - Mark `User.isFoundingMember = true`
   - Set `User.foundingMemberJoinedAt`
   - Send welcome email + Discord invite link

2. Before creating the Checkout Session, check seat counter — refuse with a 409 if cap reached.

### Server-side cap enforcement

```ts
// app/api/founding/checkout/route.ts (new)
// Pseudo-code outline:
// 1. Validate user is authenticated
// 2. Read FoundingMemberSeatCounter atomically
// 3. If seatsTaken >= capSeats OR Date.now() > closesAt → return 409 "Program closed"
// 4. Create Stripe Checkout Session in `payment` mode with FOUNDING price
// 5. Return checkout URL
```

The actual seat increment happens in the webhook, not at checkout creation, to avoid race conditions on abandoned checkouts.

### New marketing routes

- `app/(marketing)/founding/page.tsx` — main landing
- `app/(marketing)/components/landing/founding-member-section.tsx` — homepage strip
- Banner update on `app/(marketing)/pricing/page.tsx`

### Feature-gating check

Wherever the existing Pro check lives (likely a helper like `userHasFeature(user, feature)`), add a branch: if `user.isFoundingMember === true`, grant all `FOUNDING_FEATURES`.

---

## Phased rollout

### Phase 1 — Marketing surface only (ship today)

- New `/founding` page with hero, included, honest list, optional contribution section
- Banner on `/pricing`
- Homepage section
- Sign-up button → waitlist endpoint (no payment yet)

Goal: announce on LinkedIn, gauge signal, confirm demand before building the rest.

### Phase 2 — Payment + access (within a week)

- Create Stripe one-time Price in dashboard, set `STRIPE_FOUNDING_*` env vars
- Add `FOUNDING_MEMBER` constants + `PLANS.FOUNDING`
- Apply Prisma migration for `User` fields and `FoundingMemberSeatCounter`
- Build `/api/founding/checkout` + extend Stripe webhook
- Wire feature gating
- Build in-app Founding Member badge UI
- Replace waitlist button with real checkout

### Phase 3 — Data contribution (week 2)

- Apply Prisma migration for `contributesTrainingData`, `trainingDataConsentAt`, `excludeFromTraining`
- Build Settings UI for opt-in/opt-out with the detailed disclosure modal
- Build per-application exclusion toggle in the application dashboard
- Stand up the data-export pipeline that respects consent flags
- Publish data-handling documentation page

### Phase 4 — Private community

- Stand up Discord (recommended) or Slack
- Auto-invite on founding-member signup via webhook
- Channels: `#announcements`, `#feedback`, `#desktop-agent`, `#show-and-tell`, `#founder-updates`

---

## Risk register

| Risk | Mitigation |
|---|---|
| Lifetime obligation if product takes off | Hard cap (100). Never reopens. Don't reopen the offer under pressure later. |
| Legal exposure on "investment" framing | Use "Founding Member" everywhere. No "investment" / "ROI" / "stake" / "equity" language. |
| GDPR/CCPA exposure on training data | Separate opt-in, per-application controls, revocation, documented retention. Versioned consent. |
| Pre-release desktop breaks real applications | Explicit expectation-setting in marketing copy. Per-submission confirm step in desktop UI. |
| Refund demands beyond policy | Publish 14-day refund window upfront. After that, no refunds, no exceptions. |
| Founding members feel ripped off if product stalls | Active community engagement. Transparent roadmap. Weekly updates. |
| Negative LinkedIn discourse on "selling early access" | Lead with builder narrative. Be honest about what they're paying for. |
| Stripe one-time payment + ongoing access mismatch | Founding-member status is a permanent flag on User, not a recurring subscription state. Document this clearly. |

---

## Decisions log

Append to this section as decisions get made.

- *(initial)* Tier launches alongside desktop in-app announcement on LinkedIn.
- *(initial)* Pricing: $499 flat (not tiered).
- *(initial)* Cap: 100 seats OR 30 days, whichever first.
- *(initial)* Community: Discord.
- *(initial)* Refund: 14 days, then never.

---

## Handoff prompt — paste into a new Claude Code session

```
I'm working on GimmeJob's Founding Member launch. The full plan, marketing copy,
consent language, code changes, and phased rollout are documented in
docs/founding-member-launch.md. Read that file before doing anything.

Today's task: [describe specific task]

Constraints:
- Never use the word "investment" in user-facing copy
- Data contribution opt-in must stay separate from payment flow
- 100-seat hard cap is non-negotiable
- Pre-release desktop messaging must include the "real applications, real money"
  expectation-setting language

Do not modify lib/stripe/constants.ts, the Prisma schema, or any Stripe webhook
handler without confirming the exact change with me first.
```
