// Configuration API endpoint
// Provides public configuration values to frontend

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
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
      // Debug: Return what environment variables we can see
      const debug = {
        GOOGLE_CLIENT_ID: !!process.env.GOOGLE_CLIENT_ID ? 'SET' : 'MISSING',
        STRIPE_PUBLISHABLE_KEY: !!process.env.STRIPE_PUBLISHABLE_KEY ? 'SET' : 'MISSING',
        NODE_ENV: process.env.NODE_ENV || 'not-set',
        VERCEL: process.env.VERCEL || 'not-set'
      };
      
      // Return public configuration values
      const config = {
        googleClientId: process.env.GOOGLE_CLIENT_ID?.trim(),
        stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY?.trim(),
        debug: debug
      };

      // Only include values that are actually set (except debug)
      const filteredConfig = Object.fromEntries(
        Object.entries(config).filter(([key, value]) => value || key === 'debug')
      );

      return res.status(200).json(filteredConfig);
    } catch (error) {
      console.error('Config API error:', error);
      return res.status(500).json({ error: 'Failed to load configuration' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}