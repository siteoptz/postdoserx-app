// Meal ratings API
import { withAuth, supabase, requirePremium } from '../middleware/auth.js';

async function handler(req, res) {
  const { user, userId } = req;

  if (req.method === 'GET') {
    // Get meal ratings for user
    const { from, to, limit = 50 } = req.query;

    try {
      let query = supabase
        .from('meal_ratings')
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

      const { data: ratings, error } = await query;

      if (error) {
        console.error('Error fetching ratings:', error);
        return res.status(500).json({ error: 'Failed to fetch meal ratings' });
      }

      // Calculate summary stats
      const stats = calculateRatingStats(ratings);

      return res.status(200).json({
        success: true,
        ratings: ratings || [],
        stats,
        count: ratings?.length || 0
      });

    } catch (error) {
      console.error('Ratings fetch error:', error);
      return res.status(500).json({ error: 'Failed to fetch ratings' });
    }
  }

  if (req.method === 'POST') {
    // Submit meal ratings
    const { ratings, feedback = {} } = req.body;

    if (!ratings || typeof ratings !== 'object') {
      return res.status(400).json({ 
        error: 'ratings object is required' 
      });
    }

    const logDate = new Date().toISOString().split('T')[0];

    // For trial users, limit rating frequency
    if (user.tier === 'trial') {
      const today = new Date().toISOString().split('T')[0];
      const { data: todayRatings } = await supabase
        .from('meal_ratings')
        .select('id')
        .eq('user_id', userId)
        .eq('log_date', today);

      if (todayRatings && todayRatings.length >= 5) {
        return res.status(403).json({
          error: 'Trial users are limited to 5 meal ratings per day',
          upgradeRequired: true,
          upgradeMessage: 'Upgrade to Premium for unlimited meal ratings and personalized recommendations'
        });
      }
    }

    try {
      // Prepare rating records
      const ratingRecords = Object.entries(ratings).map(([mealId, rating]) => ({
        user_id: userId,
        meal_id: mealId,
        meal_name: getMealNameFromId(mealId),
        rating: parseInt(rating),
        feedback: feedback[mealId] || null,
        log_date: logDate
      }));

      // Insert ratings
      const { data: savedRatings, error } = await supabase
        .from('meal_ratings')
        .upsert(ratingRecords, {
          onConflict: 'user_id,meal_id,log_date'
        })
        .select();

      if (error) {
        console.error('Error saving ratings:', error);
        return res.status(500).json({ error: 'Failed to save meal ratings' });
      }

      return res.status(200).json({
        success: true,
        ratings: savedRatings,
        message: 'Meal ratings saved successfully',
        count: savedRatings.length
      });

    } catch (error) {
      console.error('Ratings save error:', error);
      return res.status(500).json({ error: 'Failed to save ratings' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

function calculateRatingStats(ratings) {
  if (!ratings || ratings.length === 0) {
    return {
      totalRatings: 0,
      averageRating: 0,
      ratingDistribution: {},
      favoriteCategory: null
    };
  }

  const totalRatings = ratings.length;
  const ratingSum = ratings.reduce((sum, r) => sum + r.rating, 0);
  const averageRating = Number((ratingSum / totalRatings).toFixed(1));

  // Rating distribution
  const distribution = {};
  ratings.forEach(r => {
    distribution[r.rating] = (distribution[r.rating] || 0) + 1;
  });

  // Favorite category (would need meal category mapping)
  const favoriteCategory = 'Breakfast'; // Placeholder

  return {
    totalRatings,
    averageRating,
    ratingDistribution: distribution,
    favoriteCategory
  };
}

function getMealNameFromId(mealId) {
  // Map meal IDs to names - this would be expanded with actual meal database
  const mealNames = {
    'breakfast-1': 'Protein Scramble',
    'breakfast-2': 'Greek Yogurt Bowl',
    'lunch-1': 'Chicken Salad',
    'lunch-2': 'Soup & Sandwich',
    'dinner-1': 'Grilled Salmon',
    'dinner-2': 'Lean Beef Stir-fry',
    'snack-1': 'Apple & Nuts',
    'snack-2': 'Veggie Sticks'
  };

  return mealNames[mealId] || `Meal ${mealId}`;
}

export default withAuth(handler);