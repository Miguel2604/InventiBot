# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

InventiBot is a Facebook Messenger chatbot for property management that helps residents with common inquiries and requests. It's built with TypeScript, Node.js, and integrates with Supabase for backend operations.

## Architecture

### Technology Stack
- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js for webhook handling
- **Database**: Supabase (PostgreSQL with Row Level Security)
- **Platform**: Facebook Messenger API
- **Session Management**: node-cache for in-memory caching
- **Authentication**: Invite code system via Supabase

### Key Integration Flow
```
Facebook Messenger → Webhook (Express) → Handler Layer → Supabase Backend
                                       ↓
                            Session Cache (node-cache)
```

### Core Components

**Services** (`src/services/`)
- `facebook.service.ts`: Facebook Messenger API interactions, message sending, profile setup
- `auth.service.ts`: User authentication, invite code validation, session management

**Handlers** (`src/handlers/`)
- `faq.handler.ts`: FAQ system with quick reply navigation
- `auth.handler.ts`: User onboarding and authentication flow
- `maintenance.handler.ts`: Maintenance request creation and tracking
- `booking.handler.ts`: Amenity booking system

**Configuration** (`src/config/`)
- `env.ts`: Environment variable validation and configuration
- `supabase.ts`: Supabase client initialization and database types

## Development Commands

### Local Development
```bash
# Install dependencies
npm install

# Run in development mode with hot-reload
npm run dev

# Build TypeScript to JavaScript
npm run build

# Start production server
npm start
```

### Testing
```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage

# Run unit tests only
npm run test:unit

# Run integration tests only  
npm run test:integration

# Test live API endpoints (requires running server)
npm run test:api
```

**Test Suite Status (as of latest update):**
- Unit tests are passing for core services (FAQHandler, AuthHandler)
- Integration tests have some failures due to mock setup issues
- Overall coverage is ~28% (target: 80%)
- TypeScript compilation errors have been resolved
- Application builds and runs successfully

### Setup & Configuration
```bash
# Set up Facebook Messenger profile (greeting, menu, etc.)
npm run setup

# For local testing with ngrok
ngrok http 3000
```

## Environment Configuration

Create `.env` file from `.env.example`:

```env
# Server
PORT=3000
HOST=localhost
DEBUG=true

# Facebook Messenger
FACEBOOK_VERIFY_TOKEN=<generate-random-string>
FACEBOOK_ACCESS_TOKEN=<page-access-token>
FACEBOOK_APP_SECRET=<app-secret>

# Supabase
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_ANON_KEY=<anon-key>

# Session
SESSION_DURATION_HOURS=24
```

## Database Setup

1. Create Supabase project at supabase.com
2. Run migrations in SQL Editor:
   - Execute `supabase/schema.sql` for table creation
   - Execute `supabase/seed.sql` for sample data
3. Create storage buckets: `maintenance-media` and `amenity-images`

## Facebook Messenger Integration

### Webhook Configuration
- **Callback URL**: `https://YOUR_DOMAIN/webhook`
- **Verify Token**: Must match `FACEBOOK_VERIFY_TOKEN`
- **Subscriptions**: `messages`, `messaging_postbacks`, `messaging_optins`

### Quick Reply Flow Structure
The bot uses a hierarchical quick reply system:
- Main Menu → Category Selection → Subcategory → Action/Response
- Every menu includes navigation: Back, Main Menu, Talk to Manager
- Maximum 11 quick replies per Facebook's limitation

## Key Database Tables

- **invites**: Onboarding codes for new tenants
- **user_profiles**: Extended user information linked to Supabase Auth
- **maintenance_requests**: Service request tracking
- **bookings**: Amenity reservations
- **faqs**: Knowledge base for chatbot responses
- **chatbot_conversations**: Interaction logging
- **buildings/units**: Property structure
- **amenities**: Bookable facilities

## Deployment

### Render Deployment
```bash
# Deploy to Render
# 1. Connect GitHub repository
# 2. Set build command: npm install
# 3. Set start command: npm start
# 4. Add environment variables
# 5. Deploy
```

### Health Check
```bash
curl https://YOUR_DOMAIN/health
# Expected: {"status":"ok"}
```

## Testing Strategies

### Unit Tests
- Handler logic validation
- Service method testing
- Session management verification

### Integration Tests
- Complete conversation flows
- Webhook endpoint testing
- Database operation validation

### Manual Testing Flow
1. Send message to Facebook Page
2. Bot responds with authentication prompt
3. Enter invite code
4. Navigate through FAQ system
5. Test maintenance requests
6. Test amenity bookings

## Common Webhook Payloads

### Message Event
```typescript
{
  sender: { id: 'facebook_user_id' },
  message: { 
    text: 'user message',
    quick_reply?: { payload: 'PAYLOAD_STRING' }
  }
}
```

### Postback Event
```typescript
{
  sender: { id: 'facebook_user_id' },
  postback: { 
    payload: 'ACTION_PAYLOAD',
    title: 'Button Title'
  }
}
```

## Error Handling Patterns

- All handlers return consistent error responses
- Facebook API errors are caught and logged
- Supabase errors include retry logic
- Session validation happens before database operations

## Performance Considerations

- Session cache reduces database queries
- FAQ responses are cached per building
- Quick replies are generated dynamically but follow consistent patterns
- Webhook must respond within 20 seconds

## Security Implementation

- Webhook signature verification using `crypto.timingSafeEqual`
- Environment variables for all sensitive data
- RLS policies enforced at database level
- Invite codes expire after use
- No PII in logs

## Quick Debugging

```bash
# Check server logs
npm run dev

# Verify webhook subscription
curl -X GET "https://graph.facebook.com/v18.0/me/messenger_profile?access_token=TOKEN"

# Test database connection
npx ts-node -e "require('./src/config/supabase').supabase.from('buildings').select('*').then(console.log)"

# Clear session cache (restart server)
# Sessions are in-memory and cleared on restart
```

## Important Code Patterns

### Handler Response Pattern
All handlers should return standardized responses:
```typescript
{
  success: boolean,
  message?: string,
  data?: any,
  error?: string
}
```

### Session Validation Pattern
Always validate session before database operations:
```typescript
const session = await authService.getSession(senderId);
if (!session) {
  return { success: false, error: 'Not authenticated' };
}
```

### Quick Reply Navigation Pattern
Include consistent navigation in all quick reply sets:
```typescript
[
  ...contentReplies,
  { title: '↩️ Back', payload: 'BACK' },
  { title: '🏠 Main Menu', payload: 'MAIN_MENU' }
]
```

## Project-Specific Rules

1. **FAQ System**: Always check building-specific FAQs first, fall back to global
2. **Authentication**: Use invite codes for onboarding, not direct registration
3. **Quick Replies**: Prefer quick replies over free text input for all interactions
4. **Session Duration**: Sessions expire after 24 hours (configurable)
5. **Media Handling**: Store in Supabase Storage, save URLs in database
6. **Error Messages**: User-friendly messages, technical details in logs only
7. **Database Operations**: Always use Supabase client, never direct SQL in app code
8. **Testing**: Maintain >80% coverage, test all conversation flows
