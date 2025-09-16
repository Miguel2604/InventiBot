/**
 * Command Handler - Processes user actions and executes device commands
 */

class CommandHandler {
    constructor(iotManager, setupFlow, deviceMenu) {
        this.iotManager = iotManager;
        this.setupFlow = setupFlow;
        this.deviceMenu = deviceMenu;
    }

    /**
     * Main handler for all IoT-related actions
     * @param {string} userId - User ID
     * @param {string} action - Action string (e.g., "IOT_CONTROL:light.living_room:turn_on")
     * @param {string} userInput - Optional user text input
     * @returns {Promise<{message: string, quickReplies?: Array}>}
     */
    async handleAction(userId, action, userInput = null) {
        try {
            // Parse action string
            const actionParts = action.split(':');
            const actionType = actionParts[0];

            // Route to appropriate handler
            switch (actionType) {
                // Setup flow actions
                case 'IOT_MONITORING':
                case 'IOT_SETUP_START':
                case 'IOT_SETUP_CANCEL':
                case 'IOT_REMOVE_CONFIG':
                case 'IOT_CONFIRM_REMOVE':
                case 'IOT_SETUP_COMPLETE':
                    return await this.setupFlow.handleSetupFlow(userId, action, userInput);

                // Main menu actions
                case 'IOT_MAIN_MENU':
                case 'IOT_REFRESH':
                    return await this.deviceMenu.generateMainMenu(userId);

                // Settings actions
                case 'IOT_SETTINGS':
                    return await this.deviceMenu.generateSettingsMenu(userId);

                case 'IOT_TEST_CONNECTION':
                    return await this.handleTestConnection(userId);

                // Category navigation
                case 'IOT_CATEGORY':
                    return await this.handleCategoryNavigation(userId, actionParts);

                // Device control menu
                case 'IOT_DEVICE':
                    return await this.handleDeviceMenu(userId, actionParts);

                // Device control commands
                case 'IOT_CONTROL':
                    return await this.handleDeviceControl(userId, actionParts);

                // Show devices after setup
                case 'IOT_SHOW_DEVICES':
                    return await this.deviceMenu.generateMainMenu(userId);

                // Close IoT interface
                case 'IOT_CLOSE':
                    this.iotManager.clearSession(userId);
                    return {
                        message: 'IoT Device Monitoring closed. You can access it again from the menu.',
                        quickReplies: []
                    };

                default:
                    // Check if user is in setup flow and has text input
                    const session = this.iotManager.getSession(userId);
                    if (session && userInput) {
                        return await this.setupFlow.handleTextInput(userId, session, userInput);
                    }
                    
                    return {
                        message: 'Unknown action. Please try again.',
                        quickReplies: [{ label: '🏠 Main Menu', action: 'IOT_MAIN_MENU' }]
                    };
            }
        } catch (error) {
            console.error('Command handler error:', error);
            return {
                message: '❌ An error occurred. Please try again.',
                quickReplies: [
                    { label: '🔄 Retry', action: 'IOT_MAIN_MENU' },
                    { label: '❌ Close', action: 'IOT_CLOSE' }
                ]
            };
        }
    }

    /**
     * Handle category navigation
     * @param {string} userId - User ID
     * @param {Array} actionParts - Parsed action parts
     * @returns {Promise<{message: string, quickReplies: Array}>}
     */
    async handleCategoryNavigation(userId, actionParts) {
        const category = actionParts[1];
        const page = actionParts[2] ? parseInt(actionParts[2]) : 0;
        
        return await this.deviceMenu.generateCategoryMenu(userId, category, page);
    }

    /**
     * Handle device control menu
     * @param {string} userId - User ID
     * @param {Array} actionParts - Parsed action parts
     * @returns {Promise<{message: string, quickReplies: Array}>}
     */
    async handleDeviceMenu(userId, actionParts) {
        const deviceId = actionParts.slice(1).join(':'); // Rejoin in case entity_id has colons
        return await this.deviceMenu.generateDeviceControlMenu(userId, deviceId);
    }

    /**
     * Handle device control commands
     * @param {string} userId - User ID
     * @param {Array} actionParts - Parsed action parts
     * @returns {Promise<{message: string, quickReplies: Array}>}
     */
    async handleDeviceControl(userId, actionParts) {
        // Parse control command: IOT_CONTROL:device_id:command[:param]
        const deviceId = actionParts[1];
        const command = actionParts[2];
        const param = actionParts[3];

        // Build command parameters
        const params = {};
        
        switch (command) {
            case 'brightness':
                // Convert percentage to 0-255 scale
                const brightness = parseInt(param);
                params.brightness = Math.round((brightness / 100) * 255);
                break;
                
            case 'temperature':
                params.temperature = parseInt(param);
                break;
                
            case 'position':
                params.position = parseInt(param);
                break;
                
            case 'volume':
                const volume = parseInt(param);
                params.volume_level = volume / 100;
                break;
                
            case 'play':
            case 'pause':
            case 'stop':
                // Media player commands don't need params
                break;
                
            default:
                // For simple commands like turn_on, turn_off, lock, unlock
                break;
        }

        // Execute the command
        let actualCommand = command;
        
        // Map special commands to HA service names
        const commandMap = {
            'brightness': 'turn_on',  // Brightness is set via turn_on with brightness param
            'temperature': 'set_temperature',
            'position': 'set_position',
            'volume': 'volume_set',
            'play': 'media_play',
            'pause': 'media_pause',
            'stop': 'media_stop'
        };
        
        if (commandMap[command]) {
            actualCommand = commandMap[command];
        }

        const result = await this.iotManager.executeCommand(userId, deviceId, actualCommand, params);

        if (result.success) {
            // Get updated device state
            try {
                const device = await this.iotManager.getDeviceState(userId, deviceId);
                
                let message = `✅ ${result.message}\n\n`;
                message += `**Current Status:** ${device.state}`;
                
                if (params.brightness !== undefined) {
                    message += ` (Brightness: ${param}%)`;
                }
                if (params.temperature !== undefined) {
                    message += ` (Temperature: ${param}°)`;
                }
                if (params.position !== undefined) {
                    message += ` (Position: ${param}%)`;
                }
                
                return {
                    message,
                    quickReplies: [
                        { label: '🔄 Refresh', action: `IOT_DEVICE:${deviceId}` },
                        { label: '← Back to Device', action: `IOT_DEVICE:${deviceId}` },
                        { label: '🏠 Main Menu', action: 'IOT_MAIN_MENU' }
                    ]
                };
            } catch (error) {
                // If we can't get device state, just show success message
                return {
                    message: `✅ ${result.message}`,
                    quickReplies: [
                        { label: '← Back to Device', action: `IOT_DEVICE:${deviceId}` },
                        { label: '🏠 Main Menu', action: 'IOT_MAIN_MENU' }
                    ]
                };
            }
        } else {
            return {
                message: `❌ ${result.message}`,
                quickReplies: [
                    { label: '🔄 Retry', action: `IOT_DEVICE:${deviceId}` },
                    { label: '🏠 Main Menu', action: 'IOT_MAIN_MENU' }
                ]
            };
        }
    }

    /**
     * Handle connection test
     * @param {string} userId - User ID
     * @returns {Promise<{message: string, quickReplies: Array}>}
     */
    async handleTestConnection(userId) {
        const result = await this.iotManager.validateConnection(userId);
        
        let message;
        if (result.success) {
            message = `✅ Connection successful!\n\n${result.message}`;
        } else {
            message = `❌ Connection failed.\n\n${result.message}`;
        }

        return {
            message,
            quickReplies: [
                { label: '← Back', action: 'IOT_SETTINGS' },
                { label: '🏠 Main Menu', action: 'IOT_MAIN_MENU' }
            ]
        };
    }

    /**
     * Check if action is IoT-related
     * @param {string} action - Action string
     * @returns {boolean} True if IoT action
     */
    static isIoTAction(action) {
        if (!action || typeof action !== 'string') return false;
        return action.startsWith('IOT_') || action === 'iot_monitoring';
    }

    /**
     * Get initial IoT response for new users
     * @returns {Object} Initial response
     */
    static getInitialResponse() {
        return {
            message: 'Welcome to IoT Device Monitoring! Click the button below to get started.',
            quickReplies: [
                { label: '🏠 Start IoT Setup', action: 'IOT_MONITORING' }
            ]
        };
    }
}

module.exports = CommandHandler;