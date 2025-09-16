# IoT Device Monitoring - Home Assistant Integration

## Overview
Simple IoT device monitoring through Home Assistant integration, accessible via quick reply button in the hamburger menu. Uses Home Assistant as the single source of truth - no device data caching needed!

## User Flow
1. User clicks hamburger menu → "IoT Device Monitoring"
2. Bot prompts for Home Assistant URL
3. Bot prompts for access token
4. Bot connects and shows available devices
5. User controls devices through quick reply buttons

---

## Implementation Steps

### 1. Database Schema
Create table for storing user Home Assistant credentials only:

```sql
CREATE TABLE user_ha_config (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) UNIQUE NOT NULL,
    ha_url VARCHAR(255) NOT NULL,
    encrypted_token TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    last_connected TIMESTAMP
);
```

**Note:** No device caching needed - Home Assistant is the single source of truth!

### 2. Environment Variables
Add to `.env`:
```
ENCRYPTION_KEY=<generate-strong-key>
HA_TIMEOUT=10
```

### 3. Core Files to Create

#### `src/features/iot/haClient.js`
Handles Home Assistant API communication:
- `connectHA(url, token)` - Test connection
- `getDevices(url, token)` - Fetch all devices directly from HA
- `controlDevice(url, token, deviceId, action, params)` - Send commands
- `getDeviceState(url, token, deviceId)` - Get current device state

#### `src/features/iot/iotManager.js`
Main logic controller:
- `setupUser(userId, url, token)` - Initial setup and validation
- `getUserDevices(userId)` - Fetch devices from HA in real-time
- `executeCommand(userId, deviceId, command)` - Process commands
- `validateConnection(userId)` - Check if HA is still accessible

#### `src/features/iot/deviceParser.js`
Parse and categorize devices:
- `categorizeDevices(haEntities)` - Group by type
- `simplifyDeviceName(entity)` - Create user-friendly names
- `getDeviceCapabilities(entity)` - Determine what actions are available

#### `src/features/iot/encryption.js`
Security utilities:
- `encryptToken(token)` - Encrypt HA tokens
- `decryptToken(encryptedToken)` - Decrypt for use
- Use AES-256-GCM encryption

### 4. Quick Reply Integration

#### Update hamburger menu (`src/components/menu.js`):
Add new button to menu options:
```javascript
{
  id: 'iot_monitoring',
  label: '🏠 IoT Device Monitoring',
  action: 'START_IOT_SETUP'
}
```

#### Create setup flow (`src/features/iot/setupFlow.js`):

**State Machine:**
1. `INIT` → Show welcome message with explanation
2. `URL_INPUT` → Prompt for Home Assistant URL
3. `TOKEN_INPUT` → Prompt for access token
4. `CONNECTING` → Validate and connect
5. `CONNECTED` → Show device menu
6. `ERROR` → Show error with retry option

**Messages:**
```javascript
const messages = {
  welcome: "🏠 Let's connect your Home Assistant!\n\nI'll need two things:\n1. Your Home Assistant URL\n2. An access token\n\nReady to start?",
  
  urlPrompt: "Please enter your Home Assistant URL\n(Example: http://192.168.1.100:8123)",
  
  tokenPrompt: "Now I need your access token.\n\nTo get it:\n1. Open Home Assistant\n2. Click your profile (bottom left)\n3. Find 'Long-Lived Access Tokens'\n4. Create a new token\n5. Copy and paste it here",
  
  connecting: "🔄 Connecting to your Home Assistant...",
  
  success: "✅ Connected successfully!",
  
  error: "❌ Connection failed. Please check your URL and token."
}
```

### 5. Device Control Interface

#### Quick Reply Device Menu (`src/features/iot/deviceMenu.js`):

After successful connection, show device categories as buttons:
```javascript
const mainMenu = [
  { label: "💡 Lights", action: "SHOW_LIGHTS" },
  { label: "🌡️ Climate", action: "SHOW_CLIMATE" },
  { label: "🔌 Switches", action: "SHOW_SWITCHES" },
  { label: "📊 Sensors", action: "SHOW_SENSORS" },
  { label: "🔄 Refresh", action: "REFRESH_DEVICES" },
  { label: "⚙️ Settings", action: "IOT_SETTINGS" }
]
```

#### Device Control Buttons:
For each device, generate appropriate quick replies:

**Lights:**
```javascript
[
  { label: "💡 Turn On", action: `LIGHT_ON:${deviceId}` },
  { label: "💡 Turn Off", action: `LIGHT_OFF:${deviceId}` },
  { label: "🔆 Brightness", action: `LIGHT_DIM:${deviceId}` },
  { label: "← Back", action: "SHOW_LIGHTS" }
]
```

**Climate:**
```javascript
[
  { label: "❄️ Turn On", action: `AC_ON:${deviceId}` },
  { label: "⏹️ Turn Off", action: `AC_OFF:${deviceId}` },
  { label: "🌡️ Set Temp", action: `AC_TEMP:${deviceId}` },
  { label: "← Back", action: "SHOW_CLIMATE" }
]
```

### 6. Command Handler

#### `src/features/iot/commandHandler.js`:
```javascript
async function handleIoTAction(userId, action, params) {
  const [command, deviceId] = action.split(':');
  
  switch(command) {
    case 'LIGHT_ON':
      return await controlLight(userId, deviceId, 'turn_on');
    case 'LIGHT_OFF':
      return await controlLight(userId, deviceId, 'turn_off');
    case 'AC_ON':
      return await controlClimate(userId, deviceId, 'turn_on');
    case 'AC_TEMP':
      return await promptTemperature(userId, deviceId);
    // ... more commands
  }
}
```

### 7. State Management

Store user's current IoT session state:
```javascript
const iotSessions = new Map();

class IoTSession {
  constructor(userId) {
    this.userId = userId;
    this.state = 'INIT';
    this.context = {};
    this.lastActivity = Date.now();
  }
  
  setState(newState, context = {}) {
    this.state = newState;
    this.context = { ...this.context, ...context };
    this.lastActivity = Date.now();
  }
}
```

### 8. Error Handling

Common errors and user-friendly messages:
```javascript
const errorMessages = {
  CONNECTION_REFUSED: "Can't connect. Is your Home Assistant accessible?",
  INVALID_TOKEN: "Invalid token. Please create a new one.",
  DEVICE_OFFLINE: "This device appears to be offline.",
  TIMEOUT: "Connection timed out. Please try again.",
  UNKNOWN: "Something went wrong. Please try again."
}
```

### 9. Real-time Data Fetching

Always fetch fresh data from Home Assistant:
```javascript
class HADataFetcher {
  async getDevices(userId) {
    const config = await getUserConfig(userId);
    if (!config) throw new Error('Not configured');
    
    const { ha_url, encrypted_token } = config;
    const token = decrypt(encrypted_token);
    
    // Always get fresh data from HA
    const response = await fetch(`${ha_url}/api/states`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!response.ok) throw new Error('Failed to fetch devices');
    
    const devices = await response.json();
    return categorizeDevices(devices);
  }
  
  async getDeviceState(userId, deviceId) {
    const config = await getUserConfig(userId);
    const { ha_url, encrypted_token } = config;
    const token = decrypt(encrypted_token);
    
    // Get current state directly from HA
    const response = await fetch(`${ha_url}/api/states/${deviceId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    return await response.json();
  }
}
```

**Benefits:**
- Always shows accurate, real-time device states
- No stale data issues
- No cache invalidation complexity
- Home Assistant handles all the heavy lifting

### 10. Security Considerations

1. **Token Encryption**: Use AES-256-GCM
2. **URL Validation**: Only accept http/https with valid format
3. **Rate Limiting**: Max 30 commands per minute per user
4. **Session Timeout**: Clear session after 30 minutes of inactivity
5. **Input Sanitization**: Validate all user inputs
6. **HTTPS Only**: For production, enforce HTTPS for HA connections

---

## Testing Checklist

### Setup Flow
- [ ] Quick reply button appears in menu
- [ ] Welcome message displays correctly
- [ ] URL input validation works
- [ ] Token input is masked/hidden
- [ ] Connection test works
- [ ] Error messages are clear
- [ ] Retry option works after failure

### Device Control
- [ ] Devices are categorized correctly
- [ ] Device names are user-friendly
- [ ] All control buttons work
- [ ] State updates reflect immediately
- [ ] Back navigation works
- [ ] Refresh updates device list

### Edge Cases
- [ ] Handle HA offline
- [ ] Handle invalid token
- [ ] Handle no devices found
- [ ] Handle device offline
- [ ] Handle network timeout
- [ ] Handle concurrent commands

### Security
- [ ] Tokens are encrypted in database
- [ ] No tokens in logs
- [ ] Rate limiting works
- [ ] Session timeout works
- [ ] Invalid URLs rejected

---

## Deployment Steps

1. Add encryption key to environment
2. Run database migration
3. Deploy new code
4. Test with local Home Assistant
5. Test with external Home Assistant (Nabu Casa)
6. Monitor error logs
7. Create user documentation

---

## Future Enhancements

1. **Device Groups**: Control multiple devices at once
2. **Scenes**: Activate HA scenes
3. **Automations**: Create simple if-then rules
4. **Scheduling**: Set timers for devices
5. **Energy Monitoring**: Show consumption data
6. **Voice Commands**: Add voice control support
7. **Notifications**: Alert on device state changes
8. **Multi-Home**: Support multiple HA instances
9. **Favorites**: Quick access to most-used devices
10. **Widget Mode**: Compact view for frequently used controls

---

## Code Structure

```
src/
├── features/
│   └── iot/
│       ├── index.js           # Main export
│       ├── haClient.js        # HA API client
│       ├── iotManager.js      # Business logic
│       ├── setupFlow.js       # Setup wizard
│       ├── deviceMenu.js      # Quick reply menus
│       ├── commandHandler.js  # Command processing
│       ├── deviceParser.js    # Device categorization
│       └── encryption.js      # Security utilities
├── components/
│   └── menu.js               # Update with IoT button
└── database/
    └── migrations/
        └── add_ha_config.sql # Database schema
```

---

## Example User Journey

1. **User clicks**: 🏠 IoT Device Monitoring
2. **Bot shows**: Welcome message with [Start Setup] button
3. **User clicks**: Start Setup
4. **Bot asks**: "Please enter your Home Assistant URL"
5. **User enters**: `http://192.168.1.100:8123`
6. **Bot asks**: "Now enter your access token"
7. **User enters**: `eyJ0eXAiOiJKV1...` 
8. **Bot shows**: "✅ Connected! Found 12 devices"
9. **Bot shows buttons**: [💡 Lights] [🌡️ Climate] [🔌 Switches]
10. **User clicks**: 💡 Lights
11. **Bot shows**: List of lights with [On] [Off] buttons
12. **User clicks**: [On] for Living Room
13. **Bot confirms**: "✅ Living Room Light turned on"

Simple, intuitive, no commands to remember!