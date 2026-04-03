// Stripe webhook handler for checkout completion
import { createClient } from '@supabase/supabase-js';

// Environment variables
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const GHL_API_KEY = process.env.GHL_API_KEY || 'pit-e2c103d1-89c7-4e4a-9376-e3b50257d66b';
const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID || 'ECu5ScdYFmB0WnhvYoBU';

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, Stripe-Signature',
};

export default async function handler(req, res) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).json({});
  }

  // Set CORS headers
  Object.entries(corsHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  if (req.method === 'POST') {
    const body = req.body;
    const sig = req.headers['stripe-signature'];

    let event;

    try {
      // Verify webhook signature (simplified for this implementation)
      if (!sig || !STRIPE_WEBHOOK_SECRET) {
        console.error('Missing webhook signature or secret');
        return res.status(400).json({ error: 'Webhook signature verification failed' });
      }

      // Parse the body if it's a string
      event = typeof body === 'string' ? JSON.parse(body) : body;
      console.log('Webhook event received:', event.type);
    } catch (err) {
      console.error('Webhook parsing failed:', err.message);
      return res.status(400).json({ error: 'Webhook parsing failed' });
    }

    try {
      // Handle the event
      switch (event.type) {
        case 'checkout.session.completed':
          await handleCheckoutCompleted(event.data.object);
          break;
        case 'customer.subscription.created':
          await handleSubscriptionCreated(event.data.object);
          break;
        case 'customer.subscription.updated':
          await handleSubscriptionUpdated(event.data.object);
          break;
        case 'customer.subscription.deleted':
          await handleSubscriptionCanceled(event.data.object);
          break;
        default:
          console.log(`Unhandled event type ${event.type}`);
      }

      res.status(200).json({ received: true });
    } catch (error) {
      console.error('Webhook handler error:', error);
      res.status(500).json({ error: 'Webhook handler failed' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}

// Handle successful checkout completion
async function handleCheckoutCompleted(session) {
  try {
    const customerId = session.customer;
    const customerEmail = session.customer_details?.email;
    const customerName = session.customer_details?.name;
    
    if (!customerEmail) {
      console.error('No customer email found in checkout session');
      return;
    }

    console.log('Processing checkout completion for:', customerEmail);

    // Store checkout session data for later user creation
    const { error: sessionError } = await supabase
      .from('checkout_sessions')
      .upsert([{
        customer_id: customerId,
        customer_email: customerEmail,
        session_id: session.id,
        subscription_id: session.subscription,
        amount_total: session.amount_total,
        currency: session.currency,
        payment_status: session.payment_status,
        completed_at: new Date().toISOString()
      }]);

    if (sessionError) {
      console.error('Error storing checkout session:', sessionError);
    }

    // Create GHL contact immediately with premium tier tags
    try {
      await createOrUpdateGHLContact(customerEmail, customerName, 'premium');
      console.log('Created GHL contact with premium tier for:', customerEmail);
    } catch (ghlError) {
      console.error('Failed to create GHL contact:', ghlError);
      // Continue processing even if GHL fails
    }

    console.log('Checkout completion processed for:', customerEmail);
  } catch (error) {
    console.error('Error handling checkout completion:', error);
    throw error;
  }
}

// Handle subscription creation
async function handleSubscriptionCreated(subscription) {
  try {
    const customerId = subscription.customer;
    
    // Get customer details from Stripe
    const customer = await retrieveStripeCustomer(customerId);
    const customerEmail = customer.email;

    if (!customerEmail) {
      console.error('No customer email found for subscription:', subscription.id);
      return;
    }

    console.log('Processing subscription creation for:', customerEmail);

    // Update user in database with premium tier
    const { error: updateError } = await supabase
      .from('users')
      .update({ 
        tier: 'premium',
        stripe_customer_id: customerId,
        subscription_id: subscription.id,
        subscription_status: subscription.status
      })
      .eq('email', customerEmail);

    if (updateError) {
      console.error('Error updating user tier:', updateError);
    } else {
      console.log('Updated user tier to premium for:', customerEmail);
    }

    // Update GHL contact with premium tier tags
    try {
      await createOrUpdateGHLContact(customerEmail, customer.name, 'premium');
      console.log('Updated GHL contact with premium tier for:', customerEmail);
    } catch (ghlError) {
      console.error('Failed to update GHL contact:', ghlError);
    }

  } catch (error) {
    console.error('Error handling subscription creation:', error);
    throw error;
  }
}

// Handle subscription updates
async function handleSubscriptionUpdated(subscription) {
  try {
    const customerId = subscription.customer;
    const customer = await retrieveStripeCustomer(customerId);
    const customerEmail = customer.email;

    if (!customerEmail) {
      console.error('No customer email found for subscription update:', subscription.id);
      return;
    }

    console.log('Processing subscription update for:', customerEmail);

    // Update subscription status in database
    const { error: updateError } = await supabase
      .from('users')
      .update({ 
        subscription_status: subscription.status,
        tier: subscription.status === 'active' ? 'premium' : 'trial'
      })
      .eq('email', customerEmail);

    if (updateError) {
      console.error('Error updating subscription status:', updateError);
    } else {
      console.log('Updated subscription status for:', customerEmail);
    }

  } catch (error) {
    console.error('Error handling subscription update:', error);
    throw error;
  }
}

// Handle subscription cancellation
async function handleSubscriptionCanceled(subscription) {
  try {
    const customerId = subscription.customer;
    const customer = await retrieveStripeCustomer(customerId);
    const customerEmail = customer.email;

    if (!customerEmail) {
      console.error('No customer email found for subscription cancellation:', subscription.id);
      return;
    }

    console.log('Processing subscription cancellation for:', customerEmail);

    // Update user tier to trial
    const { error: updateError } = await supabase
      .from('users')
      .update({ 
        tier: 'trial',
        subscription_status: 'canceled'
      })
      .eq('email', customerEmail);

    if (updateError) {
      console.error('Error updating user tier on cancellation:', updateError);
    } else {
      console.log('Updated user tier to trial for:', customerEmail);
    }

    // Update GHL contact tags to trial (remove premium tags)
    try {
      await removeGHLPremiumTags(customerEmail);
      console.log('Removed premium tags from GHL contact for:', customerEmail);
    } catch (ghlError) {
      console.error('Failed to update GHL contact tags:', ghlError);
    }

  } catch (error) {
    console.error('Error handling subscription cancellation:', error);
    throw error;
  }
}

// Retrieve Stripe customer
async function retrieveStripeCustomer(customerId) {
  try {
    const response = await fetch(`https://api.stripe.com/v1/customers/${customerId}`, {
      headers: {
        'Authorization': `Bearer ${STRIPE_SECRET_KEY}`
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to retrieve Stripe customer: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error retrieving Stripe customer:', error);
    throw error;
  }
}

// Find existing GHL contact
async function findGHLContact(email) {
  try {
    const response = await fetch(`https://services.leadconnectorhq.com/contacts/?locationId=${GHL_LOCATION_ID}&limit=100`, {
      headers: {
        'Authorization': `Bearer ${GHL_API_KEY}`,
        'Content-Type': 'application/json',
        'Version': '2021-07-28'
      }
    });

    if (!response.ok) {
      throw new Error(`GHL API error: ${response.status}`);
    }

    const data = await response.json();
    return data.contacts?.find(c => 
      c.email && c.email.toLowerCase() === email.toLowerCase()
    );
  } catch (error) {
    console.error('Error finding GHL contact:', error);
    return null;
  }
}

// Create or update GHL contact with tier tags
async function createOrUpdateGHLContact(email, name, tier = 'premium') {
  try {
    const existingContact = await findGHLContact(email);
    const tags = tier === 'premium' ? ['postdoserx-premium', 'active-subscriber'] : ['postdoserx-trial'];
    
    if (existingContact) {
      // Update existing contact with new tags
      const response = await fetch(`https://services.leadconnectorhq.com/contacts/${existingContact.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${GHL_API_KEY}`,
          'Content-Type': 'application/json',
          'Version': '2021-07-28'
        },
        body: JSON.stringify({
          tags: [...new Set([...(existingContact.tags || []), ...tags])] // Merge and dedupe tags
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to update GHL contact: ${response.status}`);
      }

      console.log('Updated GHL contact tags for:', email);
      return await response.json();
    } else {
      // Create new contact
      const response = await fetch(`https://services.leadconnectorhq.com/contacts/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${GHL_API_KEY}`,
          'Content-Type': 'application/json',
          'Version': '2021-07-28'
        },
        body: JSON.stringify({
          locationId: GHL_LOCATION_ID,
          email,
          firstName: name ? name.split(' ')[0] : email.split('@')[0],
          lastName: name ? name.split(' ').slice(1).join(' ') : '',
          tags
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to create GHL contact: ${response.status}`);
      }

      console.log('Created new GHL contact for:', email);
      return await response.json();
    }
  } catch (error) {
    console.error('Error creating/updating GHL contact:', error);
    throw error;
  }
}

// Remove premium tags from GHL contact
async function removeGHLPremiumTags(email) {
  try {
    const existingContact = await findGHLContact(email);
    
    if (existingContact) {
      // Filter out premium tags and add trial tags if not present
      const currentTags = existingContact.tags || [];
      const filteredTags = currentTags.filter(tag => 
        !tag.toLowerCase().includes('premium') && !tag.toLowerCase().includes('active-subscriber')
      );
      
      // Add trial tag if not already present
      if (!filteredTags.some(tag => tag.toLowerCase().includes('trial'))) {
        filteredTags.push('postdoserx-trial');
      }

      const response = await fetch(`https://services.leadconnectorhq.com/contacts/${existingContact.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${GHL_API_KEY}`,
          'Content-Type': 'application/json',
          'Version': '2021-07-28'
        },
        body: JSON.stringify({
          tags: filteredTags
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to update GHL contact: ${response.status}`);
      }

      console.log('Removed premium tags from GHL contact for:', email);
      return await response.json();
    }
  } catch (error) {
    console.error('Error removing premium tags from GHL contact:', error);
    throw error;
  }
}