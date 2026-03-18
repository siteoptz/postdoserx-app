// Symptom tracking API
import { withAuth, supabase, requirePremium } from '../middleware/auth.js';

async function handler(req, res) {
  const { user, userId } = req;

  if (req.method === 'GET') {
    // Get symptom logs for user
    const { from, to, limit = 30 } = req.query;

    try {
      let query = supabase
        .from('symptom_logs')
        .select('*')
        .eq('user_id', userId)
        .order('log_date', { ascending: false });

      if (from) {
        query = query.gte('log_date', from);
      }
      if (to) {
        query = query.lte('log_date', to);
      }

      query = query.limit(parseInt(limit));

      const { data: symptoms, error } = await query;

      if (error) {
        console.error('Error fetching symptoms:', error);
        return res.status(500).json({ error: 'Failed to fetch symptom logs' });
      }

      return res.status(200).json({
        success: true,
        symptoms: symptoms || [],
        count: symptoms?.length || 0
      });

    } catch (error) {
      console.error('Symptoms fetch error:', error);
      return res.status(500).json({ error: 'Failed to fetch symptoms' });
    }
  }

  if (req.method === 'POST') {
    // Create/update symptom log
    const { log_date, symptoms, note } = req.body;

    if (!log_date || !symptoms) {
      return res.status(400).json({ 
        error: 'log_date and symptoms are required' 
      });
    }

    // For trial users, limit to basic symptom tracking
    if (user.tier === 'trial') {
      const today = new Date().toISOString().split('T')[0];
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      // Check if user has more than 7 recent logs (trial limit)
      const { data: recentLogs } = await supabase
        .from('symptom_logs')
        .select('id')
        .eq('user_id', userId)
        .gte('log_date', weekAgo)
        .lte('log_date', today);

      if (recentLogs && recentLogs.length >= 7) {
        return res.status(403).json({
          error: 'Trial users are limited to 7 recent symptom logs',
          upgradeRequired: true,
          upgradeMessage: 'Upgrade to Premium for unlimited symptom tracking and advanced analytics'
        });
      }
    }

    try {
      // Upsert symptom log (update if exists, create if not)
      const { data: symptomLog, error } = await supabase
        .from('symptom_logs')
        .upsert({
          user_id: userId,
          log_date,
          symptoms,
          note: note || null
        }, {
          onConflict: 'user_id,log_date'
        })
        .select()
        .single();

      if (error) {
        console.error('Error saving symptom log:', error);
        return res.status(500).json({ error: 'Failed to save symptom log' });
      }

      return res.status(200).json({
        success: true,
        symptomLog,
        message: 'Symptom log saved successfully'
      });

    } catch (error) {
      console.error('Symptom save error:', error);
      return res.status(500).json({ error: 'Failed to save symptom log' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

export default withAuth(handler);