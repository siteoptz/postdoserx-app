import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-06-20',
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { plan, billingCycle, priceId } = req.body;

    if (!plan || !billingCycle) {
      return res.status(400).json({ 
        error: 'plan and billingCycle are required' 
      });
    }

    // Price ID mapping based on environment variables
    const priceIdMap = {
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
      return res.status(400).json({ 
        error: 'Invalid plan or price not configured' 
      });
    }

    const baseUrl = process.env.NEXTAUTH_URL || 'https://postdoserx.com';

    console.log(`🛒 Creating Stripe checkout session for plan: ${plan}, billing: ${billingCycle}`);

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
        billingCycle, 
        source: 'postdoserx' 
      },
      subscription_data: {
        metadata: { 
          plan, 
          billingCycle, 
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