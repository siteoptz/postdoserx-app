// Stripe billing portal API
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
          error: 'No subscription found. Please upgrade to premium first.' 
        });
      }

      // Create Stripe billing portal session
      if (!STRIPE_SECRET_KEY) {
        return res.status(500).json({ 
          success: false, 
          error: 'Stripe configuration not found' 
        });
      }

      // Use Stripe API to create billing portal session
      const portalSession = await createStripeBillingSession(
        userData.stripe_customer_id,
        'https://app.postdoserx.com' // return URL
      );

      return res.status(200).json({
        success: true,
        url: portalSession.url
      });

    } catch (error) {
      console.error('Billing portal error:', error);
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to create billing portal session' 
      });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

// Stripe API call to create billing portal session
async function createStripeBillingSession(customerId, returnUrl) {
  const response = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      customer: customerId,
      return_url: returnUrl
    })
  });

  if (!response.ok) {
    throw new Error('Failed to create Stripe billing session');
  }

  return await response.json();
}

export default withAuth(handler);