# PostDoseRX Product Requirements Document (PRD)
*Version 3.0 - Updated December 2024*

## 📋 Executive Summary

PostDoseRX is a comprehensive GLP-1 medication support application that helps users track symptoms, manage nutrition, and optimize their medication journey. This PRD serves as the single source of truth for all features, integrations, and requirements.

## 🎯 Product Overview

### Core Purpose
Support users taking GLP-1 medications (Ozempic, Wegovy, Mounjaro, etc.) with personalized tracking, meal planning, and progress insights.

### Target Users
- **Primary**: Individuals prescribed GLP-1 medications
- **Secondary**: Healthcare providers monitoring patient progress

## 🏗️ System Architecture

### Technical Stack
- **Frontend**: Single HTML file with vanilla JavaScript
- **Backend**: Vercel serverless functions
- **Database**: localStorage + API integration
- **Billing**: Stripe integration
- **CRM**: GoHighLevel (GHL) integration
- **Auth**: Google OAuth + custom token system
- **Deployment**: Vercel with custom domain (app.postdoserx.com)

### Key Integrations
1. **GoHighLevel CRM** - Customer verification and tier management
2. **Stripe** - Payment processing and subscription management  
3. **Google Auth** - User authentication
4. **Vercel** - Hosting and serverless functions

## 🔐 Authentication & Security

### Authentication Flow
```
User Login → Google OAuth → Token Validation → GHL Verification → Tier Assignment → Dashboard Access
```

### Critical Requirements
- **MANDATORY GHL VERIFICATION**: Every user MUST be verified against GHL before trial or premium access
- **No Bypass**: No automatic access without GHL confirmation
- **Re-verification**: Users re-verified on each login session

### User Tiers
- **Trial**: Limited features, upgrade prompts
- **Premium**: Full feature access after GHL verification

## 📊 Core Features & Requirements

### 1. Overview Dashboard
**Purpose**: Central hub showing injection timing and meal planning

**Features**:
- Injection date tracking (last/next injection)
- Dynamic meal plan based on injection cycle
- Real-time countdown and timing calculations
- Personalized messaging by injection phase

**Technical Requirements**:
- User-specific localStorage keys: `postdoserx_last_injection_{email}`, `postdoserx_next_injection_{email}`
- Auto-calculation of injection cycles
- Integration with meal planning system

### 2. Symptom Tracking
**Purpose**: Log and track medication side effects and symptoms

**Features**:
- Daily symptom logging with severity ratings
- Injection date auto-population from Overview
- Symptom history and trend analysis
- Progress tracking and insights

**Technical Requirements**:
- Auto-populate injection dates from Overview page
- Persist symptom data across sessions
- User-specific storage: `postdoserx_symptom_logs_{email}`
- Integration with progress analytics

### 3. Meal Planning & Nutrition
**Purpose**: Provide injection-cycle-aware meal recommendations

**Features**:
- Dynamic meal schedules based on injection timing
- Recipe database with GLP-1-specific meals
- Meal rating and feedback system
- Grocery list generation
- Interactive recipe modals

**Technical Requirements**:
- Meal schedule updates when injection dates change
- Recipe categorization by injection phase
- Meal rating persistence: `postdoserx_meal_ratings_{email}`
- Integration with symptom tracking

### 4. Progress Analytics
**Purpose**: Provide insights and trends from user data

**Features**:
- Real-time progress calculations
- Symptom improvement trends
- Meal success rates
- Achievement tracking
- Comprehensive reporting

**Technical Requirements**:
- Data aggregation from all tracking modules
- Real-time calculation of metrics
- Visual progress displays

### 5. User Account Management
**Purpose**: Manage subscriptions, billing, and account settings

**Features**:
- User dropdown with real data display
- Billing information and subscription status
- Stripe customer portal integration
- Account settings and preferences

**Technical Requirements**:
- Subscription start date tracking
- Integration with Stripe API
- GHL customer verification
- Real-time billing status updates

## 🔄 Data Management & Persistence

### Data Storage Strategy
```javascript
// User-specific keys pattern
const userEmail = 'user@example.com';
const safeEmail = userEmail.replace(/[^a-zA-Z0-9]/g, '_');

// Storage keys
postdoserx_user_{safeEmail}          // Main user profile
postdoserx_last_injection_{safeEmail} // Injection dates
postdoserx_next_injection_{safeEmail}
postdoserx_meal_ratings_{safeEmail}  // Meal feedback
postdoserx_symptom_logs_{safeEmail}  // Symptom tracking
```

### Critical Data Persistence Requirements
1. **Cross-session persistence**: All user data must survive logout/login
2. **User isolation**: Prevent data contamination between users
3. **Backward compatibility**: Check both user-specific AND generic keys
4. **Real-time sync**: Dropdown menus must show current data

### Data Loading Priority
1. User-specific localStorage keys (primary)
2. Generic localStorage keys (fallback)
3. Empty state with helpful messaging

## 🎛️ User Interface Requirements

### User Dropdown Synchronization
**CRITICAL**: All dropdown menu items must show REAL user data, not placeholders

Required dropdown items:
- **Progress & Stats**: Real progress metrics from user activity
- **My Rated Meals**: Actual meal ratings with counts and dates
- **Daily Meal Log**: Chronological meal entries with real data
- **Billing Info**: Current subscription status and billing dates

### Navigation & Views
- Single-page application with view switching
- URL-based navigation for bookmarking
- Responsive design for mobile/desktop
- Tier-based feature access controls

## 💰 Billing & Subscription Management

### Stripe Integration
- Customer portal access for subscription management
- Automatic billing date calculations
- Subscription status tracking
- Payment method management

### Billing Requirements
- Subscription start date persistence: `postdoserx_subscription_start`
- Monthly billing cycle tracking
- Prorated billing calculations
- Upgrade/downgrade flows

### Error Handling
- Graceful Stripe API error handling
- Helpful user messaging for billing issues
- Fallback contact information for support

## 🔗 API Integrations

### GoHighLevel CRM Integration
**Endpoint**: `https://services.leadconnectorhq.com/contacts/search`

**Headers Required**:
```javascript
{
  'Authorization': 'Bearer pit-e2c103d1-89c7-4e4a-9376-e3b50257d66b',
  'Content-Type': 'application/json',
  'Version': '2021-07-28'
}
```

**Location ID**: `ECu5ScdYFmB0WnhvYoBU`

**Response Handling**:
- Customer found → Check tags for tier assignment
- Customer not found → Trial access, notify user
- API error → Trial access, log error

### Stripe Integration
- Customer portal session creation
- Subscription status verification
- Payment method management
- Billing history access

## 🧪 Testing Requirements

### Critical Test Cases
1. **New User Flow**: Google auth → GHL verification → Trial assignment
2. **Existing Premium User**: Login → GHL verification → Premium access
3. **Data Persistence**: Logout/login → All data intact
4. **Cross-user Isolation**: Multiple users → No data contamination
5. **Billing Integration**: Stripe portal access → Successful navigation

### Manual Testing Checklist
- [ ] New user gets trial access after GHL check
- [ ] Premium user verified against GHL database
- [ ] Injection dates persist across sessions
- [ ] Symptom logs save and display correctly
- [ ] Meal ratings appear in dropdown menus
- [ ] Progress stats show real data
- [ ] Billing information displays correctly
- [ ] Stripe portal integration works

## 🚨 Critical Business Rules

### Security & Access Control
1. **NO AUTOMATIC PREMIUM ACCESS** - All users must be verified via GHL
2. **TRIAL BY DEFAULT** - Users are trial until proven premium
3. **RE-VERIFICATION** - Check GHL status on every login
4. **ACCESS CONTROLS** - Premium features locked for trial users

### Data Integrity
1. **USER ISOLATION** - Prevent data mixing between users
2. **PERSISTENCE** - All user data must survive sessions
3. **SYNC** - Dropdown menus must reflect real current data
4. **BACKUP** - Graceful degradation when data missing

### Error Handling
1. **GRACEFUL FAILURES** - Never crash, always provide feedback
2. **HELPFUL MESSAGING** - Clear instructions for users
3. **FALLBACK STATES** - Trial access when systems fail
4. **LOGGING** - Comprehensive error tracking

## 📝 Change Management Process

### Development Workflow
1. **Reference PRD**: Always check requirements before changes
2. **Update PRD**: Document any new features or changes
3. **Test Core Flows**: Run critical test cases
4. **Deploy with Verification**: Verify GHL integration works
5. **Update Documentation**: Keep PRD current

### Critical Files
- `index.html` - Main application file
- `POSTDOSERX_PRD.md` - This requirements document
- `vercel.json` - Deployment configuration

### Deployment Checklist
- [ ] GHL verification active
- [ ] User data persistence working
- [ ] Dropdown menus showing real data
- [ ] Billing integration functional
- [ ] Access controls enforced
- [ ] Error handling working

## 🔧 Technical Maintenance

### Regular Maintenance Tasks
1. **Weekly**: Verify GHL API access and credentials
2. **Monthly**: Test full user flows end-to-end
3. **Quarterly**: Review and update PRD with new features
4. **As needed**: Update API keys and integrations

### Monitoring & Alerts
- GHL API response times and errors
- User authentication success rates
- Data persistence validation
- Billing integration health

## 📞 Support & Escalation

### Technical Issues
- **Primary**: Development team
- **Escalation**: System administrator
- **Critical**: Immediate PRD consultation

### Business Issues
- **Billing**: Stripe support + internal billing team
- **Customer**: GHL CRM + support team
- **Access**: Security team + development

## 📄 Document Control

### Version History
- **v1.0**: Initial implementation
- **v2.0**: Added GHL verification and billing
- **v3.0**: Added comprehensive PRD and change management

### Review Schedule
- **Monthly**: Feature requirements review
- **Quarterly**: Full PRD update and validation
- **As needed**: Emergency updates for critical issues

### Approval Required
- Changes affecting billing/security
- New integrations or third-party services
- User tier or access control modifications

---

**Last Updated**: December 2024  
**Next Review**: January 2025  
**Document Owner**: Development Team  
**Approval**: Product Owner Required