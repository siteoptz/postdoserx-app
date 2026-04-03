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
      // Return public configuration values
      const config = {
        googleClientId: process.env.GOOGLE_CLIENT_ID,
        stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY, // If you have this
      };

      // Only include values that are actually set
      const filteredConfig = Object.fromEntries(
        Object.entries(config).filter(([key, value]) => value)
      );

      return res.status(200).json(filteredConfig);
    } catch (error) {
      console.error('Config API error:', error);
      return res.status(500).json({ error: 'Failed to load configuration' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}