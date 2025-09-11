# InventiBot - Property Management Chatbot

An interactive Facebook Messenger chatbot for property management with quick reply buttons, designed to help residents with common inquiries and requests.

## Features Implemented

### ✅ FAQ System with Quick Replies
The FAQ feature provides a button-driven interface for accessing building information:

- **Hours of Operation** (Pool, Gym, Office)
- **Policies** (Pets, Noise, Parking)
- **Waste & Recycling** (Trash, Recycling, Bulk Items)
- **Access & Keys** (Lost Key/Fob, Guest Access, Emergency Access)

## Setup Instructions

### 1. Prerequisites
- Node.js 16+ and npm
- Facebook Page and App
- Supabase project (already configured)

### 2. Environment Configuration
The `.env` file is already configured with:
- Facebook tokens (verify token, access token, app secret)
- Supabase credentials
- Server configuration

### 3. Installation
```bash
# Install dependencies
npm install
```

### 4. Facebook Messenger Configuration

#### Set up the Facebook profile (greeting, menu, etc.):
```bash
npm run setup
```

#### Configure Webhook URL:
1. Go to your Facebook App Dashboard
2. Navigate to Messenger > Settings
3. Add webhook callback URL: `https://YOUR_DOMAIN/webhook`
4. Verify token: `inventisolve_verify_token` (from .env)
5. Subscribe to: `messages`, `messaging_postbacks`

### 5. Running the Bot

#### Development mode (with auto-reload):
```bash
npm run dev
```

#### Production mode:
```bash
npm run build
npm start
```

## Testing the FAQ Feature

### Local Testing with ngrok
To test locally with Facebook Messenger:

1. Install ngrok: `npm install -g ngrok`
2. Start the server: `npm run dev`
3. In another terminal: `ngrok http 5000`
4. Copy the HTTPS URL from ngrok
5. Update webhook URL in Facebook App Dashboard to `https://YOUR_NGROK_URL/webhook`

### Testing Steps

1. **Send a message to your Facebook Page**
   - The bot will respond with the main menu quick replies

2. **Click "ℹ️ Building Info"**
   - Shows FAQ categories: Hours, Policies, Waste & Recycling, Access & Keys

3. **Select any category (e.g., "🕒 Hours of Operation")**
   - Shows subcategories: Pool, Gym, Office

4. **Select a subcategory (e.g., "🏊 Pool")**
   - Displays the answer with follow-up options

### Quick Reply Navigation
- **↩️ Back**: Returns to previous menu
- **❓ Another Question**: Goes to FAQ main menu  
- **💬 Talk to Manager**: Triggers handoff (placeholder for now)
- **🏠 Main Menu**: Returns to main bot menu

## Project Structure
```
InventiBot/
├── src/
│   ├── config/
│   │   ├── env.ts          # Environment configuration
│   │   └── supabase.ts     # Supabase client & types
│   ├── handlers/
│   │   └── faq.handler.ts  # FAQ logic with quick replies
│   ├── services/
│   │   └── facebook.service.ts  # Facebook Messenger API
│   ├── types/
│   │   └── facebook.ts     # Facebook type definitions
│   ├── index.ts            # Main server & webhook endpoints
│   └── setup.ts            # Profile setup script
├── .env                    # Environment variables (configured)
├── package.json            # Dependencies
├── tsconfig.json           # TypeScript configuration
└── README.md              # This file
```

## Next Features to Implement

Based on the chatbot context, the following features can be added:

1. **Maintenance Request Automation** - Form-like flow for reporting issues
2. **Amenity Booking System** - Calendar integration for booking facilities
3. **Visitor Management** - Guest registration and notifications
4. **Security Alerts** - Incident reporting and broadcast messages

## Testing

### Automated Testing

The project includes comprehensive test coverage using Jest:

```bash
# Run all tests
npm test

# Run with coverage report
npm run test:coverage

# Run unit tests only
npm run test:unit

# Run integration tests only
npm run test:integration

# Watch mode for development
npm run test:watch
```

### Manual API Testing

Test the live API endpoints:

```bash
# Start the server
npm run dev

# In another terminal, run API tests
npm run test:api
```

### Test Coverage

- **Unit Tests**: FAQ handler, service methods
- **Integration Tests**: Complete conversation flows, webhook endpoints
- **Current Coverage**: ~87% statement coverage

## API Endpoints

- `GET /webhook` - Facebook webhook verification
- `POST /webhook` - Receives and processes messages
- `GET /health` - Health check endpoint

## Troubleshooting

### Bot not responding:
1. Check server logs: `npm run dev`
2. Verify webhook is subscribed in Facebook App
3. Check access token is valid
4. Ensure page is connected to the app

### Quick replies not showing:
1. Facebook Messenger may cache - try clearing app cache
2. Ensure payload strings match exactly
3. Check Facebook API version compatibility

## Security Notes

- Webhook signature verification is implemented
- Environment variables are used for sensitive data
- HTTPS is required for production deployment

## Support

For issues or questions about the implementation, please refer to:
- [Facebook Messenger Platform Documentation](https://developers.facebook.com/docs/messenger-platform)
- [Supabase Documentation](https://supabase.com/docs)
