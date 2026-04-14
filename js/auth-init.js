// Authentication and initialization script
// Replaces localStorage-based initialization with API-based user data

// Global app state
window.appState = {
  user: null,
  profile: null,
  isLoading: false,
  isAuthenticated: false
};

// Authentication functions - OFFLINE MODE (no API calls)
async function checkAuthentication() {
  try {
    // Check for existing tokens using both possible keys
    const storedToken = localStorage.getItem('auth_token') || localStorage.getItem('authToken');
    
    if (!storedToken) {
      console.log('🔍 No authentication token found');
      return false;
    }
    
    console.log('🔐 OFFLINE AUTH: Token found, user is authenticated');
    
    // NO API VERIFICATION - if token exists, user is authenticated
    return true;
    
  } catch (error) {
    console.error('❌ Error checking authentication:', error);
    return false;
  }
}

function showLoginPrompt() {
  // Create login modal if it doesn't exist
  let loginModal = document.getElementById('loginModal');
  if (!loginModal) {
    loginModal = createLoginModal();
  }
  loginModal.style.display = 'block';
  window.appState.isAuthenticated = false;
}

function createLoginModal() {
  const modal = document.createElement('div');
  modal.id = 'loginModal';
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-content">
      <h2>Welcome to PostDoseRX</h2>
      <p>Please sign in to access your personalized dashboard</p>
      <form id="loginForm">
        <div class="form-group">
          <label for="email">Email:</label>
          <input type="email" id="email" required>
        </div>
        <div class="form-group">
          <label for="name">Name (optional):</label>
          <input type="text" id="name">
        </div>
        <button type="submit" class="btn btn-primary">Sign In</button>
      </form>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Add form handler
  document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const name = document.getElementById('name').value;
    
    try {
      const response = await window.postDoseRXAPI.login(email, name);
      if (response.success) {
        modal.style.display = 'none';
        window.appState.user = response.user;
        window.appState.isAuthenticated = true;
        await initializeApp();
      }
    } catch (error) {
      alert('Login failed: ' + error.message);
    }
  });
  
  return modal;
}

// Load user data from API instead of localStorage
async function loadUserProfile() {
  if (!window.appState.profile) return {};
  
  const profile = window.appState.profile;
  
  // Convert API profile format to the format expected by the existing code
  return {
    medication: profile.medication || '',
    dose: profile.dose_amount || '',
    frequency: 'Weekly', // Default
    lastInjection: '',
    nextInjection: '',
    injectionDay: profile.injection_day || '',
    setupComplete: !!profile.medication,
    preferences: profile.preferences || {}
  };
}

// Save user profile to Supabase API instead of localStorage
async function saveUserProfile(profileData) {
  try {
    console.log('💾 Saving user profile to Supabase API:', profileData);
    
    const apiProfileData = {
      medication: profileData.medication,
      dose_amount: profileData.dose,
      injection_day: profileData.injectionDay,
      preferences: profileData.preferences || {},
      first_name: profileData.firstName || window.appState.user?.name?.split(' ')[0],
      last_name: profileData.lastName || window.appState.user?.name?.split(' ')[1]
    };
    
    const response = await window.postDoseRXAPI.updateUserProfile(apiProfileData);
    if (response && response.success) {
      window.appState.profile = response.data?.profile || response.profile;
      console.log('✅ Profile saved to Supabase successfully');
      return true;
    }
    console.log('❌ Failed to save profile to Supabase');
    return false;
  } catch (error) {
    console.error('❌ Error saving profile to Supabase:', error);
    return false;
  }
}

// Load symptom data from API
async function loadSymptomData() {
  try {
    const response = await window.postDoseRXAPI.getSymptoms();
    if (response.success) {
      // Convert API format to the format expected by existing code
      const symptomsData = {};
      response.symptoms.forEach(symptom => {
        symptomsData[symptom.log_date] = symptom.symptoms;
      });
      return symptomsData;
    }
    return {};
  } catch (error) {
    console.error('Error loading symptoms:', error);
    return {};
  }
}

// Load symptom data from Supabase API (real data)
async function loadSymptomDataFromAPI() {
  try {
    console.log('🔄 Loading symptoms from Supabase API...');
    const response = await window.postDoseRXAPI.getSymptoms();
    if (response && response.success) {
      // Convert API format to the format expected by existing code
      const symptomsData = {};
      if (response.symptoms && Array.isArray(response.symptoms)) {
        response.symptoms.forEach(symptom => {
          symptomsData[symptom.log_date] = symptom.symptoms;
        });
      }
      console.log('✅ Loaded symptoms from API:', Object.keys(symptomsData).length + ' entries');
      return symptomsData;
    }
    console.log('⚠️ No symptoms found or API call failed, returning empty');
    return {};
  } catch (error) {
    console.error('❌ Error loading symptoms from API:', error);
    return {};
  }
}

// Load progress data from Supabase API (real data)  
async function loadProgressDataFromAPI() {
  try {
    console.log('🔄 Loading progress data from Supabase API...');
    const response = await window.postDoseRXAPI.getProgress();
    if (response && response.success) {
      // Convert API format to existing code format
      const progressData = {
        weightLogs: response.data?.logs?.map(log => ({
          date: log.log_date,
          weight: log.weight_lbs,
          notes: log.notes
        })) || []
      };
      console.log('✅ Loaded progress data from API:', progressData.weightLogs.length + ' entries');
      return progressData;
    }
    console.log('⚠️ No progress data found or API call failed, returning empty');
    return { weightLogs: [] };
  } catch (error) {
    console.error('❌ Error loading progress data from API:', error);
    return { weightLogs: [] };
  }
}

// Load meal ratings from Supabase API (real data)
async function loadMealRatingsFromAPI() {
  try {
    console.log('🔄 Loading meal ratings from Supabase API...');
    const response = await window.postDoseRXAPI.getMealRatings();
    if (response && response.success) {
      const ratingsData = {};
      if (response.ratings && Array.isArray(response.ratings)) {
        response.ratings.forEach(rating => {
          ratingsData[rating.meal_id] = {
            rating: rating.rating,
            feedback: rating.feedback,
            date: rating.log_date
          };
        });
      }
      console.log('✅ Loaded meal ratings from API:', Object.keys(ratingsData).length + ' entries');
      return ratingsData;
    }
    console.log('⚠️ No meal ratings found or API call failed, returning empty');
    return {};
  } catch (error) {
    console.error('❌ Error loading meal ratings from API:', error);
    return {};
  }
}

// Save symptom log to API
async function saveSymptomLog(logDate, symptoms, note = '') {
  try {
    const response = await window.postDoseRXAPI.saveSymptomLog({
      log_date: logDate,
      symptoms: symptoms,
      note: note
    });
    return response.success;
  } catch (error) {
    if (error.message.includes('upgradeRequired')) {
      window.postDoseRXAPI.handleAPIError({ upgradeRequired: true, error: error.message });
    } else {
      console.error('Error saving symptom log:', error);
    }
    return false;
  }
}

// Load progress data from API
async function loadProgressData() {
  try {
    const response = await window.postDoseRXAPI.getProgress();
    if (response.success) {
      // Convert API format to existing code format
      const progressData = {
        weightLogs: response.data.logs.map(log => ({
          date: log.log_date,
          weight: log.weight_lbs,
          notes: log.notes
        }))
      };
      return progressData;
    }
    return { weightLogs: [] };
  } catch (error) {
    console.error('Error loading progress:', error);
    return { weightLogs: [] };
  }
}

// Save progress log to API
async function saveProgressLog(logData) {
  try {
    const response = await window.postDoseRXAPI.saveProgressLog({
      log_date: logData.date,
      weight_lbs: logData.weight,
      notes: logData.notes || ''
    });
    return response.success;
  } catch (error) {
    if (error.message.includes('upgradeRequired')) {
      window.postDoseRXAPI.handleAPIError({ upgradeRequired: true, error: error.message });
    } else {
      console.error('Error saving progress log:', error);
    }
    return false;
  }
}

// Load meal ratings from API
async function loadMealRatings() {
  try {
    const response = await window.postDoseRXAPI.getMealRatings();
    if (response.success) {
      const ratingsData = {};
      response.ratings.forEach(rating => {
        ratingsData[rating.meal_id] = {
          rating: rating.rating,
          feedback: rating.feedback,
          date: rating.log_date
        };
      });
      return ratingsData;
    }
    return {};
  } catch (error) {
    console.error('Error loading meal ratings:', error);
    return {};
  }
}

// Save meal ratings to API
async function saveMealRatings(ratingsData, feedbackData = {}) {
  try {
    const response = await window.postDoseRXAPI.saveMealRatings({
      ratings: ratingsData,
      feedback: feedbackData
    });
    return response.success;
  } catch (error) {
    if (error.message.includes('upgradeRequired')) {
      window.postDoseRXAPI.handleAPIError({ upgradeRequired: true, error: error.message });
    } else {
      console.error('Error saving meal ratings:', error);
    }
    return false;
  }
}

// Load meal plan from API
async function loadMealPlan(week = null) {
  try {
    const response = await window.postDoseRXAPI.getMealPlan(week);
    if (response.success) {
      return response.data.plan;
    }
    return null;
  } catch (error) {
    console.error('Error loading meal plan:', error);
    return null;
  }
}

// Initialize the app WITHOUT API dependencies
async function initializeApp() {
  console.log('🚀 OFFLINE MODE: Initializing app without API calls');
  
  // Get user data from URL parameters (from Google auth) or localStorage backup
  const urlParams = new URLSearchParams(window.location.search);
  const emailFromURL = urlParams.get('email');
  const nameFromURL = urlParams.get('name');
  const tierFromURL = urlParams.get('tier');
  
  // Try to get user data from backup or URL
  let userData = null;
  const userBackup = localStorage.getItem('userStateBackup');
  
  if (userBackup) {
    try {
      userData = JSON.parse(userBackup);
      console.log('📦 Restored user data from backup:', userData);
    } catch (error) {
      console.error('❌ Failed to parse user backup');
    }
  }
  
  // Use URL parameters if available (priority over backup)
  if (emailFromURL) {
    userData = {
      email: emailFromURL,
      name: nameFromURL || userData?.name || 'PostDoseRX User',
      tier: tierFromURL || userData?.tier || 'trial'
    };
    
    // Store email in localStorage for subscription management
    localStorage.setItem('user_email', emailFromURL);
    console.log('🔗 Using user data from URL:', userData);
  }
  
  // Final fallback if no data available
  if (!userData) {
    userData = {
      email: 'user@postdoserx.com',
      name: 'PostDoseRX User',
      tier: 'trial'
    };
    console.log('🔄 Using fallback user data');
  }
  
  // Set application state - NO API CALLS REQUIRED
  window.appState.user = userData;
  window.appState.isAuthenticated = true;
  window.appState.isLoading = false;
  
  console.log('✅ User authentication state set (OFFLINE MODE)');
  
  // Load profile data from localStorage (no API calls)
  const storedProfile = localStorage.getItem('medicationProfile');
  let profileData = {};
  
  if (storedProfile) {
    try {
      profileData = JSON.parse(storedProfile);
      console.log('📦 Loaded profile from localStorage');
    } catch (error) {
      console.error('❌ Failed to parse stored profile');
    }
  }
  
  // Set defaults for missing profile data
  profileData = {
    medication: profileData.medication || '',
    dose: profileData.dose || '',
    frequency: profileData.frequency || 'Weekly',
    lastInjection: profileData.lastInjection || '',
    nextInjection: profileData.nextInjection || '',
    injectionDay: profileData.injectionDay || '',
    setupComplete: !!profileData.medication,
    preferences: profileData.preferences || {}
  };
  
  window.appState.profile = profileData;
  console.log('✅ Profile data set (OFFLINE MODE)');
  
  // Update dashboard with profile data (if function exists)
  if (typeof updateDashboardWithProfile === 'function') {
    updateDashboardWithProfile(profileData);
  }
  
  // Load data from localStorage instead of APIs
  console.log('💾 Loading data from localStorage (OFFLINE MODE)');
  
  const symptomData = JSON.parse(localStorage.getItem('symptomData') || '[]');
  const progressData = JSON.parse(localStorage.getItem('progressData') || '{}');  
  const mealRatings = JSON.parse(localStorage.getItem('mealRatings') || '[]');
  
  window.appState.symptomData = symptomData;
  window.appState.progressData = progressData; 
  window.appState.mealRatings = mealRatings;
  
  console.log('✅ All user data loaded from localStorage (OFFLINE MODE)');
  
  // Initialize UI components (skip if functions don't exist)
  try {
    if (typeof initializeSymptomLogger === 'function') {
      initializeSymptomLogger();
    }
    
    if (typeof updateSymptomIntelligence === 'function') {
      updateSymptomIntelligence();
    }
    
    if (typeof updateSymptomTimeline === 'function') {
      updateSymptomTimeline();
    }
    
  } catch (error) {
    console.error('❌ Error initializing UI components:', error);
    // Don't fail the entire app if UI components have issues
  }
  
  console.log('🎉 App initialization complete (OFFLINE MODE) - no API dependencies');
}

// Helper function to update form fields
function updateFormFieldsWithProfile(profileData) {
  const fieldsMap = {
    'medication-select': profileData.medication,
    'dose-input': profileData.dose,
    'frequency-select': profileData.frequency,
    'injection-day': profileData.injectionDay
  };
  
  Object.entries(fieldsMap).forEach(([fieldId, value]) => {
    const field = document.getElementById(fieldId);
    if (field && value) {
      field.value = value;
    }
  });
}

// Override localStorage functions for backward compatibility
function createCompatibilityLayer() {
  // Create getter/setter functions that redirect to API calls
  window.getLocalStorageData = async function(key) {
    switch (key) {
      case 'medicationProfile':
        return await loadUserProfile();
      case 'symptomData':
      case 'symptomLogs':
        return await loadSymptomData();
      case 'progressData':
      case 'weightLogs':
        return await loadProgressData();
      case 'mealRatings':
      case 'recipeRatings':
      case 'mealFeedback':
        return await loadMealRatings();
      default:
        return JSON.parse(localStorage.getItem(key) || '{}');
    }
  };
  
  window.setLocalStorageData = async function(key, data) {
    switch (key) {
      case 'medicationProfile':
        return await saveUserProfile(data);
      case 'symptomLogs':
        // This needs to be handled per symptom log
        return true; // Will be replaced by saveSymptomLog calls
      case 'progressData':
      case 'weightLogs':
        // This needs to be handled per progress entry
        return true; // Will be replaced by saveProgressLog calls
      case 'mealRatings':
      case 'recipeRatings':
      case 'mealFeedback':
        return await saveMealRatings(data);
      default:
        localStorage.setItem(key, JSON.stringify(data));
        return true;
    }
  };
}

// Initialize authentication on page load
document.addEventListener('DOMContentLoaded', async function() {
  createCompatibilityLayer();
  
  // Check if we're on the app domain (requires authentication)
  const isAppDomain = window.location.hostname === 'app.postdoserx.com';
  console.log('🏠 Domain check - hostname:', window.location.hostname, 'isAppDomain:', isAppDomain);
  
  if (isAppDomain) {
    // Use dashboard authentication system for app.postdoserx.com
    console.log('🔐 Using dashboard authentication system...');
    
    // Wait for dashboardAuthReady event or initialize directly
    if (typeof initializeDashboardAuth === 'function') {
      const isAuthenticated = await initializeDashboardAuth();
      
      if (isAuthenticated) {
        // CRITICAL: First, try to get user data from URL params (fresh from login)
        const urlParams = new URLSearchParams(window.location.search);
        const emailFromURL = urlParams.get('email');
        const nameFromURL = urlParams.get('name');
        const tierFromURL = urlParams.get('tier');
        const userIdFromURL = urlParams.get('userId');
        
        console.log('🔍 URL parameters detected:', { 
          email: emailFromURL, 
          name: nameFromURL, 
          tier: tierFromURL,
          userId: userIdFromURL 
        });
        
        // Get user data from dashboard auth system
        const user = getCurrentUser();
        console.log('🔍 User from getCurrentUser():', user);
        
        // Use URL params if available (fresh login), otherwise use stored data
        const realUser = {
          id: userIdFromURL || user?.id,
          email: emailFromURL || user?.email,
          name: nameFromURL || user?.name,
          tier: tierFromURL || user?.tier || 'trial'
        };
        
        console.log('🎯 Final real user data:', realUser);
        
        window.appState.user = realUser;
        window.appState.isAuthenticated = true;
        
        // CRITICAL: Set the JWT token in the API client for Supabase calls
        const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
        if (token && window.postDoseRXAPI) {
          window.postDoseRXAPI.setToken(token);
          console.log('✅ JWT token set in API client for Supabase calls');
        }
        
        // Update dashboard UI with real user information
        updateDashboardUIWithRealUser(realUser);
        
        console.log('✅ Dashboard auth completed, loading real user data from Supabase');
        await initializeApp();
      } else {
        // User is not authenticated on app domain - redirect to login
        console.log('🚪 User not authenticated on app domain, redirecting to login');
        window.location.href = '/login';
        return;
      }
      // If not authenticated, dashboard auth will handle redirect
    } else {
      // Fallback to legacy auth if dashboard auth not available
      console.log('⚠️ Dashboard auth not available, using legacy auth');
      await legacyAuthFlow();
    }
  } else {
    // On marketing site - allow demo access for preview
    console.log('🏠 On marketing site - showing demo preview');
    window.appState.user = {
      id: 'demo-user',
      email: 'user@example.com', 
      name: 'Demo User',
      tier: 'trial'
    };
    window.appState.profile = {
      medication: null,
      dose_amount: null,
      injection_day: null,
      preferences: {}
    };
    window.appState.isAuthenticated = false;
    await initializeApp();
  }
});

// Legacy authentication flow (kept for backwards compatibility)
async function legacyAuthFlow() {
  // Handle tokens from URL (OAuth redirect) to prevent loops
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');
  const userId = urlParams.get('userId') || urlParams.get('user_id'); 
  const emailFromURL = urlParams.get('email');
  const nameFromURL = urlParams.get('name');
  const tierFromURL = urlParams.get('tier');
  
  if (token && (userId || emailFromURL)) {
    console.log('🔍 FOUND TOKENS IN URL - token:', token.substring(0, 20) + '...', 'userId:', userId);
    console.log('🔍 FOUND USER DATA IN URL:', { email: emailFromURL, name: nameFromURL, tier: tierFromURL });
    
    try {
      // Store tokens and clean URL
      localStorage.setItem('auth_token', token);
      localStorage.setItem('user_id', userId);
      
      // Clean URL to prevent redirect loops
      const url = new URL(window.location);
      url.search = '';
      window.history.replaceState({}, document.title, url.toString());
      
      console.log('✅ Stored tokens and cleaned URL');
      
      // Verify token with API to get real user data
      const response = await fetch('https://app.postdoserx.com/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const userData = await response.json();
        if (userData.success && userData.user) {
          // Use URL params for fresh data, fallback to API response
          const realUser = {
            id: userId || userData.user.id,
            email: emailFromURL || userData.user.email,
            name: nameFromURL || userData.user.name,
            tier: tierFromURL || userData.user.tier
          };
          
          console.log('✅ Real user data from URL + API:', realUser);
          
          // Set up authenticated user state with real data
          window.appState.user = realUser;
          window.appState.profile = userData.profile || {
            medication: null,
            dose_amount: null,
            injection_day: null,
            preferences: {}
          };
          window.appState.isAuthenticated = true;
          
          // Update UI with real user info immediately
          updateDashboardUIWithRealUser(realUser);
          
          console.log('✅ Token verified, user authenticated:', realUser.email);
          
          // Initialize app
          console.log('🚀 Calling initializeApp...');
          await initializeApp();
          console.log('✅ initializeApp completed successfully');
          
          // CRITICAL: Return early to prevent any further auth logic
          console.log('🛑 RETURNING EARLY - no further auth checks will run');
          return;
        }
      }
      
      // If token verification fails, clear tokens and fall through to normal auth
      console.log('❌ Token verification failed, clearing tokens');
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user_id');
      
    } catch (error) {
      console.error('❌ ERROR in token processing:', error);
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user_id');
    }
  }
  
  console.log('🔐 Running legacy authentication check...');
  const isAuthenticated = await checkAuthentication();
  console.log('🔐 Authentication result:', isAuthenticated);
  
  if (isAuthenticated) {
    console.log('✅ User is authenticated, initializing app');
    await initializeApp();
  } else {
    // Redirect to login for app domain
    window.location.href = 'https://postdoserx.com/login.html';
  }
}

// Create API wrapper to use dashboard auth system
function createAPIWrapper() {
  // Override existing API functions to use dashboard auth when available
  if (typeof authenticatedFetch === 'function') {
    // Update the postDoseRXAPI functions to use the new auth system
    window.postDoseRXAPI.request = async function(endpoint, options = {}) {
      try {
        const response = await authenticatedFetch(endpoint, options);
        return await response.json();
      } catch (error) {
        if (error.message === 'Authentication failed') {
          // Dashboard auth will handle redirect
          throw new Error('Authentication required');
        }
        throw error;
      }
    };
  }
}

// Call API wrapper when dashboard auth is ready
window.addEventListener('dashboardAuthReady', (event) => {
  console.log('Dashboard auth ready, setting up API wrapper');
  createAPIWrapper();
});

// Update dashboard UI with real user information
function updateDashboardUIWithRealUser(user) {
  console.log('🎨 Updating dashboard UI with real user data:', user);
  
  if (!user) {
    console.log('❌ No user data provided to updateDashboardUIWithRealUser');
    return;
  }
  
  // Ensure we have at least email
  if (!user.email) {
    console.log('❌ No email in user data, cannot update UI');
    return;
  }
  
  console.log('🔍 User data breakdown:', {
    email: user.email,
    name: user.name,
    tier: user.tier,
    hasEmail: !!user.email,
    hasName: !!user.name
  });
  
  // Update user name displays
  const userNameElements = ['user-name', 'dropdown-user-name', 'dashboard-title'];
  userNameElements.forEach(id => {
    const element = document.getElementById(id);
    if (element) {
      if (id === 'dashboard-title') {
        // Update welcome message with real name
        const firstName = user.name ? user.name.split(' ')[0] : user.email.split('@')[0];
        element.innerHTML = `Welcome <span id="user-name">${firstName}</span>, here's your personalized <span id="medication-name">Wegovy</span> journey dashboard`;
        console.log('✅ Updated dashboard title with name:', firstName);
      } else {
        const displayName = user.name || user.email.split('@')[0];
        element.textContent = displayName;
        console.log(`✅ Updated ${id} with name:`, displayName);
      }
    } else {
      console.log(`⚠️ Element ${id} not found`);
    }
  });
  
  // Update user email displays
  const userEmailElements = ['dropdown-user-email'];
  userEmailElements.forEach(id => {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = user.email;
      console.log(`✅ Updated ${id} with email:`, user.email);
    } else {
      console.log(`⚠️ Element ${id} not found`);
    }
  });
  
  // Update user tier displays
  const userTierElements = ['user-tier', 'dropdown-user-tier'];
  userTierElements.forEach(id => {
    const element = document.getElementById(id);
    if (element) {
      const tierText = user.tier === 'premium' ? 'Premium Account' : 'Trial Account';
      element.textContent = tierText;
      console.log(`✅ Updated ${id} with tier:`, tierText);
    } else {
      console.log(`⚠️ Element ${id} not found`);
    }
  });
  
  // Update user avatar with real initial
  const userAvatar = document.getElementById('user-avatar');
  if (userAvatar) {
    const initial = user.name ? user.name.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase();
    userAvatar.textContent = initial;
    console.log('✅ Updated user avatar with initial:', initial);
  } else {
    console.log('⚠️ User avatar element not found');
  }
  
  // Update subscription information based on user tier
  if (typeof updateSubscriptionDisplay === 'function') {
    updateSubscriptionDisplay(user);
  }
  
  console.log('✅ Dashboard UI update completed');
}

// Export functions for global access
window.appAuth = {
  checkAuthentication,
  loadUserProfile,
  saveUserProfile,
  loadSymptomData,
  saveSymptomLog,
  loadProgressData,
  saveProgressLog,
  loadMealRatings,
  saveMealRatings,
  loadMealPlan,
  initializeApp,
  legacyAuthFlow,
  updateDashboardUIWithRealUser,
  loadDashboardDataFromAPI
};

// Load user-specific dashboard data from Supabase API
async function loadDashboardDataFromAPI() {
  console.log('🗄️ Loading dashboard data from API...');
  
  const token = localStorage.getItem('auth_token');
  if (!token) {
    console.log('❌ No auth token found, cannot load dashboard data');
    return null;
  }

  try {
    const response = await fetch('https://postdoserx.com/api/dashboard/data', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    const result = await response.json();
    
    if (result.success) {
      console.log('✅ Dashboard data loaded from API:', result.data);
      return result.data;
    } else {
      console.error('❌ API returned error:', result.error);
      return null;
    }
  } catch (error) {
    console.error('❌ Failed to load dashboard data from API:', error);
    return null;
  }
}