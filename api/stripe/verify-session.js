import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-06-20',
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }

    console.log(`🔍 Verifying Stripe session: ${sessionId}`);

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.payment_status !== 'paid') {
      return res.status(400).json({ 
        error: 'Payment not completed',
        status: session.payment_status 
      });
    }

    console.log(`✅ Session verified: ${sessionId}`);

    return res.status(200).json({
      success: true,
      session: {
        id: session.id,
        customer_email: session.customer_details?.email,
        payment_status: session.payment_status,
        plan: session.metadata?.plan
      }
    });

  } catch (error) {
    console.error('❌ Session verification error:', error);
    return res.status(500).json({ 
      error: 'Session verification failed',
      details: error.message 
    });
  }
}