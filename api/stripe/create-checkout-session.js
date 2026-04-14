import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-06-20',
});

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Credentials': 'true'
};

export default async function handler(req, res) {
  // Set CORS headers for all requests
  Object.entries(corsHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('📥 Checkout session request received:', req.body);
    const { plan, priceId } = req.body;

    if (!plan) {
      console.error('❌ No plan provided in request');
      return res.status(400).json({ 
        error: 'plan is required' 
      });
    }

    // Since environment variables are not configured yet, let's be more flexible
    // For now, use the hardcoded fallback or allow the frontend to work directly
    if (!process.env.STRIPE_SECRET_KEY) {
      console.error('❌ STRIPE_SECRET_KEY not configured');
      return res.status(500).json({ 
        error: 'Stripe not configured - using fallback checkout' 
      });
    }

    // Price ID mapping for PostDoseRX plans
    // TODO: Configure these in environment variables
    const priceIdMap = {
      trial: process.env.STRIPE_POSTDOSE_TRIAL_PRICE_ID,
      premium: process.env.STRIPE_POSTDOSE_PREMIUM_PRICE_ID || 'price_1OaKA1JNKLJfZdYsLNz29mNl', // Fallback for PostDoseRX premium
    };

    const resolvedPriceId = priceId || priceIdMap[plan];
    
    if (!resolvedPriceId) {
      console.error(`❌ No price ID found for plan: ${plan}`);
      return res.status(400).json({ 
        error: `Price not configured for plan: ${plan}` 
      });
    }
    
    console.log(`🔍 Using price ID: ${resolvedPriceId} for plan: ${plan}`);

    const baseUrl = process.env.NEXTAUTH_URL || 'https://app.postdoserx.com';

    console.log(`🛒 Creating Stripe checkout session for plan: ${plan}`);

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ 
        price: resolvedPriceId, 
        quantity: 1 
      }],
      success_url: `${baseUrl}/after-checkout.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/?upgrade_canceled=1`,
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