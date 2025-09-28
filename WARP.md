# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

InventiBot is a conversational property management system that runs entirely through Facebook Messenger. It integrates multiple building management systems into a unified chat interface, supporting residents, visitors, and property managers.

## Core Architecture

### Tech Stack
- **Runtime**: Node.js 18+ with TypeScript 5.9+
- **Database**: Supabase (PostgreSQL with real-time subscriptions)
- **Messaging**: Facebook Messenger Platform API
- **IoT Integration**: Home Assistant via REST API (JavaScript module)
- **Testing**: Jest with ts-jest, 87% coverage target
- **Security**: Webhook signature verification, JWT tokens

### Application Structure
```
src/
├── index.ts                    # Main Express server & webhook router
├── config/                     # Environment & database configuration
│   ├── env.ts                 # Environment variables with validation
│   └── supabase.ts            # Supabase client & admin client setup
├── handlers/                   # Feature-specific message handlers
│   ├── auth.handler.ts        # Authentication & access code flow
│   ├── faq.handler.ts         # FAQ system with quick replies
│   ├── maintenance.handler.ts  # Maintenance request workflow
│   ├── booking.handler.ts     # Amenity booking system
│   ├── visitor-pass.handler.ts # Visitor pass creation & management
│   └── announcements.handler.ts # Building announcements
├── services/                   # External service integrations
│   ├── facebook.service.ts    # Messenger API wrapper
│   └── auth.service.ts        # User authentication & session management
├── features/iot/              # IoT module (JavaScript legacy)
│   ├── index.js              # Main IoT module entry point
│   ├── iotManager.js         # IoT session & device management
│   ├── haClient.js           # Home Assistant REST API client
│   ├── deviceMenu.js         # Dynamic device menu generation
│   ├── commandHandler.js     # IoT command routing & execution
│   ├── setupFlow.js          # Initial IoT configuration flow
│   ├── deviceParser.js       # Home Assistant entity parsing
│   ├── dbAdapter.js          # Database abstraction for IoT
│   └── encryption.js         # Token encryption utilities
├── types/                     # TypeScript type definitions
│   └── facebook.ts           # Messenger API types
└── utils/                     # Shared utilities
    ├── logger.ts             # Structured logging (multiple loggers)
    └── timezone.ts           # Timezone handling utilities
```

### Key Architectural Patterns

#### 1. **Handler-based Message Routing**
Each feature has a dedicated handler class with standardized methods:
- `handlePayload(senderId, payload)` - Process quick reply/postback actions
- `handleTextInput(senderId, text)` - Process free-form text during flows
- Feature handlers manage their own state using Maps for active sessions

#### 2. **Conversational Flow Management**
State tracking using Maps in main `index.ts`:
- `awaitingAuth` - Users in authentication flow
- `inMaintenanceFlow` - Users creating maintenance requests
- `inVisitorPassFlow` - Users creating visitor passes
- IoT module maintains its own session state

#### 3. **Database Architecture**
- **Regular Client**: Row Level Security (RLS) enforced
- **Admin Client**: Bypasses RLS for system operations (IoT, webhooks)
- Real-time subscriptions for announcements via Supabase webhooks

#### 4. **Security Model**
- Webhook signature verification using Facebook app secret
- Access codes for resident authentication (format: `[A-Z0-9-]{4,}`)
- Visitor passes with unique codes (format: `VP*`)
- JWT-based session management

## Development Commands

### Environment Setup
```bash
# Install dependencies (installs TypeScript, Jest, and all dependencies)
npm install

# Setup Facebook Messenger profile (greeting, persistent menu)
npm run setup
```

### Development Workflow
```bash
# Development with hot reload (uses nodemon + ts-node)
npm run dev

# TypeScript compilation with copying IoT features
npm run build

# Production start (requires build first)
npm start
```

### Testing Commands
```bash
# Run all tests with Jest
npm test

# Run tests with coverage report (80% threshold required)
npm run test:coverage

# Run only unit tests
npm run test:unit

# Run only integration tests
npm run test:integration

# Watch mode for development
npm run test:watch

# Manual API testing (requires server running)
npm run test:api
```

### Build Process Details
The build process (`npm run build`) does two things:
1. Compiles TypeScript from `src/` to `dist/` using the config in `config/tsconfig.json`
2. Copies the IoT features directory (JavaScript files) to `dist/features/` since they're not TypeScript

## Key Development Patterns

### 1. **Messenger Integration**
- All outbound messages go through `facebookService.sendTextMessage()` or `facebookService.sendQuickReply()`
- Webhook verification is mandatory in production
- User profiles fetched via Graph API for personalization

### 2. **Authentication Flow**
- Unauthenticated users are prompted with "Resident vs Visitor" choice
- Residents use alphanumeric access codes
- Visitors use `VP*` format codes for temporary access
- Session creation is non-blocking (continues on failure)

### 3. **IoT Integration**
- Legacy JavaScript module integrated via `require()` in main TypeScript app
- Home Assistant REST API integration with encrypted token storage
- Dynamic device menus based on available entities
- Supports 9+ device categories (lights, climate, switches, sensors, etc.)

### 4. **Error Handling & Logging**
Multiple specialized loggers in `utils/logger.ts`:
- `webhookLogger` - Message processing events
- `authLogger` - Authentication events
- `mainLogger` - General application events
- All use structured logging compatible with Render.com

### 5. **Database Patterns**
```typescript
// Regular queries use standard client (RLS enforced)
const { data } = await supabase.from('table').select('*');

// System operations use admin client (bypasses RLS)
const { data } = await supabaseAdmin.from('table').select('*');
```

### 6. **Quick Reply Button Patterns**
```typescript
await facebookService.sendQuickReply(senderId, 'message', [
  { title: '✅ Confirm', payload: 'ACTION_CONFIRM' },
  { title: '❌ Cancel', payload: 'ACTION_CANCEL' },
  { title: '🏠 Main Menu', payload: 'MAIN_MENU' }
]);
```

## Common Development Tasks

### Adding a New Feature Handler
1. Create handler class in `src/handlers/`
2. Implement `handlePayload()` and `handleTextInput()` methods
3. Add payload routing in `routePayload()` function in `index.ts`
4. Add menu option in `sendMainMenu()` if needed
5. Write unit tests in `tests/unit/handlers/`

### Modifying Database Schema
1. Update SQL in `sql_scripts/` directory
2. Apply changes to Supabase project
3. Update TypeScript types if needed
4. Run tests to verify integration

### Debugging Webhook Issues
- Use `npm run dev` for detailed logging
- Check `webhookLogger` output for request processing
- Verify webhook signature in Facebook App Dashboard
- Use `/health` endpoint to verify server status

### Testing Messenger Integration
1. Start dev server: `npm run dev`
2. Use ngrok: `ngrok http 5000`
3. Update webhook URL in Facebook App Dashboard
4. Test flows via actual Messenger conversation

## Database Integration Notes

- **Supabase Real-time**: Used for announcement notifications
- **Row Level Security**: Enforced for user data access
- **Admin Operations**: Use `supabaseAdmin` client for system functions
- **Session Management**: Non-critical, continues on failure

## IoT Module Specifics

The IoT module is a JavaScript legacy system with the following integration pattern:
- Initialized with database adapter in main server startup
- Maintains user sessions for setup flows (URL input, token input)
- Supports encrypted token storage for Home Assistant authentication
- Provides device control via quick reply buttons
- Handles 9+ device categories with dynamic menu generation

## Security Considerations

- All webhooks verify Facebook signatures
- Access codes validated against database with rate limiting
- IoT tokens encrypted before database storage
- Visitor passes time-limited and trackable
- Admin client usage restricted to system operations

## Deployment Notes

- Built for Render.com deployment (see `docs/deployment/render.yaml`)
- Uses structured logging compatible with Render's log aggregation
- Health check endpoint at `/health`
- Automatic builds triggered by git push
- Environment variables managed via Render dashboard

## Testing Strategy

- **Unit Tests**: Handler logic, service methods (target: 80% coverage)
- **Integration Tests**: Complete conversation flows, webhook endpoints
- **Manual Testing**: Live API endpoints, Facebook Messenger flows
- **Coverage Tracking**: Jest with lcov reports, enforced thresholds

## Common Gotchas

1. **IoT Module**: Remember it's JavaScript, not TypeScript
2. **Build Process**: Must copy IoT features manually in build script
3. **Database Clients**: Use admin client only for system operations
4. **Session State**: Handlers maintain their own state Maps
5. **Webhook Timing**: Facebook expects 200 response within 20 seconds