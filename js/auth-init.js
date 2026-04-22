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

// Initialize authenticated dashboard with user-specific data (PRD §5.6)
async function initializeAuthenticatedDashboard() {
  console.log('🚀 Initializing authenticated dashboard with user-specific data');
  
  const authToken = localStorage.getItem('authToken') || localStorage.getItem('auth_token');
  
  if (!authToken) {
    console.error('❌ No auth token available for dashboard initialization');
    console.log('🚨 REDIRECT_LOGIN_REASON=NO_TOKEN_DASHBOARD_INIT');
    const currentAppUrl = encodeURIComponent(window.location.href);
    window.location.href = `https://app.postdoserx.com/login?redirect=${currentAppUrl}`;
    return;
  }
  
  try {
    // Load user data from API using the real auth token
    console.log('📡 Loading user profile from API...');
    const userResponse = await fetch('/api/users/me', {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    });

    // Only invalid/expired JWT should log the user out. Other failures (5xx, routing)
    // must not create a login.html loop after a successful Google → ?token= handoff.
    if (userResponse.status === 401) {
      console.warn('❌ Session rejected by API (401) — clearing token and sending to login');
      console.log('🚨 REDIRECT_LOGIN_REASON=API_401_REJECTED');
      localStorage.removeItem('authToken');
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user_id');
      const currentAppUrl = encodeURIComponent(window.location.href);
      window.location.href = `https://app.postdoserx.com/login?redirect=${currentAppUrl}`;
      return;
    }

    if (!userResponse.ok) {
      console.warn(
        `⚠️ /api/users/me returned ${userResponse.status}; keeping session and continuing with local state`
      );
    } else {
      const userData = await userResponse.json();

      if (userData.success) {
        // Merge API data with existing app state
        window.appState.user = { ...window.appState.user, ...userData.user };
        window.appState.profile = userData.profile || {};
        window.appState.isAuthenticated = true;
        window.appState.isLoading = false;

        console.log('✅ User profile loaded from API and merged with app state');

        // Update dashboard with real user data
        if (typeof updateDashboardWithProfile === 'function') {
          updateDashboardWithProfile(userData.profile || {});
        }

        // Update UI with real user info
        updateDashboardUIWithRealUser(window.appState.user);
      } else {
        console.warn('⚠️ /api/users/me JSON indicated failure; continuing with local session');
      }
    }
    
    // Load real user data from APIs
    console.log('📊 Loading user-specific data from APIs...');
    
    await Promise.all([
      loadUserDataFromAPI('symptoms'),
      loadUserDataFromAPI('progress'), 
      loadUserDataFromAPI('ratings'),
      loadUserDataFromAPI('mealPlan')
    ]);
    
    // Initialize UI components with real data
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
    }
    
    console.log('🎉 Personalized dashboard initialization complete');
  } catch (error) {
    console.error('❌ Dashboard init error (session preserved):', error);
  }
}

// Legacy initialize function (kept for compatibility, now calls authenticated dashboard)
async function initializeApp() {
  console.log('🔄 Legacy initializeApp called - delegating to authenticated dashboard initialization');
  await initializeAuthenticatedDashboard();
}

// Load user-specific data from APIs
async function loadUserDataFromAPI(dataType) {
  const authToken = localStorage.getItem('authToken') || localStorage.getItem('auth_token');
  
  if (!authToken) {
    console.warn(`No auth token for loading ${dataType}`);
    return;
  }
  
  try {
    let endpoint;
    switch (dataType) {
      case 'symptoms':
        endpoint = '/api/symptoms';
        break;
      case 'progress':
        endpoint = '/api/progress';
        break;
      case 'ratings':
        endpoint = '/api/ratings';
        break;
      case 'mealPlan':
        endpoint = '/api/meals/plan';
        break;
      default:
        console.warn(`Unknown data type: ${dataType}`);
        return;
    }
    
    const response = await fetch(endpoint, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log(`✅ Loaded ${dataType} from API:`, data);
      
      // Store in app state
      switch (dataType) {
        case 'symptoms':
          window.appState.symptomData = data.symptoms || [];
          break;
        case 'progress':
          window.appState.progressData = data.data || {};
          break;
        case 'ratings':
          window.appState.mealRatings = data.ratings || [];
          break;
        case 'mealPlan':
          window.appState.mealPlan = data.data || {};
          break;
      }
    } else {
      console.warn(`Failed to load ${dataType}: ${response.status}`);
    }
    
  } catch (error) {
    console.error(`Error loading ${dataType} from API:`, error);
  }
}

// Helper function to update dashboard UI with real user data (PRD §5.6)
function updateDashboardUIWithRealUser(user) {
  try {
    // Update user name in dashboard header
    const userNameElements = document.querySelectorAll('#user-name, .user-name');
    userNameElements.forEach(element => {
      if (element) {
        element.textContent = user.name || user.email.split('@')[0];
      }
    });
    
    // Update dashboard title with real user name
    const dashboardTitle = document.getElementById('dashboard-title');
    if (dashboardTitle && user.name) {
      const medicationName = window.appState.profile?.medication || 'GLP-1';
      dashboardTitle.innerHTML = `Welcome <span id="user-name">${user.name}</span>, here's your personalized <span id="medication-name">${medicationName}</span> journey dashboard`;
    }
    
    // Update tier-specific elements
    if (user.tier === 'premium') {
      const premiumElements = document.querySelectorAll('.premium-feature');
      premiumElements.forEach(element => {
        element.classList.remove('disabled');
      });
    }
    
    console.log('✅ Dashboard UI updated with real user data');
  } catch (error) {
    console.error('❌ Error updating dashboard UI:', error);
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

// Parse hash parameters from URL (handles #token=...&email=... format)


function clearLegacyCrossUserDataIfNeeded(currentUserId) {
  if (!currentUserId) return;

  const lastUserId = localStorage.getItem('last_authenticated_user_id');
  if (lastUserId && lastUserId !== currentUserId) {
    // Remove legacy non-user-scoped dashboard caches that can leak prior user's data.
    [
      'symptomData',
      'symptomLogs',
      'weightData',
      'mealFeedback',
      'mealRatings',
      'recipeRatings',
      'medicationProfile',
      'progressData',
      'weightLogs'
    ].forEach((key) => localStorage.removeItem(key));
  }

  localStorage.setItem('last_authenticated_user_id', currentUserId);
}

function parseHashParameters() {
  const hash = window.location.hash;
  if (!hash || hash.length <= 1) {
    return null;
  }
  
  console.log('🔍 Parsing hash parameters:', hash);
  
  // Remove the # and parse as URLSearchParams
  const hashContent = hash.substring(1);
  const params = new URLSearchParams(hashContent);
  
  const result = {};
  for (const [key, value] of params) {
    result[key] = value;
  }
  
  console.log('📦 Parsed hash parameters:', result);
  return Object.keys(result).length > 0 ? result : null;
}

// Initialize authentication on page load
document.addEventListener('DOMContentLoaded', async function() {
  createCompatibilityLayer();
  
  // Check if we're on the app domain (requires authentication)
  const isAppDomain = window.location.hostname === 'app.postdoserx.com';
  console.log('🏠 Domain check - hostname:', window.location.hostname, 'isAppDomain:', isAppDomain);
  
  if (isAppDomain) {
    // CRITICAL: Check for tokens BEFORE any redirect logic to prevent bounce
    const searchParams = new URLSearchParams(window.location.search);
    const hashParams = parseHashParameters();
    const hasToken = searchParams.get('token') || (hashParams && hashParams.token);
    
    if (hasToken) {
      console.log('🔒 BOOTSTRAP: Token detected, setting bootstrap flag to prevent redirects');
      window.__authBootstrapInProgress = true;
      
      // Add safety timeout to clear bootstrap flag
      setTimeout(() => {
        if (window.__authBootstrapInProgress) {
          console.warn('⏰ Bootstrap timeout reached, clearing flag as safety measure');
          window.__authBootstrapInProgress = false;
        }
      }, 10000); // 10 second timeout
    }
    
    // CRITICAL: Process OAuth return tokens BEFORE checking authentication.
    // Login API returns ?token=...&user_id=... (query). Older flows used #token=... (hash).
    // If we skip this, localStorage is empty on first landing → redirect to login → infinite loop.
    console.log('🔍 Checking for token in URL (query + hash) before auth check...');

    const tokenFromQuery = searchParams.get('token');
    if (tokenFromQuery) {
      console.log('🔑 Found auth token in URL query (?token=), storing...');
      console.log('✅ TOKEN_CAPTURED_FROM_QUERY');
      localStorage.setItem('authToken', tokenFromQuery);
      localStorage.setItem('auth_token', tokenFromQuery);
      const uid = searchParams.get('user_id') || searchParams.get('userId');
      if (uid) localStorage.setItem('user_id', uid);
      if (searchParams.get('email')) localStorage.setItem('user_email', searchParams.get('email'));
      if (searchParams.get('name')) localStorage.setItem('user_name', searchParams.get('name'));
      if (searchParams.get('tier')) localStorage.setItem('user_tier', searchParams.get('tier'));
      const clean = new URL(window.location.href);
      clean.search = '';
      window.history.replaceState({}, document.title, clean.pathname + clean.hash);
      console.log('✅ Query auth data stored and URL cleaned');
    }

    // Parse hash parameters (legacy redirect: #token=...)
    if (hashParams && hashParams.token) {
      console.log('🔑 Found auth data in hash, storing tokens...');

      localStorage.setItem('authToken', hashParams.token);
      localStorage.setItem('auth_token', hashParams.token);

      if (hashParams.email) localStorage.setItem('user_email', hashParams.email);
      if (hashParams.name) localStorage.setItem('user_name', hashParams.name);
      if (hashParams.tier) localStorage.setItem('user_tier', hashParams.tier);
      if (hashParams.userId) localStorage.setItem('user_id', hashParams.userId);

      if (window.location.hash) {
        window.history.replaceState(null, null, window.location.pathname + window.location.search);
      }

      console.log('✅ Hash auth data processed, proceeding with initialization...');
    }
    
    // Initialize dashboard authentication if available
    if (typeof window.initializeDashboardAuth === 'function') {
      console.log('🔐 Using dashboard-auth system for authentication');
      try {
        const isAuthenticated = await window.initializeDashboardAuth();
        console.log('✅ Dashboard auth result:', isAuthenticated);
        
        // Clear bootstrap flag after dashboard auth completes
        if (hasToken) {
          console.log('✅ BOOTSTRAP: Dashboard auth complete, clearing bootstrap flag');
          window.__authBootstrapInProgress = false;
        }
        
        if (isAuthenticated) {
          console.log('✅ Dashboard authentication successful, proceeding to app');
          // Continue to app initialization below
        } else {
          console.log('❌ Dashboard authentication failed');
          if (!window.__authBootstrapInProgress) {
            const currentAppUrl = encodeURIComponent(window.location.href);
            window.location.href = `https://postdoserx.com/login.html?redirect=${currentAppUrl}`;
          }
          return;
        }
      } catch (error) {
        console.error('❌ Dashboard auth error:', error);
        // Fall back to simple token check below
      }
    } else {
      console.log('⚠️ Dashboard-auth not available, using simple token check');
      
      // Clear bootstrap flag after token processing is complete
      if (hasToken) {
        console.log('✅ BOOTSTRAP: Token processing complete, clearing bootstrap flag');
        window.__authBootstrapInProgress = false;
      }
      
      // Use simple token-based authentication for app.postdoserx.com
      console.log('🔐 Checking authentication for app.postdoserx.com...');
      
      // Simple token check - redirect if no token
      const authToken = localStorage.getItem('authToken') || localStorage.getItem('auth_token');
      
      if (!authToken) {
        // CRITICAL: Don't redirect if we're still in bootstrap mode
        if (window.__authBootstrapInProgress) {
          console.log('🚨 BLOCKED redirect during bootstrap - token processing in progress');
          return;
        }
        
        console.log('🚪 No authentication token found, redirecting to marketing site login');
        console.log('🚨 REDIRECT_LOGIN_REASON=NO_TOKEN_APP_DOMAIN');
        const currentAppUrl = encodeURIComponent(window.location.href);
        window.location.href = `https://postdoserx.com/login.html?redirect=${currentAppUrl}`;
        return;
      }
    }
    
    console.log('✅ Authentication token found, initializing authenticated user');
    console.log('✅ TOKEN_VERIFIED_PROCEEDING_TO_DASHBOARD');
    
    // Get user data from URL params (fresh from login) or local storage
    const urlParams = new URLSearchParams(window.location.search);
    const emailFromURL = urlParams.get('email');
    const nameFromURL = urlParams.get('name');
    const tierFromURL = urlParams.get('tier');
    const userIdFromURL =
      urlParams.get('userId') || urlParams.get('user_id') || localStorage.getItem('user_id');

    // Also check localStorage for user data (query may already be cleaned after ?token= capture)
    const userEmail = emailFromURL || localStorage.getItem('user_email');
    const userName = nameFromURL || localStorage.getItem('user_name') || 'User';
    const userTier = tierFromURL || localStorage.getItem('user_tier') || 'trial';

    console.log('🎯 User data for authenticated session:', {
      email: userEmail,
      name: userName,
      tier: userTier
    });

    // Set authenticated user state
    window.appState.user = {
      id: userIdFromURL || 'authenticated-user',
      email: userEmail,
      name: userName,
      tier: userTier
    };

    clearLegacyCrossUserDataIfNeeded(window.appState.user.id);
    window.appState.isAuthenticated = true;
    
    console.log('✅ Authenticated user initialized, loading dashboard');
    
    // Load user profile and dashboard data using the authenticated API approach
    await initializeAuthenticatedDashboard();
  } else {
    // Not authenticated - redirect to login (PRD §4.1)
    console.log('❌ No authentication token found, redirecting to login');
    console.log('🚨 REDIRECT_LOGIN_REASON=LEGACY_NO_TOKEN');
    const currentAppUrl = encodeURIComponent(window.location.href);
    window.location.href = `https://app.postdoserx.com/login?redirect=${currentAppUrl}`;
    return;
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
    console.log('🔍 OAuth redirect: credentials present in URL (values not logged)');
    
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
    console.log('🚨 REDIRECT_LOGIN_REASON=LEGACY_NOT_AUTH');
    window.location.href = 'https://app.postdoserx.com/login';
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

// Load user-specific dashboard data from API
async function loadDashboardDataFromAPI() {
  console.log('🗄️ Loading dashboard data from API...');
  
  const authToken = localStorage.getItem('authToken') || localStorage.getItem('auth_token');
  if (!authToken) {
    console.log('❌ No auth token found, cannot load dashboard data');
    return null;
  }

  try {
    // First verify user authentication with /api/users/me
    const userResponse = await fetch('/api/users/me', {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!userResponse.ok) {
      if (userResponse.status === 401) {
        console.log('❌ Token rejected by API (401)');
        return null;
      }
      throw new Error(`User API failed: ${userResponse.status}`);
    }

    const userData = await userResponse.json();
    if (!userData.success) {
      console.log('❌ User API returned failure');
      return null;
    }

    // Load user-specific data from multiple endpoints
    const [symptomsRes, progressRes, ratingsRes] = await Promise.all([
      fetch('/api/symptoms', {
        headers: { 'Authorization': `Bearer ${authToken}` }
      }).catch(() => null),
      fetch('/api/progress', {
        headers: { 'Authorization': `Bearer ${authToken}` }
      }).catch(() => null),
      fetch('/api/ratings', {
        headers: { 'Authorization': `Bearer ${authToken}` }
      }).catch(() => null)
    ]);

    const dashboardData = {
      user: userData.user,
      profile: userData.profile,
      symptoms: symptomsRes?.ok ? await symptomsRes.json() : { symptoms: [] },
      progress: progressRes?.ok ? await progressRes.json() : { data: { logs: [] } },
      ratings: ratingsRes?.ok ? await ratingsRes.json() : { ratings: [] }
    };

    console.log('✅ Dashboard data loaded from API:', dashboardData);
    return dashboardData;

  } catch (error) {
    console.error('❌ Failed to load dashboard data from API:', error);
    return null;
  }
}