// Authentication middleware
import { jwtVerify } from 'jose';
import { createClient } from '@supabase/supabase-js';

const JWT_SECRET = process.env.JWT_SECRET || process.env.SUPABASE_JWT_SECRET || 'your-jwt-secret-key';
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// CORS headers
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Apply CORS headers to response
export function applyCORS(res) {
  Object.entries(corsHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });
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

// Authentication middleware for API routes
export async function authenticateUser(req, res) {
  try {
    const user = await verifyJWT(req.headers.authorization);
    if (!user) {
      return { error: 'Unauthorized', status: 401 };
    }

    // Verify user exists in database
    const { data: userData, error: dbError } = await supabase
      .from('users')
      .select('id, email, name, tier')
      .eq('id', user.sub)
      .single();

    if (dbError || !userData) {
      return { error: 'User not found', status: 404 };
    }

    return { user: userData };
  } catch (error) {
    return { error: 'Authentication failed', status: 401 };
  }
}

// Tier verification middleware
export function requirePremium(userTier) {
  if (userTier !== 'premium') {
    return {
      error: 'Premium subscription required',
      status: 403,
      upgradeRequired: true
    };
  }
  return null;
}

// Generic API handler wrapper
export function withAuth(handler) {
  return async (req, res) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      applyCORS(res);
      return res.status(200).json({});
    }

    applyCORS(res);

    // Authenticate user
    const authResult = await authenticateUser(req, res);
    if (authResult.error) {
      return res.status(authResult.status).json({ 
        error: authResult.error,
        upgradeRequired: authResult.upgradeRequired 
      });
    }

    // Add user to request object
    req.user = authResult.user;
    req.userId = authResult.user.id;

    // Call the actual handler
    return handler(req, res);
  };
}

// Supabase client instance
export { supabase };