// Stripe subscription cancellation API
import { withAuth, supabase } from '../middleware/auth.js';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

async function handler(req, res) {
  const { user } = req;

  if (req.method === 'POST') {
    try {
      // Get user's Stripe customer ID from database
      const { data: userData, error } = await supabase
        .from('users')
        .select('stripe_customer_id, email')
        .eq('id', user.id)
        .single();

      if (error || !userData) {
        return res.status(404).json({ 
          success: false, 
          error: 'User not found' 
        });
      }

      if (!userData.stripe_customer_id) {
        return res.status(400).json({ 
          success: false, 
          error: 'No subscription found' 
        });
      }

      if (!STRIPE_SECRET_KEY) {
        return res.status(500).json({ 
          success: false, 
          error: 'Stripe configuration not found' 
        });
      }

      // Get active subscriptions for the customer
      const subscriptions = await getStripeSubscriptions(userData.stripe_customer_id);
      
      if (!subscriptions || subscriptions.data.length === 0) {
        return res.status(400).json({ 
          success: false, 
          error: 'No active subscription found' 
        });
      }

      // Cancel all active subscriptions (usually just one)
      const cancelResults = await Promise.all(
        subscriptions.data
          .filter(sub => sub.status === 'active')
          .map(sub => cancelStripeSubscription(sub.id))
      );

      if (cancelResults.length === 0) {
        return res.status(400).json({ 
          success: false, 
          error: 'No active subscriptions to cancel' 
        });
      }

      // Update user tier in database to trial (they keep access until period ends)
      // Note: Stripe webhook will handle the actual tier change at period end
      console.log(`User ${user.email} cancelled subscription. Current access continues until period end.`);

      return res.status(200).json({
        success: true,
        message: 'Subscription cancelled successfully. Access will continue until the end of your billing period.',
        cancelled_subscriptions: cancelResults.length
      });

    } catch (error) {
      console.error('Cancel subscription error:', error);
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to cancel subscription' 
      });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

// Get customer subscriptions from Stripe
async function getStripeSubscriptions(customerId) {
  const response = await fetch(`https://api.stripe.com/v1/subscriptions?customer=${customerId}`, {
    headers: {
      'Authorization': `Bearer ${STRIPE_SECRET_KEY}`
    }
  });

  if (!response.ok) {
    throw new Error('Failed to fetch Stripe subscriptions');
  }

  return await response.json();
}

// Cancel a Stripe subscription
async function cancelStripeSubscription(subscriptionId) {
  const response = await fetch(`https://api.stripe.com/v1/subscriptions/${subscriptionId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      // Cancel at period end (user keeps access until billing period ends)
      at_period_end: 'true'
    })
  });

  if (!response.ok) {
    throw new Error('Failed to cancel Stripe subscription');
  }

  return await response.json();
}

export default withAuth(handler);