// Authentication and initialization script
// Replaces localStorage-based initialization with API-based user data

// Global app state
window.appState = {
  user: null,
  profile: null,
  isLoading: false,
  isAuthenticated: false
};

// Authentication functions
async function checkAuthentication() {
  try {
    // Check for existing token first
    const storedToken = localStorage.getItem('auth_token');
    const storedUserId = localStorage.getItem('user_id');
    
    if (!storedToken || !storedUserId) {
      console.log('🔍 No authentication token found, requiring login');
      return false;
    }
    
    // Verify token with API
    const response = await fetch('https://app.postdoserx.com/api/auth/me', {
      headers: {
        'Authorization': `Bearer ${storedToken}`
      }
    });
    
    if (!response.ok) {
      console.log('🔍 Invalid token, clearing and requiring login');
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user_id');
      return false;
    }
    
    const userData = await response.json();
    
    if (userData.success && userData.user) {
      // Set up authenticated user state
      window.appState.user = userData.user;
      window.appState.profile = userData.profile || {
        medication: null,
        dose_amount: null,
        injection_day: null,
        preferences: {}
      };
      window.appState.isAuthenticated = true;
      
      console.log('✅ User authenticated:', userData.user.email);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Authentication check failed:', error);
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_id');
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

// Save user profile to API instead of localStorage
async function saveUserProfile(profileData) {
  try {
    const apiProfileData = {
      medication: profileData.medication,
      dose_amount: profileData.dose,
      injection_day: profileData.injectionDay,
      preferences: profileData.preferences || {}
    };
    
    const response = await window.postDoseRXAPI.updateUserProfile(apiProfileData);
    if (response.success) {
      window.appState.profile = response.profile;
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error saving profile:', error);
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

// Initialize the app with API data
async function initializeApp() {
  if (!window.appState.isAuthenticated) {
    return;
  }
  
  window.appState.isLoading = true;
  
  try {
    // Load user profile and populate forms
    const profileData = await loadUserProfile();
    
    // Update existing form fields with profile data
    updateFormFieldsWithProfile(profileData);
    
    // Update dashboard with profile data
    if (typeof updateDashboardWithProfile === 'function') {
      updateDashboardWithProfile(profileData);
    }
    
    // Load and cache other data
    const [symptomData, progressData, mealRatings] = await Promise.all([
      loadSymptomData(),
      loadProgressData(),
      loadMealRatings()
    ]);
    
    // Store in global state for existing code compatibility
    window.appState.symptomData = symptomData;
    window.appState.progressData = progressData;
    window.appState.mealRatings = mealRatings;
    
    // Initialize existing UI components that depend on this data
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
    console.error('Error initializing app:', error);
  } finally {
    window.appState.isLoading = false;
  }
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
        // Get user data from dashboard auth system
        const user = getCurrentUser();
        window.appState.user = user;
        window.appState.profile = {
          medication: user.medication || null,
          dose_amount: user.dose_amount || null,
          injection_day: user.injection_day || null,
          preferences: user.preferences || {}
        };
        window.appState.isAuthenticated = true;
        
        console.log('✅ Dashboard auth completed, initializing app');
        await initializeApp();
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
  const userId = urlParams.get('user_id');
  
  if (token && userId) {
    console.log('🔍 FOUND TOKENS IN URL - token:', token.substring(0, 20) + '...', 'userId:', userId);
    
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
          // Set up authenticated user state with real data
          window.appState.user = userData.user;
          window.appState.profile = userData.profile || {
            medication: null,
            dose_amount: null,
            injection_day: null,
            preferences: {}
          };
          window.appState.isAuthenticated = true;
          
          console.log('✅ Token verified, user authenticated:', userData.user.email);
          
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
  legacyAuthFlow
};