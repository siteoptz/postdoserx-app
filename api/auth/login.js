// Authentication API - Login endpoint
import { SignJWT } from 'jose';
import { createClient } from '@supabase/supabase-js';

// Environment variables
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const JWT_SECRET = process.env.JWT_SECRET || 'your-jwt-secret-key';
const GHL_API_KEY = process.env.GHL_API_KEY || 'pit-e2c103d1-89c7-4e4a-9376-e3b50257d66b';
const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID || 'ECu5ScdYFmB0WnhvYoBU';

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
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
    const { email, name, provider = 'google', tier = 'trial', stripe_session_id } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    try {
      // Check for completed Stripe checkout session
      let userTier = tier;
      if (stripe_session_id) {
        const { data: checkoutData, error: checkoutError } = await supabase
          .from('checkout_sessions')
          .select('*')
          .eq('session_id', stripe_session_id)
          .eq('customer_email', email)
          .single();

        if (checkoutData && !checkoutError) {
          userTier = 'premium'; // User completed premium checkout
          console.log('Found completed Stripe checkout for:', email);
        }
      }

      // Check if user exists in database
      let { data: existingUser, error: fetchError } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .single();

      let user = existingUser;

      if (!existingUser && !fetchError) {
        // Create new user
        const { data: newUser, error: createError } = await supabase
          .from('users')
          .insert([{
            email,
            name: name || email.split('@')[0],
            tier: userTier
          }])
          .select()
          .single();

        if (createError) {
          console.error('Error creating user:', createError);
          return res.status(500).json({ error: 'Failed to create user' });
        }

        user = newUser;

        // Create user profile
        const { error: profileError } = await supabase
          .from('user_profiles')
          .insert([{
            user_id: user.id,
            preferences: {}
          }]);

        if (profileError) {
          console.error('Error creating user profile:', profileError);
        }
      }

      // Verify tier with GHL and create contact if needed
      if (user) {
        try {
          const ghlTier = await verifyOrCreateGHLContact(email, user.name, user.tier);
          if (ghlTier && ghlTier !== user.tier) {
            // Update user tier based on GHL data
            const { error: updateError } = await supabase
              .from('users')
              .update({ tier: ghlTier })
              .eq('id', user.id);

            if (!updateError) {
              user.tier = ghlTier;
            }
          }
        } catch (ghlError) {
          console.log('GHL verification failed, using database tier:', ghlError.message);
        }
      }

      // Generate JWT token
      const secret = new TextEncoder().encode(JWT_SECRET);
      const token = await new SignJWT({
        sub: user.id,
        email: user.email,
        name: user.name,
        tier: user.tier
      })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('24h')
        .sign(secret);

      // Return user data and token
      return res.status(200).json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          tier: user.tier
        },
        token,
        redirectUrl: `https://postdoserx.com/success.html?token=${token}&user_id=${user.id}`
      });

    } catch (error) {
      console.error('Login error:', error);
      return res.status(500).json({ 
        error: 'Authentication failed',
        details: error.message 
      });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
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

// Create new GHL contact
async function createGHLContact(email, name, tier = 'trial') {
  try {
    const tags = tier === 'premium' ? ['postdoserx-premium', 'active-subscriber'] : ['postdoserx-trial'];
    
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

    return await response.json();
  } catch (error) {
    console.error('Error creating GHL contact:', error);
    throw error;
  }
}

// Verify user tier with GoHighLevel and create contact if not exists
async function verifyOrCreateGHLContact(email, name = null, userTier = 'trial') {
  try {
    const contact = await findGHLContact(email);

    if (contact && contact.tags) {
      const tags = contact.tags;
      if (tags.some(tag => tag.toLowerCase().includes('premium') || tag.includes('postdoserx-premium'))) {
        return 'premium';
      } else if (tags.some(tag => tag.toLowerCase().includes('trial') || tag.includes('postdoserx-trial'))) {
        return 'trial';
      }
    } else if (!contact) {
      // Contact doesn't exist in GHL, create it
      console.log('Creating new GHL contact for:', email);
      try {
        await createGHLContact(email, name, userTier);
        return userTier;
      } catch (createError) {
        console.error('Failed to create GHL contact:', createError);
        return userTier; // Return the intended tier even if GHL creation fails
      }
    }

    return 'trial'; // Default to trial if no clear tags found
  } catch (error) {
    throw new Error(`GHL verification failed: ${error.message}`);
  }
}