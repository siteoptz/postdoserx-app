// Authentication API - Get current user
import { jwtVerify } from 'jose';
import { createClient } from '@supabase/supabase-js';

// Environment variables
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const JWT_SECRET = process.env.JWT_SECRET || 'your-jwt-secret-key';

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
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

  if (req.method === 'GET') {
    try {
      // Verify JWT token
      const user = await verifyJWT(req.headers.authorization);
      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Get fresh user data from database
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select(`
          id,
          email,
          name,
          tier,
          created_at,
          user_profiles (
            medication,
            dose_amount,
            injection_day,
            start_date,
            preferences,
            onboarding_completed
          )
        `)
        .eq('id', user.sub)
        .single();

      if (userError) {
        console.error('Error fetching user data:', userError);
        return res.status(500).json({ error: 'Failed to fetch user data' });
      }

      return res.status(200).json({
        success: true,
        user: userData
      });

    } catch (error) {
      console.error('Auth verification error:', error);
      return res.status(401).json({ error: 'Invalid token' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

// JWT verification utility
export async function verifyJWT(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);
  const secret = new TextEncoder().encode(JWT_SECRET);

  try {
    const { payload } = await jwtVerify(token, secret);
    return payload;
  } catch (error) {
    throw new Error('Invalid token');
  }
}