// User profile API
import { withAuth, supabase } from '../middleware/auth.js';

async function handler(req, res) {
  const { user, userId } = req;

  if (req.method === 'GET') {
    // Get user profile data
    try {
      const { data: profile, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
        console.error('Error fetching profile:', error);
        return res.status(500).json({ error: 'Failed to fetch profile' });
      }

      return res.status(200).json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          tier: user.tier
        },
        profile: profile || {
          medication: null,
          dose_amount: null,
          injection_day: null,
          start_date: null,
          preferences: {},
          onboarding_completed: false
        }
      });

    } catch (error) {
      console.error('Profile fetch error:', error);
      return res.status(500).json({ error: 'Failed to fetch profile' });
    }
  }

  if (req.method === 'PUT') {
    // Update user profile
    const { 
      name, 
      medication, 
      dose_amount, 
      injection_day, 
      start_date, 
      preferences,
      onboarding_completed 
    } = req.body;

    try {
      // Update user name if provided
      if (name) {
        const { error: userError } = await supabase
          .from('users')
          .update({ name })
          .eq('id', userId);

        if (userError) {
          console.error('Error updating user name:', userError);
          return res.status(500).json({ error: 'Failed to update user name' });
        }
      }

      // Upsert user profile
      const profileData = {
        user_id: userId,
        ...(medication !== undefined && { medication }),
        ...(dose_amount !== undefined && { dose_amount }),
        ...(injection_day !== undefined && { injection_day }),
        ...(start_date !== undefined && { start_date }),
        ...(preferences !== undefined && { preferences }),
        ...(onboarding_completed !== undefined && { onboarding_completed })
      };

      const { data: updatedProfile, error: profileError } = await supabase
        .from('user_profiles')
        .upsert(profileData, {
          onConflict: 'user_id'
        })
        .select()
        .single();

      if (profileError) {
        console.error('Error updating profile:', profileError);
        return res.status(500).json({ error: 'Failed to update profile' });
      }

      return res.status(200).json({
        success: true,
        profile: updatedProfile,
        message: 'Profile updated successfully'
      });

    } catch (error) {
      console.error('Profile update error:', error);
      return res.status(500).json({ error: 'Failed to update profile' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

export default withAuth(handler);