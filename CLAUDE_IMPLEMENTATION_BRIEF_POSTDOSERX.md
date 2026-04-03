# Claude implementation brief: PostDoseRx — Stripe checkout → Google OAuth → GoHighLevel

**Share this entire file with Claude** when implementing auth for **postdoserx.com**.

---

## Instructions for the implementing agent

1. **Stack assumption**: Next.js (Pages Router) with **NextAuth.js** (Google provider), **Stripe** (Checkout subscriptions), **GoHighLevel** (LeadConnector API v2).

2. **User journey** (must match exactly):
   - User chooses a **paid plan** on `/pricing` (or equivalent).
   - User completes **Stripe Checkout** **before** any login (no session required).
   - After payment, user lands on **`/auth/after-checkout?session_id=...`**.
   - User clicks **Sign in with Google**.
   - On successful OAuth, create or update a **GHL contact** with tag **`postdoserx-plan-{plan}`** where `{plan}` comes **only** from verified Stripe data (metadata / session retrieve / webhook), **never** from client query params.

3. **Security rules**:
   - Do **not** pass `?plan=` in URLs after checkout for authorization decisions.
   - Verify Stripe webhooks with **`STRIPE_WEBHOOK_SECRET`** and **raw body**.
   - Store “pending plan” keyed by **normalized checkout email** until OAuth; match **Google account email** to that record.

4. **Implementation order**:
   - Add env vars (section below).
   - Add `lib/postdoserx/pending-plan-store.ts` (dev) **or** DB layer + SQL migration (prod).
   - Add `lib/postdoserx/ghl.ts` (search + create contact).
   - Add `pages/api/stripe/create-checkout-session.ts`.
   - Add `pages/api/stripe/webhook.ts` with `bodyParser: false`.
   - Add `pages/auth/after-checkout.tsx` (verify session + backup `setPendingPlan`).
   - Wire pricing UI to POST checkout API, then `window.location = url`.
   - Merge **signIn** + **jwt** logic into `pages/api/auth/[...nextauth].ts`.
   - Configure Google OAuth redirect: `https://postdoserx.com/api/auth/callback/google`.
   - Production: replace in-memory store with Postgres (schema at end).

5. **Stripe API version**: Use the same `apiVersion` string as the `stripe` npm package in the target project (do not hardcode an incompatible version).

---

## Environment variables

```bash
NEXTAUTH_URL=https://postdoserx.com
NEXTAUTH_SECRET=<openssl rand -base64 32>

GOOGLE_CLIENT_ID=...apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=...

STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Price IDs for Checkout (create in Stripe Dashboard)
STRIPE_STARTER_MONTHLY_PRICE_ID=price_...
STRIPE_STARTER_YEARLY_PRICE_ID=price_...
STRIPE_PRO_MONTHLY_PRICE_ID=price_...
STRIPE_PRO_YEARLY_PRICE_ID=price_...

GHL_API_KEY=pit_...
GHL_LOCATION_ID=...
```

**Google Cloud Console** (OAuth client for postdoserx.com):

- Authorized JavaScript origins: `https://postdoserx.com`
- Authorized redirect URIs: `https://postdoserx.com/api/auth/callback/google`

---

## GHL tag convention

- `postdoserx-plan-{plan}` — e.g. `postdoserx-plan-starter`, `postdoserx-plan-pro`
- `postdoserx-oauth-signup`
- `postdoserx-stripe-checkout-first`

---

## File: `lib/postdoserx/pending-plan-store.ts`

*(Dev-only; replace with DB in production.)*

```typescript
type PendingEntry = {
  plan: string;
  billingCycle?: string;
  stripeSessionId: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  createdAt: number;
};

const store = new Map<string, PendingEntry>();
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function setPendingPlanFromCheckout(
  email: string,
  data: Omit<PendingEntry, 'createdAt'>
) {
  store.set(normalizeEmail(email), { ...data, createdAt: Date.now() });
}

export function consumePendingPlan(email: string): PendingEntry | null {
  const key = normalizeEmail(email);
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() - entry.createdAt > TTL_MS) {
    store.delete(key);
    return null;
  }
  store.delete(key);
  return entry;
}

export function peekPendingPlan(email: string): PendingEntry | null {
  const key = normalizeEmail(email);
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() - entry.createdAt > TTL_MS) {
    store.delete(key);
    return null;
  }
  return entry;
}
```

---

## File: `lib/postdoserx/ghl.ts`

```typescript
const PLAN_TAG_PREFIX = 'postdoserx-plan-';

export function extractPostdoserxPlanFromTags(tags: string[]): string {
  if (!tags?.length) return 'free';
  const tag = tags.find((t) => t.startsWith(PLAN_TAG_PREFIX));
  if (tag) return tag.replace(PLAN_TAG_PREFIX, '');
  return 'free';
}

export async function searchGHLContact(email: string): Promise<any | null> {
  if (!process.env.GHL_API_KEY || !process.env.GHL_LOCATION_ID) return null;

  const url = new URL(
    'https://services.leadconnectorhq.com/contacts/search/duplicate'
  );
  url.searchParams.set('locationId', process.env.GHL_LOCATION_ID);
  url.searchParams.set('email', email);

  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${process.env.GHL_API_KEY}`,
      Version: '2021-07-28',
    },
  });

  if (!res.ok) return null;
  const data = await res.json();
  return data.contact ?? null;
}

export async function createPostdoserxGHLContact(
  email: string,
  name: string,
  plan: string,
  extra?: {
    stripeSessionId?: string;
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
  }
) {
  if (!process.env.GHL_API_KEY || !process.env.GHL_LOCATION_ID) return null;

  const tags = [
    `${PLAN_TAG_PREFIX}${plan}`,
    'postdoserx-oauth-signup',
    'postdoserx-stripe-checkout-first',
  ];

  const body: Record<string, unknown> = {
    locationId: process.env.GHL_LOCATION_ID,
    email,
    name,
    tags,
    source: 'PostDoseRx — Stripe then Google',
  };

  const res = await fetch('https://services.leadconnectorhq.com/contacts/', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.GHL_API_KEY}`,
      Version: '2021-07-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    console.error(await res.text());
    return null;
  }
  return res.json();
}

// TODO production: implement tag merge on existing contacts (GHL API PUT/PATCH)
export async function updateGHLContactPlanTags(
  _contactId: string,
  _plan: string
): Promise<boolean> {
  return false;
}
```

---

## File: `pages/api/stripe/create-checkout-session.ts`

```typescript
import type { NextApiRequest, NextApiResponse } from 'next';
import Stripe from 'stripe';

// Use the apiVersion required by your installed `stripe` package (see Stripe TS types / dashboard).
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-08-27.basil',
});

type Body = {
  plan: string;
  billingCycle: 'monthly' | 'yearly';
  priceId?: string;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const baseUrl = process.env.NEXTAUTH_URL || 'https://postdoserx.com';
  const { plan, billingCycle, priceId }: Body = req.body;

  if (!plan || !billingCycle) {
    return res.status(400).json({ error: 'plan and billingCycle are required' });
  }

  const priceIdMap: Record<string, Record<string, string | undefined>> = {
    starter: {
      monthly: process.env.STRIPE_STARTER_MONTHLY_PRICE_ID,
      yearly: process.env.STRIPE_STARTER_YEARLY_PRICE_ID,
    },
    pro: {
      monthly: process.env.STRIPE_PRO_MONTHLY_PRICE_ID,
      yearly: process.env.STRIPE_PRO_YEARLY_PRICE_ID,
    },
  };

  const resolvedPriceId = priceId || priceIdMap[plan]?.[billingCycle];
  if (!resolvedPriceId) {
    return res.status(400).json({ error: 'Invalid plan or price not configured' });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: resolvedPriceId, quantity: 1 }],
      success_url: `${baseUrl}/auth/after-checkout?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/pricing?canceled=1`,
      metadata: { plan, billingCycle, source: 'postdoserx' },
      subscription_data: {
        metadata: { plan, billingCycle, source: 'postdoserx' },
      },
    });

    return res.status(200).json({ url: session.url, sessionId: session.id });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Checkout failed';
    console.error(message);
    return res.status(500).json({ error: message });
  }
}
```

**Note:** If TypeScript errors on `apiVersion`, change the string to match your project’s `stripe` package (see `node_modules/stripe/types/lib.d.ts` or existing Stripe usage in the repo).

---

## File: `pages/api/stripe/webhook.ts`

```typescript
import type { NextApiRequest, NextApiResponse } from 'next';
import Stripe from 'stripe';
import { setPendingPlanFromCheckout } from '@/lib/postdoserx/pending-plan-store';

export const config = { api: { bodyParser: false } };

// Use the apiVersion required by your installed `stripe` package (see Stripe TS types / dashboard).
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-08-27.basil',
});

async function buffer(req: NextApiRequest): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!sig || !webhookSecret) {
    return res.status(400).json({ error: 'Missing signature or webhook secret' });
  }

  let event: Stripe.Event;
  try {
    const rawBody = await buffer(req);
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Invalid signature';
    return res.status(400).send(`Webhook Error: ${msg}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const email =
      session.customer_details?.email || session.customer_email || null;
    const plan = session.metadata?.plan as string | undefined;

    if (email && plan) {
      setPendingPlanFromCheckout(email, {
        plan,
        billingCycle: session.metadata?.billingCycle,
        stripeSessionId: session.id,
        stripeCustomerId: session.customer?.toString(),
        stripeSubscriptionId: session.subscription?.toString(),
      });
    }
  }

  return res.status(200).json({ received: true });
}
```

**Path alias:** If the project has no `@/` alias, change the import to a relative path.

---

## File: `pages/auth/after-checkout.tsx`

```typescript
import { GetServerSideProps } from 'next';
import Stripe from 'stripe';
import { setPendingPlanFromCheckout } from '@/lib/postdoserx/pending-plan-store';

type Props = { sessionId: string | null; error: string | null };

export default function AfterCheckout({ sessionId, error }: Props) {
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-2xl font-bold">Payment received</h1>
      <p className="text-gray-600 text-center max-w-md">
        Continue with Google to finish setting up your account. Use the{' '}
        <strong>same email</strong> you used at checkout so we can link your plan.
      </p>
      <a
        href={`/api/auth/signin/google?callbackUrl=${encodeURIComponent('/dashboard')}`}
        className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-blue-600 text-white font-semibold"
      >
        Sign in with Google
      </a>
      {sessionId && (
        <p className="text-xs text-gray-400">Reference: {sessionId}</p>
      )}
    </div>
  );
}

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const sessionId =
    typeof ctx.query.session_id === 'string' ? ctx.query.session_id : null;

  if (!sessionId) {
    return { props: { sessionId: null, error: 'Missing checkout session.' } };
  }

  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) return { props: { sessionId, error: null } };

  try {
    const stripe = new Stripe(secret, { apiVersion: '2025-08-27.basil' });
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== 'paid' && session.status !== 'complete') {
      return {
        props: {
          sessionId,
          error:
            'Payment not completed. Please try again or contact support.',
        },
      };
    }

    const email =
      session.customer_details?.email || session.customer_email || null;
    const plan = session.metadata?.plan;
    if (email && plan) {
      setPendingPlanFromCheckout(email, {
        plan,
        billingCycle: session.metadata?.billingCycle,
        stripeSessionId: session.id,
        stripeCustomerId:
          typeof session.customer === 'string'
            ? session.customer
            : session.customer?.id,
        stripeSubscriptionId:
          typeof session.subscription === 'string'
            ? session.subscription
            : session.subscription?.id,
      });
    }
  } catch {
    return {
      props: {
        sessionId,
        error: 'Could not verify payment. You can still try signing in.',
      },
    };
  }

  return { props: { sessionId, error: null } };
};
```

---

## Merge into `pages/api/auth/[...nextauth].ts`

**Provider:** Keep `GoogleProvider` with `clientId` / `clientSecret` / `secret: process.env.NEXTAUTH_SECRET`.

**signIn callback** (Google only):

```typescript
import {
  searchGHLContact,
  createPostdoserxGHLContact,
  updateGHLContactPlanTags,
  extractPostdoserxPlanFromTags,
} from '@/lib/postdoserx/ghl';
import { consumePendingPlan } from '@/lib/postdoserx/pending-plan-store';

// inside callbacks:
async signIn({ user, account }) {
  if (account?.provider !== 'google' || !user.email) return true;

  try {
    const pending = consumePendingPlan(user.email);
    const planFromStripe = pending?.plan ?? null;
    const existing = await searchGHLContact(user.email);

    if (!existing) {
      const plan = planFromStripe || 'free';
      await createPostdoserxGHLContact(user.email, user.name || 'User', plan, {
        stripeSessionId: pending?.stripeSessionId,
        stripeCustomerId: pending?.stripeCustomerId,
        stripeSubscriptionId: pending?.stripeSubscriptionId,
      });
    } else if (planFromStripe) {
      await updateGHLContactPlanTags(existing.id, planFromStripe);
    }
    return true;
  } catch (e) {
    console.error('postdoserx signIn GHL error', e);
    return true; // or false if you want to block login on CRM failure
  }
}
```

**jwt callback** (on first sign-in, set `token.plan` from GHL):

```typescript
import { searchGHLContact, extractPostdoserxPlanFromTags } from '@/lib/postdoserx/ghl';

async jwt({ token, user, account }) {
  if (account && user?.email) {
    const ghl = await searchGHLContact(user.email);
    if (ghl?.tags) {
      token.plan = extractPostdoserxPlanFromTags(ghl.tags);
    } else {
      token.plan = 'free';
    }
  }
  return token;
}
```

**session callback:** Attach `(session.user as any).plan = token.plan || 'free'` like SiteOptz.

---

## Production: Postgres schema

```sql
CREATE TABLE IF NOT EXISTS postdoserx_pending_oauth_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_normalized TEXT NOT NULL,
  plan TEXT NOT NULL,
  billing_cycle TEXT,
  stripe_checkout_session_id TEXT UNIQUE NOT NULL,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  consumed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_pending_email
  ON postdoserx_pending_oauth_plans (email_normalized)
  WHERE consumed_at IS NULL;
```

Replace `setPendingPlanFromCheckout` / `consumePendingPlan` with DB upsert/select in webhook + signIn.

---

## Local Stripe webhook

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Use the printed `whsec_...` as `STRIPE_WEBHOOK_SECRET` in `.env.local`.

---

## Edge cases to document in UI

- User must use the **same email** on Stripe Checkout and Google (or pending plan will not apply).
- If emails differ, support must fix manually or user must retry checkout with the Google email.

---

**End of brief.** Implement in the PostDoseRx repository; adjust paths if using App Router or a different folder layout.
