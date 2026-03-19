// Grocery list API with automatic generation from meal plans
import { withAuth, supabase } from '../middleware/auth.js';

// Helper function to get current week start (Monday)
function getWeekStart(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().split('T')[0];
}

// Ingredient mapping for common meals
const MEAL_INGREDIENTS = {
  'protein smoothie': ['protein powder', 'banana', 'almond milk', 'spinach', 'ice'],
  'grilled chicken salad': ['chicken breast', 'mixed greens', 'cucumber', 'cherry tomatoes', 'olive oil'],
  'baked salmon': ['salmon fillet', 'broccoli', 'sweet potato', 'lemon', 'herbs'],
  'scrambled eggs': ['eggs', 'butter', 'whole grain bread', 'milk'],
  'turkey wrap': ['turkey slices', 'whole wheat tortilla', 'lettuce', 'tomato', 'avocado'],
  'oatmeal': ['rolled oats', 'protein powder', 'berries', 'almonds', 'cinnamon'],
  'quinoa buddha bowl': ['quinoa', 'chickpeas', 'cucumber', 'bell pepper', 'tahini'],
  'greek yogurt': ['greek yogurt', 'berries', 'honey', 'granola'],
  'tuna salad': ['canned tuna', 'celery', 'red onion', 'mayo', 'crackers'],
  'protein pancakes': ['eggs', 'protein powder', 'oats', 'banana', 'baking powder'],
  'cottage cheese': ['cottage cheese', 'pineapple', 'nuts'],
  'turkey meatballs': ['ground turkey', 'zucchini', 'marinara sauce', 'herbs'],
  'cod': ['cod fillet', 'sweet potato', 'asparagus', 'lemon'],
  'veggie omelet': ['eggs', 'bell pepper', 'onion', 'spinach', 'cheese'],
  'herb-crusted chicken': ['chicken breast', 'herbs', 'breadcrumbs', 'green beans'],
  'asian lettuce wraps': ['ground chicken', 'lettuce cups', 'ginger', 'soy sauce', 'water chestnuts'],
  'white fish': ['white fish fillet', 'rice', 'steamed vegetables', 'herbs']
};

// Generate grocery list from meal plan
function generateGroceryList(mealPlan) {
  const ingredients = new Set();
  const groceryCategories = {
    proteins: [],
    vegetables: [],
    fruits: [],
    grains: [],
    dairy: [],
    pantry: [],
    other: []
  };

  // Extract ingredients from meal plan
  Object.keys(mealPlan).forEach(day => {
    Object.keys(mealPlan[day]).forEach(mealType => {
      const meal = mealPlan[day][mealType];
      const mealName = meal.name.toLowerCase();
      
      // Find matching ingredients
      const matchedIngredients = Object.keys(MEAL_INGREDIENTS).find(key => 
        mealName.includes(key) || key.includes(mealName.split(' ')[0])
      );

      if (matchedIngredients) {
        MEAL_INGREDIENTS[matchedIngredients].forEach(ingredient => {
          ingredients.add(ingredient);
        });
      }
    });
  });

  // Categorize ingredients
  const categoryMap = {
    proteins: ['chicken', 'salmon', 'turkey', 'beef', 'tuna', 'cod', 'fish', 'tofu', 'eggs', 'protein powder'],
    vegetables: ['broccoli', 'spinach', 'lettuce', 'cucumber', 'tomato', 'bell pepper', 'onion', 'celery', 'asparagus', 'zucchini', 'green beans'],
    fruits: ['banana', 'berries', 'lemon', 'pineapple', 'avocado'],
    grains: ['oats', 'quinoa', 'bread', 'rice', 'tortilla', 'crackers', 'breadcrumbs'],
    dairy: ['milk', 'yogurt', 'cheese', 'cottage cheese', 'butter'],
    pantry: ['olive oil', 'honey', 'herbs', 'spices', 'soy sauce', 'mayo', 'marinara sauce', 'tahini', 'baking powder'],
    other: ['ice', 'nuts', 'granola', 'water chestnuts']
  };

  ingredients.forEach(ingredient => {
    let categorized = false;
    Object.keys(categoryMap).forEach(category => {
      if (categoryMap[category].some(item => 
        ingredient.includes(item) || item.includes(ingredient)
      )) {
        groceryCategories[category].push(ingredient);
        categorized = true;
      }
    });
    
    if (!categorized) {
      groceryCategories.other.push(ingredient);
    }
  });

  // Remove duplicates and sort
  Object.keys(groceryCategories).forEach(category => {
    groceryCategories[category] = [...new Set(groceryCategories[category])].sort();
  });

  return groceryCategories;
}

async function handler(req, res) {
  const { method, query, body } = req;
  const { user } = req;

  try {
    if (method === 'GET') {
      // Get grocery list for specific week
      const weekStart = query.week || getWeekStart();
      
      // Try to get existing grocery list
      const { data: existingList, error: listError } = await supabase
        .from('grocery_lists')
        .select('items, checked_items, updated_at')
        .eq('user_id', user.id)
        .eq('week_start', weekStart)
        .single();

      if (existingList) {
        return res.status(200).json({
          success: true,
          data: {
            week_start: weekStart,
            items: existingList.items,
            checked_items: existingList.checked_items || [],
            last_updated: existingList.updated_at
          }
        });
      }

      // Generate grocery list from meal plan
      const { data: mealPlan } = await supabase
        .from('meal_plans')
        .select('plan_data')
        .eq('user_id', user.id)
        .eq('week_start', weekStart)
        .single();

      if (!mealPlan) {
        return res.status(404).json({
          success: false,
          error: 'No meal plan found for this week'
        });
      }

      const groceryList = generateGroceryList(mealPlan.plan_data);

      // Save the generated list
      const { error: saveError } = await supabase
        .from('grocery_lists')
        .insert({
          user_id: user.id,
          week_start: weekStart,
          items: groceryList,
          checked_items: []
        });

      if (saveError) {
        console.error('Error saving grocery list:', saveError);
      }

      return res.status(200).json({
        success: true,
        data: {
          week_start: weekStart,
          items: groceryList,
          checked_items: [],
          generated: true
        }
      });

    } else if (method === 'PUT') {
      // Update grocery list or checked items
      const { week_start, items, checked_items } = body;
      const weekStart = week_start || getWeekStart();

      const updateData = { updated_at: new Date().toISOString() };
      if (items) updateData.items = items;
      if (checked_items !== undefined) updateData.checked_items = checked_items;

      const { error } = await supabase
        .from('grocery_lists')
        .upsert({
          user_id: user.id,
          week_start: weekStart,
          ...updateData
        });

      if (error) {
        return res.status(500).json({
          success: false,
          error: 'Failed to update grocery list'
        });
      }

      return res.status(200).json({
        success: true,
        data: {
          week_start: weekStart,
          items: items || null,
          checked_items: checked_items || null
        }
      });

    } else {
      return res.status(405).json({
        success: false,
        error: 'Method not allowed'
      });
    }

  } catch (error) {
    console.error('Grocery list API error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
}

export default withAuth(handler);