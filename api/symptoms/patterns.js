// Symptom patterns API (Premium feature)
import { withAuth, supabase, requirePremium } from '../middleware/auth.js';

async function handler(req, res) {
  const { user, userId } = req;

  // Check premium tier for patterns analysis
  const premiumCheck = requirePremium(user.tier);
  if (premiumCheck) {
    return res.status(premiumCheck.status).json({
      error: premiumCheck.error,
      upgradeRequired: premiumCheck.upgradeRequired,
      upgradeMessage: 'Upgrade to Premium for advanced symptom pattern analysis, injection day insights, and personalized recommendations'
    });
  }

  if (req.method === 'GET') {
    const { days = 30 } = req.query;

    try {
      // Get symptom logs for analysis
      const fromDate = new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1000)
        .toISOString().split('T')[0];

      const { data: symptoms, error } = await supabase
        .from('symptom_logs')
        .select('log_date, symptoms, created_at')
        .eq('user_id', userId)
        .gte('log_date', fromDate)
        .order('log_date', { ascending: true });

      if (error) {
        console.error('Error fetching symptoms for patterns:', error);
        return res.status(500).json({ error: 'Failed to analyze symptom patterns' });
      }

      // Get user profile for injection day analysis
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('injection_day, start_date')
        .eq('user_id', userId)
        .single();

      // Calculate patterns
      const patterns = analyzeSymptomPatterns(symptoms, profile);

      return res.status(200).json({
        success: true,
        patterns,
        analysisDate: new Date().toISOString(),
        dayCount: parseInt(days)
      });

    } catch (error) {
      console.error('Pattern analysis error:', error);
      return res.status(500).json({ error: 'Failed to analyze patterns' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

function analyzeSymptomPatterns(symptoms, profile) {
  if (!symptoms || symptoms.length === 0) {
    return {
      summary: 'Not enough data for pattern analysis',
      totalLogs: 0,
      averageScores: {},
      injectionDayPattern: null,
      recommendations: []
    };
  }

  // Calculate average symptom scores
  const symptomTotals = {};
  const symptomCounts = {};

  symptoms.forEach(log => {
    Object.entries(log.symptoms).forEach(([symptom, score]) => {
      if (!symptomTotals[symptom]) {
        symptomTotals[symptom] = 0;
        symptomCounts[symptom] = 0;
      }
      symptomTotals[symptom] += score;
      symptomCounts[symptom]++;
    });
  });

  const averageScores = {};
  Object.keys(symptomTotals).forEach(symptom => {
    averageScores[symptom] = Number(
      (symptomTotals[symptom] / symptomCounts[symptom]).toFixed(1)
    );
  });

  // Injection day pattern analysis
  let injectionDayPattern = null;
  if (profile?.injection_day) {
    injectionDayPattern = analyzeInjectionDayPattern(symptoms, profile.injection_day);
  }

  // Generate recommendations
  const recommendations = generateRecommendations(averageScores, injectionDayPattern);

  return {
    summary: `Analyzed ${symptoms.length} symptom logs`,
    totalLogs: symptoms.length,
    averageScores,
    injectionDayPattern,
    recommendations,
    mostCommonSymptoms: Object.entries(averageScores)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([symptom, score]) => ({ symptom, averageScore: score }))
  };
}

function analyzeInjectionDayPattern(symptoms, injectionDay) {
  const dayOfWeekMap = {
    'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3,
    'Thursday': 4, 'Friday': 5, 'Saturday': 6
  };

  const targetDay = dayOfWeekMap[injectionDay];
  if (targetDay === undefined) return null;

  const dayScores = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };

  symptoms.forEach(log => {
    const logDate = new Date(log.log_date);
    const dayOfWeek = logDate.getDay();
    
    // Calculate overall symptom severity for this day
    const scores = Object.values(log.symptoms);
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    
    dayScores[dayOfWeek].push(avgScore);
  });

  // Calculate average for each day
  const dayAverages = {};
  Object.entries(dayScores).forEach(([day, scores]) => {
    if (scores.length > 0) {
      dayAverages[day] = scores.reduce((a, b) => a + b, 0) / scores.length;
    }
  });

  return {
    injectionDay,
    dayAverages,
    pattern: generateInjectionPattern(dayAverages, targetDay)
  };
}

function generateInjectionPattern(dayAverages, targetDay) {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  
  let pattern = `Injection day is ${days[targetDay]}. `;
  
  if (dayAverages[targetDay] !== undefined) {
    const injectionDayScore = dayAverages[targetDay];
    const otherDaysAvg = Object.entries(dayAverages)
      .filter(([day]) => parseInt(day) !== targetDay)
      .reduce((sum, [, score]) => sum + score, 0) / 
      Object.keys(dayAverages).filter(day => parseInt(day) !== targetDay).length;

    if (injectionDayScore > otherDaysAvg + 0.5) {
      pattern += 'Symptoms tend to be higher on injection day.';
    } else if (injectionDayScore < otherDaysAvg - 0.5) {
      pattern += 'Symptoms tend to be lower on injection day.';
    } else {
      pattern += 'No significant difference in symptoms on injection day.';
    }
  }

  return pattern;
}

function generateRecommendations(averageScores, injectionDayPattern) {
  const recommendations = [];

  // High nausea recommendations
  if (averageScores.nausea && averageScores.nausea > 3) {
    recommendations.push({
      type: 'nutrition',
      title: 'Manage Nausea',
      message: 'Try eating smaller, more frequent meals and avoid fatty foods. Ginger can help reduce nausea.',
      priority: 'high'
    });
  }

  // Fatigue recommendations
  if (averageScores.fatigue && averageScores.fatigue > 3) {
    recommendations.push({
      type: 'lifestyle',
      title: 'Combat Fatigue',
      message: 'Focus on getting adequate sleep and consider light exercise like walking to boost energy levels.',
      priority: 'medium'
    });
  }

  // Injection day recommendations
  if (injectionDayPattern?.pattern.includes('higher on injection day')) {
    recommendations.push({
      type: 'medication',
      title: 'Injection Day Preparation',
      message: 'Consider adjusting your meal timing around injection day. Lighter meals may help reduce symptoms.',
      priority: 'high'
    });
  }

  return recommendations;
}

export default withAuth(handler);