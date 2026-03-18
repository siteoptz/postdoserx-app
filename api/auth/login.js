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
    const { email, name, provider = 'google', tier = 'trial' } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    try {
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
            tier
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

      // Verify tier with GHL if needed
      if (user) {
        try {
          const ghlTier = await verifyTierWithGHL(email);
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
        redirectUrl: `https://app.postdoserx.com?token=${token}&user_id=${user.id}`
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

// Verify user tier with GoHighLevel
async function verifyTierWithGHL(email) {
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
    const contact = data.contacts?.find(c => 
      c.email && c.email.toLowerCase() === email.toLowerCase()
    );

    if (contact && contact.tags) {
      const tags = contact.tags;
      if (tags.some(tag => tag.toLowerCase().includes('premium') || tag.includes('postdoserx-premium'))) {
        return 'premium';
      } else if (tags.some(tag => tag.toLowerCase().includes('trial') || tag.includes('postdoserx-trial'))) {
        return 'trial';
      }
    }

    return 'trial'; // Default to trial if no clear tags found
  } catch (error) {
    throw new Error(`GHL verification failed: ${error.message}`);
  }
}