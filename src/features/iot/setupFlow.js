/**
 * Setup Flow - Handles the user onboarding state machine for IoT
 */

class SetupFlow {
    constructor(iotManager) {
        this.iotManager = iotManager;
        
        // Define state flow messages
        this.messages = {
            welcome: '🏠 **IoT Device Monitoring Setup**\n\n' +
                    'I\'ll help you connect your Home Assistant to control your smart devices!\n\n' +
                    'You\'ll need:\n' +
                    '1. Your Home Assistant URL\n' +
                    '2. A Long-Lived Access Token\n\n' +
                    'Ready to get started?',
            
            urlPrompt: '📍 **Step 1: Home Assistant URL**\n\n' +
                      'Please enter your Home Assistant URL.\n\n' +
                      'Examples:\n' +
                      '• Local: `http://192.168.1.100:8123`\n' +
                      '• Nabu Casa: `https://yourname.ui.nabu.casa`\n' +
                      '• DuckDNS: `https://yourdomain.duckdns.org:8123`',
            
            tokenPrompt: '🔑 **Step 2: Access Token**\n\n' +
                        'Now I need your Long-Lived Access Token.\n\n' +
                        '**How to get it:**\n' +
                        '1. Open your Home Assistant\n' +
                        '2. Click your profile (bottom left)\n' +
                        '3. Scroll down to "Long-Lived Access Tokens"\n' +
                        '4. Click "Create Token"\n' +
                        '5. Name it (e.g., "InventiBot")\n' +
                        '6. Copy the token and paste it here\n\n' +
                        '⚠️ Keep this token secret!',
            
            connecting: '🔄 Connecting to your Home Assistant...\n' +
                       'This may take a few seconds.',
            
            success: '✅ **Successfully Connected!**\n\n',
            
            error: '❌ **Connection Failed**\n\n',
            
            alreadyConfigured: '✅ You already have Home Assistant configured!\n\n' +
                              'What would you like to do?',
            
            confirmRemove: '⚠️ **Confirm Removal**\n\n' +
                          'Are you sure you want to remove your Home Assistant configuration?\n' +
                          'You\'ll need to set it up again to use IoT features.'
        };

        // Quick reply buttons
        this.buttons = {
            start: [
                { label: '✅ Start Setup', action: 'IOT_SETUP_START' },
                { label: '❌ Cancel', action: 'IOT_SETUP_CANCEL' }
            ],
            
            alreadyConfigured: [
                { label: '📱 View Devices', action: 'IOT_SHOW_DEVICES' },
                { label: '🔄 Reconfigure', action: 'IOT_SETUP_START' },
                { label: '🗑️ Remove Setup', action: 'IOT_REMOVE_CONFIG' },
                { label: '❌ Cancel', action: 'IOT_SETUP_CANCEL' }
            ],
            
            confirmRemove: [
                { label: '✅ Yes, Remove', action: 'IOT_CONFIRM_REMOVE' },
                { label: '❌ Cancel', action: 'IOT_SETUP_CANCEL' }
            ],
            
            retry: [
                { label: '🔄 Try Again', action: 'IOT_SETUP_START' },
                { label: '❌ Cancel', action: 'IOT_SETUP_CANCEL' }
            ],
            
            successOptions: [
                { label: '📱 View Devices', action: 'IOT_SHOW_DEVICES' },
                { label: '✅ Done', action: 'IOT_SETUP_COMPLETE' }
            ]
        };
    }

    /**
     * Handle setup flow based on current state and action
     * @param {string} userId - User ID
     * @param {string} action - Action triggered
     * @param {string} userInput - User's text input (if any)
     * @returns {Promise<{message: string, quickReplies?: Array}>}
     */
    async handleSetupFlow(userId, action, userInput = null) {
        // Get or create session
        let session = this.iotManager.getSession(userId);
        
        if (!session) {
            session = this.iotManager.createSession(userId);
        }

        // Handle actions based on current state
        switch (action) {
            case 'IOT_MONITORING':
                // Initial entry point from menu
                return await this.handleInitialEntry(userId);
            
            case 'IOT_SETUP_START':
                return await this.startSetup(userId);
            
            case 'IOT_SETUP_CANCEL':
                this.iotManager.clearSession(userId);
                return {
                    message: 'Setup cancelled. You can start again anytime from the menu.',
                    quickReplies: []
                };
            
            case 'IOT_REMOVE_CONFIG':
                this.iotManager.updateSession(userId, 'CONFIRM_REMOVE');
                return {
                    message: this.messages.confirmRemove,
                    quickReplies: this.buttons.confirmRemove
                };
            
            case 'IOT_CONFIRM_REMOVE':
                return await this.removeConfiguration(userId);
            
            case 'IOT_SHOW_DEVICES':
                // This will be handled by deviceMenu
                return {
                    message: 'Loading your devices...',
                    action: 'SHOW_DEVICE_MENU'
                };
            
            case 'IOT_SETUP_COMPLETE':
                this.iotManager.clearSession(userId);
                return {
                    message: 'Great! You can access your IoT devices anytime from the menu.',
                    quickReplies: []
                };
            
            default:
                // Handle text input based on session state
                if (userInput && session) {
                    return await this.handleTextInput(userId, session, userInput);
                }
                
                return {
                    message: 'I didn\'t understand that. Please use the buttons or start over from the menu.',
                    quickReplies: []
                };
        }
    }

    /**
     * Handle initial entry to IoT setup
     * @param {string} userId - User ID
     * @returns {Promise<{message: string, quickReplies: Array}>}
     */
    async handleInitialEntry(userId) {
        // Check if user already has configuration
        const hasConfig = await this.iotManager.hasConfiguration(userId);
        
        if (hasConfig) {
            // Validate the existing connection
            const validation = await this.iotManager.validateConnection(userId);
            
            if (validation.success) {
                return {
                    message: this.messages.alreadyConfigured,
                    quickReplies: this.buttons.alreadyConfigured
                };
            } else {
                // Configuration exists but connection failed
                return {
                    message: `⚠️ Your Home Assistant seems to be offline.\n\n${validation.message}\n\nWould you like to reconfigure?`,
                    quickReplies: this.buttons.retry
                };
            }
        }
        
        // No configuration, show welcome
        return {
            message: this.messages.welcome,
            quickReplies: this.buttons.start
        };
    }

    /**
     * Start the setup process
     * @param {string} userId - User ID
     * @returns {Promise<{message: string, quickReplies: Array}>}
     */
    async startSetup(userId) {
        this.iotManager.updateSession(userId, 'URL_INPUT');
        
        return {
            message: this.messages.urlPrompt,
            quickReplies: [],
            expectingInput: true
        };
    }

    /**
     * Handle text input during setup
     * @param {string} userId - User ID
     * @param {Object} session - Current session
     * @param {string} input - User input
     * @returns {Promise<{message: string, quickReplies: Array}>}
     */
    async handleTextInput(userId, session, input) {
        switch (session.state) {
            case 'URL_INPUT':
                // Store URL and move to token input
                this.iotManager.updateSession(userId, 'TOKEN_INPUT', { url: input.trim() });
                
                return {
                    message: this.messages.tokenPrompt,
                    quickReplies: [],
                    expectingInput: true
                };
            
            case 'TOKEN_INPUT':
                // We have both URL and token, try to connect
                const context = session.context;
                const url = context.url;
                const token = input.trim();
                
                // Show connecting message
                this.iotManager.updateSession(userId, 'CONNECTING');
                
                // Attempt connection
                const result = await this.iotManager.setupUser(userId, url, token);
                
                if (result.success) {
                    this.iotManager.updateSession(userId, 'CONNECTED');
                    
                    return {
                        message: this.messages.success + result.message,
                        quickReplies: this.buttons.successOptions
                    };
                } else {
                    this.iotManager.updateSession(userId, 'ERROR');
                    
                    return {
                        message: this.messages.error + result.message,
                        quickReplies: this.buttons.retry
                    };
                }
            
            default:
                return {
                    message: 'Please use the buttons to navigate.',
                    quickReplies: []
                };
        }
    }

    /**
     * Remove user's configuration
     * @param {string} userId - User ID
     * @returns {Promise<{message: string, quickReplies: Array}>}
     */
    async removeConfiguration(userId) {
        const result = await this.iotManager.removeConfiguration(userId);
        
        return {
            message: result.message,
            quickReplies: []
        };
    }

    /**
     * Get current state for a user
     * @param {string} userId - User ID
     * @returns {Object|null} Current session
     */
    getUserState(userId) {
        return this.iotManager.getSession(userId);
    }
}

module.exports = SetupFlow;