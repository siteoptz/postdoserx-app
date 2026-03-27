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
  const urlParams = new URLSearchParams(window.location.search);
  const tokenParam = urlParams.get('token');
  const userIdParam = urlParams.get('user_id');
  
  // If token is in URL (redirect from login), store it
  if (tokenParam) {
    window.postDoseRXAPI.setToken(tokenParam);
    // Clean URL without reloading
    window.history.replaceState({}, document.title, window.location.pathname + window.location.hash);
  }
  
  // Check if user is authenticated
  if (!window.postDoseRXAPI.isAuthenticated()) {
    showLoginPrompt();
    return false;
  }
  
  try {
    // Get user profile from API
    const response = await window.postDoseRXAPI.getUserProfile();
    if (response.success) {
      window.appState.user = response.user;
      window.appState.profile = response.profile;
      window.appState.isAuthenticated = true;
      return true;
    } else {
      showLoginPrompt();
      return false;
    }
  } catch (error) {
    console.error('Authentication check failed:', error);
    showLoginPrompt();
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
  
  const isAuthenticated = await checkAuthentication();
  if (isAuthenticated) {
    await initializeApp();
  }
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
  initializeApp
};