// Progress tracking API for weight, mood, and energy logging
import { withAuth, supabase, requirePremium } from '../middleware/auth.js';

async function handler(req, res) {
  const { method, query, body } = req;
  const { user } = req;

  try {
    if (method === 'GET') {
      // Get progress logs with date range
      const fromDate = query.from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const toDate = query.to || new Date().toISOString().split('T')[0];

      // For trial users, limit to 7 days
      let actualFromDate = fromDate;
      if (user.tier === 'trial') {
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        if (fromDate < weekAgo) {
          actualFromDate = weekAgo;
        }
      }

      const { data: progressLogs, error } = await supabase
        .from('progress_logs')
        .select('log_date, weight_lbs, notes, mood_rating, energy_rating, created_at')
        .eq('user_id', user.id)
        .gte('log_date', actualFromDate)
        .lte('log_date', toDate)
        .order('log_date', { ascending: false });

      if (error) {
        return res.status(500).json({
          success: false,
          error: 'Failed to fetch progress logs'
        });
      }

      return res.status(200).json({
        success: true,
        data: {
          logs: progressLogs,
          from_date: actualFromDate,
          to_date: toDate,
          tier_limited: user.tier === 'trial' && fromDate < actualFromDate
        }
      });

    } else if (method === 'POST') {
      // Create or update progress log
      const { log_date, weight_lbs, notes, mood_rating, energy_rating } = body;

      if (!log_date) {
        return res.status(400).json({
          success: false,
          error: 'log_date is required'
        });
      }

      // For trial users, check if they exceed the 7-day limit
      if (user.tier === 'trial') {
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const today = new Date().toISOString().split('T')[0];
        
        if (log_date < weekAgo) {
          return res.status(403).json({
            success: false,
            error: 'Trial users can only log progress for the last 7 days',
            upgradeRequired: true
          });
        }

        // Check if user has too many recent logs
        const { data: recentLogs } = await supabase
          .from('progress_logs')
          .select('id')
          .eq('user_id', user.id)
          .gte('log_date', weekAgo)
          .lte('log_date', today);

        if (recentLogs && recentLogs.length >= 7 && !recentLogs.find(log => log.log_date === log_date)) {
          return res.status(403).json({
            success: false,
            error: 'Trial users can only track 7 days of progress. Upgrade for unlimited tracking.',
            upgradeRequired: true
          });
        }
      }

      const { data: progressLog, error } = await supabase
        .from('progress_logs')
        .upsert({
          user_id: user.id,
          log_date,
          weight_lbs: weight_lbs || null,
          notes: notes || null,
          mood_rating: mood_rating || null,
          energy_rating: energy_rating || null,
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        return res.status(500).json({
          success: false,
          error: 'Failed to save progress log'
        });
      }

      return res.status(201).json({
        success: true,
        data: progressLog
      });

    } else {
      return res.status(405).json({
        success: false,
        error: 'Method not allowed'
      });
    }

  } catch (error) {
    console.error('Progress API error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
}

export default withAuth(handler);