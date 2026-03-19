// Meal planning API with user-specific personalization
import { withAuth, supabase, applyCORS } from '../middleware/auth.js';

// Helper function to get current week start (Monday)
function getWeekStart(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().split('T')[0];
}

// Default meal plan template
const DEFAULT_MEAL_PLAN = {
  Monday: {
    breakfast: { name: "Protein Smoothie", calories: 280, protein: 25, gentle: true },
    lunch: { name: "Grilled Chicken Salad", calories: 350, protein: 30, gentle: true },
    dinner: { name: "Baked Salmon with Vegetables", calories: 420, protein: 35, gentle: true },
    snack: { name: "Greek Yogurt", calories: 150, protein: 15, gentle: true }
  },
  Tuesday: {
    breakfast: { name: "Scrambled Eggs with Toast", calories: 320, protein: 20, gentle: true },
    lunch: { name: "Turkey Wrap", calories: 380, protein: 25, gentle: true },
    dinner: { name: "Lean Beef Stir-Fry", calories: 400, protein: 32, gentle: false },
    snack: { name: "Protein Bar", calories: 180, protein: 12, gentle: true }
  },
  Wednesday: {
    breakfast: { name: "Oatmeal with Protein Powder", calories: 300, protein: 22, gentle: true },
    lunch: { name: "Quinoa Buddha Bowl", calories: 360, protein: 18, gentle: true },
    dinner: { name: "Grilled Chicken Breast", calories: 390, protein: 40, gentle: true },
    snack: { name: "Cottage Cheese", calories: 120, protein: 14, gentle: true }
  },
  Thursday: {
    breakfast: { name: "Protein Pancakes", calories: 340, protein: 24, gentle: true },
    lunch: { name: "Tuna Salad", calories: 320, protein: 28, gentle: true },
    dinner: { name: "Turkey Meatballs with Zucchini", calories: 380, protein: 30, gentle: true },
    snack: { name: "Almonds", calories: 160, protein: 6, gentle: true }
  },
  Friday: {
    breakfast: { name: "Greek Yogurt Parfait", calories: 290, protein: 20, gentle: true },
    lunch: { name: "Chicken Caesar Salad", calories: 370, protein: 35, gentle: true },
    dinner: { name: "Cod with Sweet Potato", calories: 360, protein: 28, gentle: true },
    snack: { name: "Protein Smoothie", calories: 180, protein: 15, gentle: true }
  },
  Saturday: {
    breakfast: { name: "Veggie Omelet", calories: 330, protein: 22, gentle: true },
    lunch: { name: "Grilled Shrimp Salad", calories: 340, protein: 32, gentle: true },
    dinner: { name: "Herb-Crusted Chicken", calories: 410, protein: 38, gentle: true },
    snack: { name: "String Cheese", calories: 80, protein: 8, gentle: true }
  },
  Sunday: {
    breakfast: { name: "Protein French Toast", calories: 350, protein: 26, gentle: true },
    lunch: { name: "Asian Lettuce Wraps", calories: 320, protein: 24, gentle: true },
    dinner: { name: "Baked White Fish", calories: 350, protein: 30, gentle: true },
    snack: { name: "Hard-Boiled Eggs", calories: 140, protein: 12, gentle: true }
  }
};

// Personalize meal plan based on user profile and ratings
async function personalizeMealPlan(userId, basePlan) {
  try {
    // Get user profile
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('medication, injection_day, preferences')
      .eq('user_id', userId)
      .single();

    // Get recent meal ratings
    const { data: ratings } = await supabase
      .from('meal_ratings')
      .select('meal_name, rating, feedback')
      .eq('user_id', userId)
      .gte('log_date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);

    // Get recent symptom patterns
    const { data: symptoms } = await supabase
      .from('symptom_logs')
      .select('log_date, symptoms')
      .eq('user_id', userId)
      .gte('log_date', new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);

    let personalizedPlan = { ...basePlan };

    // Adjust for injection day (lighter meals)
    if (profile?.injection_day) {
      const injectionDay = profile.injection_day;
      if (personalizedPlan[injectionDay]) {
        personalizedPlan[injectionDay] = {
          breakfast: { name: "Light Protein Smoothie", calories: 220, protein: 20, gentle: true },
          lunch: { name: "Chicken Broth with Crackers", calories: 180, protein: 12, gentle: true },
          dinner: { name: "Plain Grilled Chicken", calories: 250, protein: 28, gentle: true },
          snack: { name: "Banana", calories: 100, protein: 1, gentle: true }
        };
      }
    }

    // Apply dietary preferences
    if (profile?.preferences?.dietary_restrictions) {
      const restrictions = profile.preferences.dietary_restrictions;
      if (restrictions.includes('vegetarian')) {
        // Replace meat-based meals with vegetarian alternatives
        Object.keys(personalizedPlan).forEach(day => {
          Object.keys(personalizedPlan[day]).forEach(meal => {
            const mealData = personalizedPlan[day][meal];
            if (mealData.name.toLowerCase().includes('chicken') || 
                mealData.name.toLowerCase().includes('beef') ||
                mealData.name.toLowerCase().includes('salmon')) {
              mealData.name = mealData.name.replace(/chicken|beef|salmon/gi, 'tofu');
              mealData.protein = Math.max(mealData.protein - 5, 10); // Adjust protein
            }
          });
        });
      }
    }

    // Avoid meals that were rated poorly
    if (ratings?.length > 0) {
      const dislikedMeals = ratings.filter(r => r.rating <= 2 || r.feedback === 'disliked');
      dislikedMeals.forEach(disliked => {
        Object.keys(personalizedPlan).forEach(day => {
          Object.keys(personalizedPlan[day]).forEach(meal => {
            if (personalizedPlan[day][meal].name.toLowerCase().includes(disliked.meal_name.toLowerCase())) {
              // Replace with a safe alternative
              personalizedPlan[day][meal] = {
                name: "Gentle Protein Bowl",
                calories: 300,
                protein: 20,
                gentle: true
              };
            }
          });
        });
      });
    }

    return personalizedPlan;
  } catch (error) {
    console.error('Error personalizing meal plan:', error);
    return basePlan;
  }
}

async function handler(req, res) {
  const { method, query, body } = req;
  const { user } = req;

  try {
    if (method === 'GET') {
      // Get meal plan for specific week
      const weekStart = query.week || getWeekStart();
      
      // Try to get existing meal plan
      const { data: existingPlan, error: planError } = await supabase
        .from('meal_plans')
        .select('plan_data, is_custom, updated_at')
        .eq('user_id', user.id)
        .eq('week_start', weekStart)
        .single();

      if (existingPlan) {
        return res.status(200).json({
          success: true,
          data: {
            week_start: weekStart,
            plan: existingPlan.plan_data,
            is_custom: existingPlan.is_custom,
            last_updated: existingPlan.updated_at
          }
        });
      }

      // Generate new personalized meal plan
      const personalizedPlan = await personalizeMealPlan(user.id, DEFAULT_MEAL_PLAN);

      // Save the generated plan
      const { error: saveError } = await supabase
        .from('meal_plans')
        .insert({
          user_id: user.id,
          week_start: weekStart,
          plan_data: personalizedPlan,
          is_custom: false
        });

      if (saveError) {
        console.error('Error saving meal plan:', saveError);
      }

      return res.status(200).json({
        success: true,
        data: {
          week_start: weekStart,
          plan: personalizedPlan,
          is_custom: false,
          generated: true
        }
      });

    } else if (method === 'PUT') {
      // Update/save meal plan
      const { week_start, plan_data } = body;
      const weekStart = week_start || getWeekStart();

      const { error } = await supabase
        .from('meal_plans')
        .upsert({
          user_id: user.id,
          week_start: weekStart,
          plan_data,
          is_custom: true,
          updated_at: new Date().toISOString()
        });

      if (error) {
        return res.status(500).json({
          success: false,
          error: 'Failed to save meal plan'
        });
      }

      return res.status(200).json({
        success: true,
        data: {
          week_start: weekStart,
          plan: plan_data,
          is_custom: true
        }
      });

    } else {
      return res.status(405).json({
        success: false,
        error: 'Method not allowed'
      });
    }

  } catch (error) {
    console.error('Meal plan API error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
}

export default withAuth(handler);