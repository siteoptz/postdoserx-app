import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-06-20',
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { plan, priceId } = req.body;

    if (!plan) {
      return res.status(400).json({ 
        error: 'plan is required' 
      });
    }

    // Price ID mapping for PostDoseRX plans
    const priceIdMap = {
      trial: process.env.STRIPE_POSTDOSE_TRIAL_PRICE_ID,
      premium: process.env.STRIPE_POSTDOSE_PREMIUM_PRICE_ID,
    };

    const resolvedPriceId = priceId || priceIdMap[plan];
    
    if (!resolvedPriceId) {
      return res.status(400).json({ 
        error: 'Invalid plan or price not configured' 
      });
    }

    const baseUrl = process.env.NEXTAUTH_URL || 'https://postdoserx.com';

    console.log(`🛒 Creating Stripe checkout session for plan: ${plan}`);

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ 
        price: resolvedPriceId, 
        quantity: 1 
      }],
      success_url: `${baseUrl}/after-checkout.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/?canceled=1`,
      metadata: { 
        plan, 
        source: 'postdoserx' 
      },
      subscription_data: {
        metadata: { 
          plan, 
          source: 'postdoserx' 
        },
      },
      allow_promotion_codes: true,
      billing_address_collection: 'required',
      customer_creation: 'always',
    });

    console.log(`✅ Created checkout session: ${session.id}`);

    return res.status(200).json({ 
      url: session.url, 
      sessionId: session.id 
    });

  } catch (error) {
    console.error('❌ Stripe checkout error:', error);
    return res.status(500).json({ 
      error: error.message || 'Checkout failed' 
    });
  }
}