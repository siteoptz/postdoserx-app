// Authentication API - Login endpoint with Stripe & GHL integration
import { SignJWT } from 'jose';
import { createClient } from '@supabase/supabase-js';
import {
  searchGHLContact,
  createPostdoserxGHLContact,
  updateGHLContactPlanTags,
  extractPostdoserxPlanFromTags,
} from '../../lib/postdoserx/ghl.js';
import { consumePendingPlan } from '../../lib/postdoserx/pending-plan-store.js';

// Environment variables
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const JWT_SECRET = process.env.JWT_SECRET || 'your-jwt-secret-key';

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
    const { email, name, provider = 'google', stripe_session_id, credential } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    console.log(`🔐 Login attempt for ${email} with session: ${stripe_session_id || 'none'}`);

    try {
      // Check for pending Stripe plan from checkout
      const pendingPlan = consumePendingPlan(email);
      let planFromStripe = pendingPlan?.plan || null;
      
      console.log(`📦 Pending plan for ${email}:`, pendingPlan);

      // Check if user exists in database
      let { data: existingUser, error: fetchError } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .single();

      let user = existingUser;

      // Handle GHL contact creation/update
      try {
        const existingGHLContact = await searchGHLContact(email);
        
        if (!existingGHLContact) {
          // Create new GHL contact with plan from Stripe
          const plan = planFromStripe || 'free';
          console.log(`👤 Creating new GHL contact for ${email} with plan: ${plan}`);
          
          await createPostdoserxGHLContact(email, name || 'User', plan, {
            stripeSessionId: pendingPlan?.stripeSessionId,
            stripeCustomerId: pendingPlan?.stripeCustomerId,
            stripeSubscriptionId: pendingPlan?.stripeSubscriptionId,
          });
        } else if (planFromStripe) {
          // Update existing contact with new plan from Stripe
          console.log(`🏷️ Updating existing GHL contact ${existingGHLContact.id} with plan: ${planFromStripe}`);
          await updateGHLContactPlanTags(existingGHLContact.id, planFromStripe);
        }
        
        // Get final plan from GHL (after creation/update)
        const finalGHLContact = await searchGHLContact(email);
        const ghlPlan = finalGHLContact?.tags ? extractPostdoserxPlanFromTags(finalGHLContact.tags) : 'free';
        
        console.log(`📊 Final plan for ${email}: ${ghlPlan}`);
        
        // Create or update user in database
        if (!existingUser) {
          console.log(`👤 Creating new user in database for ${email}`);
          
          const { data: newUser, error: createError } = await supabase
            .from('users')
            .insert([{
              email,
              name: name || email.split('@')[0],
              tier: ghlPlan === 'free' ? 'trial' : 'premium'
            }])
            .select()
            .single();

          if (createError) {
            console.error('❌ Error creating user:', createError);
            return res.status(500).json({ error: 'Failed to create user' });
          }

          user = newUser;

          // Create user profile
          const { error: profileError } = await supabase
            .from('user_profiles')
            .insert([{
              user_id: user.id,
              preferences: { plan: ghlPlan }
            }]);

          if (profileError) {
            console.error('⚠️ Error creating user profile:', profileError);
          }
        } else {
          // Update existing user tier based on GHL plan
          const newTier = ghlPlan === 'free' ? 'trial' : 'premium';
          
          if (user.tier !== newTier) {
            console.log(`🔄 Updating user tier from ${user.tier} to ${newTier}`);
            
            const { error: updateError } = await supabase
              .from('users')
              .update({ tier: newTier })
              .eq('id', user.id);

            if (!updateError) {
              user.tier = newTier;
            }
          }
        }
        
      } catch (ghlError) {
        console.error('❌ GHL integration error:', ghlError);
        
        // Fallback: create/update user without GHL plan
        if (!existingUser) {
          const { data: newUser, error: createError } = await supabase
            .from('users')
            .insert([{
              email,
              name: name || email.split('@')[0],
              tier: 'trial'
            }])
            .select()
            .single();

          if (createError) {
            console.error('❌ Error creating fallback user:', createError);
            return res.status(500).json({ error: 'Failed to create user' });
          }

          user = newUser;
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

      console.log(`✅ Authentication successful for ${email}`);

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
      console.error('❌ Login error:', error);
      return res.status(500).json({ 
        error: 'Authentication failed',
        details: error.message 
      });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}