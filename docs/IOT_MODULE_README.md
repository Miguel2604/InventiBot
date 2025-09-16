# IoT Device Monitoring Module

## Overview
The IoT Device Monitoring module integrates Home Assistant with InventiBot, allowing users to control their smart home devices through the Facebook Messenger chatbot interface using quick reply buttons - no typing commands required!

## Features
- 🔌 Home Assistant integration
- 🎯 Real-time device control
- 🔘 Quick reply button interface
- 🔐 Secure token encryption (AES-256-GCM)
- 📱 Support for multiple device types
- 🚀 No device data caching - always shows real-time states

## Supported Device Types
- 💡 Lights (on/off, brightness control)
- ❄️ Climate/AC (temperature control, on/off)
- 🔌 Switches (on/off)
- 📊 Sensors (monitoring)
- 🎵 Media Players (play/pause, volume)
- 🪟 Covers/Blinds (open/close, position)
- 🔒 Locks (lock/unlock)
- 📷 Cameras (view status)
- 🤖 Vacuum Cleaners (control)

## Setup Instructions

### 1. Database Migration
Run the database migration to create the necessary table:
```sql
-- Run in your Supabase SQL editor
CREATE TABLE IF NOT EXISTS user_ha_config (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) UNIQUE NOT NULL,
    ha_url VARCHAR(255) NOT NULL,
    encrypted_token TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_connected TIMESTAMP
);

CREATE INDEX idx_user_ha_config_user_id ON user_ha_config(user_id);
CREATE INDEX idx_user_ha_config_is_active ON user_ha_config(is_active);
```

### 2. Environment Variables
Add these to your `.env` file:
```env
# Generate a secure key: openssl rand -base64 32
ENCRYPTION_KEY=your_base64_encoded_32_byte_key_here
# Home Assistant API timeout in milliseconds
HA_TIMEOUT=10000
```

### 3. Install Dependencies
The required dependencies (axios) are already in package.json, just run:
```bash
npm install
```

### 4. Start the Bot
```bash
npm run dev
```

## User Experience

### For Non-Technical Users
1. **Click Menu Button**: Users click the hamburger menu in Messenger
2. **Select IoT Devices**: Click "🏠 IoT Devices" button
3. **Simple Setup**:
   - Bot prompts for Home Assistant URL (e.g., `http://192.168.1.100:8123`)
   - Bot prompts for access token
   - Connection is established automatically
4. **Control Devices**: Use quick reply buttons to:
   - View device categories
   - Select specific devices
   - Control devices with simple button taps

### Setup Flow
```
User: [Clicks 🏠 IoT Devices]
Bot: Welcome! Let's connect your Home Assistant.
     [Start Setup] [Cancel]

User: [Clicks Start Setup]
Bot: Please enter your Home Assistant URL
     Example: http://192.168.1.100:8123

User: http://192.168.1.100:8123
Bot: Now enter your Long-Lived Access Token
     (Instructions provided)

User: [Enters token]
Bot: ✅ Connected! Found 12 devices:
     💡 lights: 5
     🌡️ climate: 2
     🔌 switches: 5
     [View Devices] [Done]
```

### Device Control Flow
```
User: [Clicks View Devices]
Bot: Select a category:
     [💡 Lights] [🌡️ Climate] [🔌 Switches]

User: [Clicks 💡 Lights]
Bot: 1. Living Room Light: On
     2. Bedroom Light: Off
     [1. Living Room] [2. Bedroom] [Back]

User: [Clicks 1. Living Room]
Bot: Living Room Light - Status: On
     [Turn Off] [🔆 25%] [🔆 50%] [🔆 100%] [Back]
```

## Architecture

### File Structure
```
src/features/iot/
├── index.js           # Main module entry point
├── iotManager.js      # Business logic controller
├── haClient.js        # Home Assistant API client
├── setupFlow.js       # User onboarding state machine
├── deviceMenu.js      # Quick reply menu generation
├── commandHandler.js  # Action processing
├── deviceParser.js    # Device categorization
└── encryption.js      # Security utilities
```

### Data Flow
1. **No Device Caching**: Every request fetches fresh data from Home Assistant
2. **Encrypted Storage**: Only credentials are stored (encrypted)
3. **Real-time Updates**: Device states are always current
4. **Session Management**: Temporary sessions for setup flow only

## Security Features
- 🔐 **Token Encryption**: AES-256-GCM encryption for access tokens
- 🛡️ **Input Validation**: URL and token sanitization
- ⚡ **Rate Limiting**: 30 commands per minute per user
- ⏱️ **Session Timeout**: 30 minutes of inactivity
- 🔒 **User Isolation**: Each user's data is completely separated

## Testing
Run the basic test:
```bash
node tests/iot-test.js
```

## Troubleshooting

### Connection Issues
- Verify Home Assistant is accessible from the bot server
- Check URL format (include http:// or https:// and port)
- Ensure access token is valid and not expired

### Device Not Showing
- Some system entities are filtered out (automation, zone, sun, weather)
- Check device is exposed to Home Assistant API
- Refresh devices using the refresh button

### Commands Not Working
- Check rate limit (30 commands/minute)
- Verify Home Assistant is online
- Check device is responding in Home Assistant UI

## Future Enhancements
- 📊 Energy monitoring dashboard
- ⏰ Scheduling and automation rules
- 🌡️ Sensor data graphs
- 🏠 Multi-home support
- 🔔 Device state change notifications
- 🎭 Scene activation
- ⭐ Favorite devices for quick access

## Support
For issues or questions about the IoT module, check:
- Home Assistant connection logs
- Bot console logs for error messages
- Database for stored configurations
- Test with the iot-test.js script

## License
This module is part of InventiBot and follows the same license terms.