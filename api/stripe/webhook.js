import Stripe from 'stripe';
import { setPendingPlanFromCheckout } from '../../lib/postdoserx/pending-plan-store.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-06-20',
});

// Disable body parser for raw body access
export const config = {
  api: {
    bodyParser: false,
  },
};

async function buffer(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).end();
  }

  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  
  if (!sig || !webhookSecret) {
    console.error('❌ Missing Stripe signature or webhook secret');
    return res.status(400).json({ 
      error: 'Missing signature or webhook secret' 
    });
  }

  let event;
  
  try {
    const rawBody = await buffer(req);
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
    console.log(`📡 Received webhook event: ${event.type}`);
  } catch (err) {
    console.error('❌ Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      
      console.log(`✅ Checkout session completed: ${session.id}`);
      
      const email = session.customer_details?.email || session.customer_email || null;
      const plan = session.metadata?.plan;
      
      console.log(`📧 Customer email: ${email}`);
      console.log(`📦 Plan: ${plan}`);
      
      if (email && plan) {
        setPendingPlanFromCheckout(email, {
          plan,
          stripeSessionId: session.id,
          stripeCustomerId: typeof session.customer === 'string' 
            ? session.customer 
            : session.customer?.id,
          stripeSubscriptionId: typeof session.subscription === 'string' 
            ? session.subscription 
            : session.subscription?.id,
        });
        
        console.log(`📝 Stored pending plan for ${email}: ${plan}`);
      } else {
        console.warn(`⚠️ Missing email or plan in checkout session ${session.id}`);
      }
    }

    // Handle subscription events for plan updates
    if (event.type === 'invoice.payment_succeeded') {
      const invoice = event.data.object;
      const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
      
      console.log(`💰 Payment succeeded for subscription: ${subscription.id}`);
      
      if (subscription.metadata?.plan) {
        console.log(`📦 Subscription plan: ${subscription.metadata.plan}`);
        // This could trigger additional GHL updates if needed
      }
    }

    // Handle subscription cancellation
    if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object;
      console.log(`❌ Subscription cancelled: ${subscription.id}`);
      
      // Here you might want to update GHL contact to remove paid plan tags
      // and add a cancellation tag
    }

    return res.status(200).json({ received: true });
    
  } catch (error) {
    console.error('❌ Error processing webhook:', error);
    return res.status(500).json({ error: 'Webhook processing failed' });
  }
}