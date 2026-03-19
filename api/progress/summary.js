// Progress summary API with analytics (Premium feature)
import { withAuth, supabase, requirePremium } from '../middleware/auth.js';

async function handler(req, res) {
  const { method } = req;
  const { user } = req;

  try {
    if (method === 'GET') {
      // Check if user has premium access
      const premiumCheck = requirePremium(user.tier);
      if (premiumCheck) {
        return res.status(premiumCheck.status).json({
          success: false,
          error: premiumCheck.error,
          upgradeRequired: premiumCheck.upgradeRequired
        });
      }

      // Get all progress logs for analysis
      const { data: allLogs, error } = await supabase
        .from('progress_logs')
        .select('log_date, weight_lbs, mood_rating, energy_rating, created_at')
        .eq('user_id', user.id)
        .order('log_date', { ascending: true });

      if (error) {
        return res.status(500).json({
          success: false,
          error: 'Failed to fetch progress data'
        });
      }

      if (!allLogs || allLogs.length === 0) {
        return res.status(200).json({
          success: true,
          data: {
            summary: {
              total_logs: 0,
              tracking_days: 0,
              weight_change: null,
              avg_mood: null,
              avg_energy: null,
              trends: null
            }
          }
        });
      }

      // Calculate summary statistics
      const logsWithWeight = allLogs.filter(log => log.weight_lbs);
      const logsWithMood = allLogs.filter(log => log.mood_rating);
      const logsWithEnergy = allLogs.filter(log => log.energy_rating);

      let weightChange = null;
      let weightTrend = 'stable';
      
      if (logsWithWeight.length >= 2) {
        const startWeight = logsWithWeight[0].weight_lbs;
        const endWeight = logsWithWeight[logsWithWeight.length - 1].weight_lbs;
        weightChange = endWeight - startWeight;
        
        if (weightChange < -2) weightTrend = 'losing';
        else if (weightChange > 2) weightTrend = 'gaining';
      }

      const avgMood = logsWithMood.length > 0 
        ? logsWithMood.reduce((sum, log) => sum + log.mood_rating, 0) / logsWithMood.length
        : null;

      const avgEnergy = logsWithEnergy.length > 0
        ? logsWithEnergy.reduce((sum, log) => sum + log.energy_rating, 0) / logsWithEnergy.length
        : null;

      // Calculate recent trends (last 2 weeks vs previous 2 weeks)
      const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const fourWeeksAgo = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const recentLogs = allLogs.filter(log => log.log_date >= twoWeeksAgo);
      const previousLogs = allLogs.filter(log => log.log_date >= fourWeeksAgo && log.log_date < twoWeeksAgo);

      let moodTrend = 'stable';
      let energyTrend = 'stable';

      if (recentLogs.length > 0 && previousLogs.length > 0) {
        const recentMood = recentLogs.filter(l => l.mood_rating).map(l => l.mood_rating);
        const previousMood = previousLogs.filter(l => l.mood_rating).map(l => l.mood_rating);
        
        if (recentMood.length > 0 && previousMood.length > 0) {
          const recentAvgMood = recentMood.reduce((a, b) => a + b) / recentMood.length;
          const previousAvgMood = previousMood.reduce((a, b) => a + b) / previousMood.length;
          
          if (recentAvgMood > previousAvgMood + 0.5) moodTrend = 'improving';
          else if (recentAvgMood < previousAvgMood - 0.5) moodTrend = 'declining';
        }

        const recentEnergy = recentLogs.filter(l => l.energy_rating).map(l => l.energy_rating);
        const previousEnergy = previousLogs.filter(l => l.energy_rating).map(l => l.energy_rating);
        
        if (recentEnergy.length > 0 && previousEnergy.length > 0) {
          const recentAvgEnergy = recentEnergy.reduce((a, b) => a + b) / recentEnergy.length;
          const previousAvgEnergy = previousEnergy.reduce((a, b) => a + b) / previousEnergy.length;
          
          if (recentAvgEnergy > previousAvgEnergy + 0.5) energyTrend = 'improving';
          else if (recentAvgEnergy < previousAvgEnergy - 0.5) energyTrend = 'declining';
        }
      }

      // Get user profile for context
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('start_date, medication')
        .eq('user_id', user.id)
        .single();

      let trackingDays = 0;
      if (profile?.start_date) {
        const startDate = new Date(profile.start_date);
        const today = new Date();
        trackingDays = Math.floor((today - startDate) / (1000 * 60 * 60 * 24));
      }

      // Generate insights
      const insights = [];
      
      if (weightChange && weightChange < -5) {
        insights.push('Great progress! You\'ve lost significant weight since starting.');
      } else if (weightChange && weightChange > 5) {
        insights.push('Consider reviewing your meal plan and portion sizes.');
      }

      if (avgMood && avgMood >= 4) {
        insights.push('Your mood has been consistently positive!');
      } else if (avgMood && avgMood <= 2) {
        insights.push('Consider discussing mood changes with your healthcare provider.');
      }

      if (energyTrend === 'improving') {
        insights.push('Your energy levels are trending upward - keep up the good work!');
      } else if (energyTrend === 'declining') {
        insights.push('Your energy seems lower lately. Make sure you\'re getting enough rest.');
      }

      return res.status(200).json({
        success: true,
        data: {
          summary: {
            total_logs: allLogs.length,
            tracking_days: Math.max(trackingDays, 0),
            weight_change: weightChange ? Number(weightChange.toFixed(1)) : null,
            weight_trend: weightTrend,
            avg_mood: avgMood ? Number(avgMood.toFixed(1)) : null,
            avg_energy: avgEnergy ? Number(avgEnergy.toFixed(1)) : null,
            mood_trend: moodTrend,
            energy_trend: energyTrend,
            insights,
            medication: profile?.medication || null
          },
          recent_data: {
            last_weight: logsWithWeight.length > 0 ? logsWithWeight[logsWithWeight.length - 1].weight_lbs : null,
            last_log_date: allLogs.length > 0 ? allLogs[allLogs.length - 1].log_date : null
          }
        }
      });

    } else {
      return res.status(405).json({
        success: false,
        error: 'Method not allowed'
      });
    }

  } catch (error) {
    console.error('Progress summary API error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
}

export default withAuth(handler);