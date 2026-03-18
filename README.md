# PostDoseRX User Dashboard

A user-centric dashboard for GLP-1 medication meal planning and symptom tracking with tier-based access controls and personalized data isolation.

## 🎯 Features

### Trial Plan Features
- ✅ Basic meal planning synchronized with dose days
- ✅ Simple grocery list generation  
- ✅ Basic symptom logging (7 days history)
- ✅ User authentication & profile management

### Premium Plan Features  
- 🚀 AI-powered adaptive recipe engine
- 📊 Advanced symptom pattern analytics
- ⭐ Unlimited meal rating & AI learning
- 📈 Comprehensive progress tracking
- 🎯 Injection-day optimization
- 🧠 Personalized recommendations

## 🏗️ Architecture

- **Frontend**: Static HTML/CSS/JS with tier-based UI
- **Backend**: Vercel Serverless Functions (Node.js)
- **Database**: Supabase (PostgreSQL with Row-Level Security)
- **Authentication**: JWT tokens with user_id scoping
- **External APIs**: GoHighLevel CRM, Stripe billing

## 🚀 Quick Start

### 1. Database Setup
1. Create a new Supabase project
2. Run the SQL schema from `database/schema.sql`
3. Note your Supabase URL and service key

### 2. Environment Variables
1. Copy `.env.example` to `.env.local`
2. Fill in your Supabase credentials and other API keys
3. Set environment variables in Vercel dashboard

### 3. Deployment
```bash
# Install dependencies
npm install

# Deploy to Vercel  
vercel --prod

# Set up custom domains
vercel alias <deployment-url> app.postdoserx.com
```

### 4. Required Environment Variables
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
JWT_SECRET=your-jwt-secret-key-min-32-chars
GHL_API_KEY=your-ghl-api-key
GHL_LOCATION_ID=your-ghl-location-id
```

## 📊 Database Schema

### Core Tables
- `users` - User accounts with tier information
- `user_profiles` - Medication info, preferences, onboarding
- `symptom_logs` - Daily symptom tracking per user
- `meal_ratings` - Meal feedback for AI learning
- `meal_plans` - Weekly meal schedules per user
- `grocery_lists` - Shopping lists per user/week
- `progress_logs` - Weight and progress tracking

### Security
- Row-Level Security (RLS) enabled on all tables
- All queries scoped by authenticated user_id
- JWT tokens with 24-hour expiration

## 🛡️ API Endpoints

### Authentication
- `POST /api/auth/login` - User login with tier verification
- `GET /api/auth/me` - Get current user profile

### User Management
- `GET /api/users/me` - Get user profile  
- `PUT /api/users/me` - Update user profile

### Symptom Tracking
- `GET /api/symptoms` - List user symptom logs
- `POST /api/symptoms` - Create/update symptom log
- `GET /api/symptoms/patterns` - Advanced analytics (Premium only)

### Meal Ratings
- `GET /api/ratings` - List user meal ratings
- `POST /api/ratings` - Submit meal ratings

### Meal Planning (Future)
- `GET /api/meals/plan` - Get user meal plan
- `PUT /api/meals/plan` - Update meal plan
- `GET /api/meals/grocery` - Get grocery list

### Progress Tracking (Future)  
- `GET /api/progress` - List progress entries
- `POST /api/progress` - Log progress entry

## 🎨 Tier-Based UI

### Navigation System
- **Trial Features**: Highlighted with teal accents, full access
- **Premium Features**: Gold accents with lock icons for trial users
- **Upgrade Prompts**: Modal overlays with pricing and feature comparison

### Access Control
- API endpoints check user tier via JWT payload
- Trial users get limited data access (e.g., 7 days symptom history)
- Premium features return 403 with `upgradeRequired: true`

## 🔄 Authentication Flow

1. User signs in via postdoserx.com (Google OAuth or email)
2. Backend verifies with GoHighLevel for subscription status  
3. JWT token issued with user_id, email, tier
4. app.postdoserx.com validates token and loads user-specific data
5. All API calls include `Authorization: Bearer <token>`

## 📱 User Experience

### Trial Users
- Access to basic meal planning and symptom tracking
- Clear upgrade prompts for premium features
- 7-day data retention limits
- Stripe checkout integration for upgrades

### Premium Users  
- Full access to all features and unlimited data
- Advanced analytics and personalization
- Priority support and new feature access

## 🚧 Migration from localStorage

Current dashboard uses localStorage for demo purposes. The new backend system provides:

1. **Data Persistence**: User data survives browser/device changes
2. **User Isolation**: Each user sees only their own data  
3. **Tier Enforcement**: API-level access controls
4. **Scalability**: Supports thousands of concurrent users

## 🛠️ Development

```bash
# Local development
vercel dev

# Database migrations  
# Run SQL scripts in Supabase dashboard

# Testing API endpoints
curl -H "Authorization: Bearer <token>" https://app.postdoserx.com/api/auth/me
```

## 📈 Business Impact

- **Scalable Multi-User Platform**: Proper user isolation and data management
- **Clear Upgrade Path**: Trial-to-premium conversion optimization  
- **Data-Driven Personalization**: AI learning from user feedback
- **Professional Medical App**: HIPAA-ready architecture with security controls

---

**Last Updated**: March 2026
**Version**: 2.0.0 - Backend Database Implementation