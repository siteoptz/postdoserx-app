// API Client for PostDoseRx App
// Handles authentication and API calls to the backend

class PostDoseRXAPI {
  constructor() {
    this.baseURL = '/api';
    this.token = localStorage.getItem('authToken');
  }

  // Set authentication token
  setToken(token) {
    this.token = token;
    if (token) {
      localStorage.setItem('authToken', token);
    } else {
      localStorage.removeItem('authToken');
    }
  }

  // Get authentication headers
  getAuthHeaders() {
    const headers = {
      'Content-Type': 'application/json',
    };
    
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    
    return headers;
  }

  // Generic API request method
  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      headers: this.getAuthHeaders(),
      ...options,
    };

    if (config.body && typeof config.body === 'object') {
      config.body = JSON.stringify(config.body);
    }

    try {
      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP error! status: ${response.status}`);
      }

      return data;
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  // Authentication methods
  async login(email, name, tier = 'trial') {
    const response = await this.request('/auth/login', {
      method: 'POST',
      body: { email, name, tier },
    });

    if (response.success && response.token) {
      this.setToken(response.token);
    }

    return response;
  }

  async logout() {
    this.setToken(null);
    localStorage.clear(); // Clear all localStorage for clean logout
  }

  // User profile methods
  async getUserProfile() {
    return this.request('/users/me');
  }

  async updateUserProfile(profileData) {
    return this.request('/users/me', {
      method: 'PUT',
      body: profileData,
    });
  }

  // Symptom tracking methods
  async getSymptoms(from, to, limit = 30) {
    const params = new URLSearchParams();
    if (from) params.append('from', from);
    if (to) params.append('to', to);
    if (limit) params.append('limit', limit);

    const queryString = params.toString();
    const endpoint = `/symptoms${queryString ? `?${queryString}` : ''}`;
    
    return this.request(endpoint);
  }

  async saveSymptomLog(logData) {
    return this.request('/symptoms', {
      method: 'POST',
      body: logData,
    });
  }

  // Progress tracking methods
  async getProgress(from, to) {
    const params = new URLSearchParams();
    if (from) params.append('from', from);
    if (to) params.append('to', to);

    const queryString = params.toString();
    const endpoint = `/progress${queryString ? `?${queryString}` : ''}`;
    
    return this.request(endpoint);
  }

  async saveProgressLog(progressData) {
    return this.request('/progress', {
      method: 'POST',
      body: progressData,
    });
  }

  // Meal rating methods
  async getMealRatings(from, to, limit = 50) {
    const params = new URLSearchParams();
    if (from) params.append('from', from);
    if (to) params.append('to', to);
    if (limit) params.append('limit', limit);

    const queryString = params.toString();
    const endpoint = `/ratings${queryString ? `?${queryString}` : ''}`;
    
    return this.request(endpoint);
  }

  async saveMealRatings(ratingsData) {
    return this.request('/ratings', {
      method: 'POST',
      body: ratingsData,
    });
  }

  // Meal plan methods
  async getMealPlan(week) {
    const params = new URLSearchParams();
    if (week) params.append('week', week);

    const queryString = params.toString();
    const endpoint = `/meals/plan${queryString ? `?${queryString}` : ''}`;
    
    return this.request(endpoint);
  }

  async saveMealPlan(planData) {
    return this.request('/meals/plan', {
      method: 'PUT',
      body: planData,
    });
  }

  // Grocery list methods
  async getGroceryList(week) {
    const params = new URLSearchParams();
    if (week) params.append('week', week);

    const queryString = params.toString();
    const endpoint = `/meals/grocery${queryString ? `?${queryString}` : ''}`;
    
    return this.request(endpoint);
  }

  async saveGroceryList(groceryData) {
    return this.request('/meals/grocery', {
      method: 'PUT',
      body: groceryData,
    });
  }

  // Check if user is authenticated
  isAuthenticated() {
    return !!this.token;
  }

  // Handle upgrade prompts for trial users
  showUpgradeModal(message, feature) {
    // You can customize this based on your UI
    if (confirm(`${message}\n\nWould you like to upgrade to Premium now?`)) {
      window.location.href = '/upgrade';
    }
  }

  // Error handler for API responses
  handleAPIError(error) {
    if (error.upgradeRequired) {
      this.showUpgradeModal(error.error, error.feature);
      return;
    }

    // Show user-friendly error message
    console.error('API Error:', error);
    if (typeof window !== 'undefined' && window.showNotification) {
      window.showNotification(error.message || 'An error occurred', 'error');
    }
  }
}

// Create global API instance
window.postDoseRXAPI = new PostDoseRXAPI();

// Export for use in modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PostDoseRXAPI;
}