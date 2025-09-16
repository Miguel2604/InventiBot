/**
 * IoT Module - Main entry point for IoT Device Monitoring
 */

const IoTManager = require('./iotManager');
const SetupFlow = require('./setupFlow');
const DeviceMenu = require('./deviceMenu');
const CommandHandler = require('./commandHandler');

let iotInstance = null;

/**
 * Initialize IoT module with database connection
 * @param {Object} db - Database connection
 * @returns {Object} IoT module instance
 */
function initializeIoT(db) {
    if (!iotInstance) {
        // Create instances with dependencies
        const iotManager = new IoTManager(db);
        const setupFlow = new SetupFlow(iotManager);
        const deviceMenu = new DeviceMenu(iotManager);
        const commandHandler = new CommandHandler(iotManager, setupFlow, deviceMenu);

        iotInstance = {
            manager: iotManager,
            setupFlow: setupFlow,
            deviceMenu: deviceMenu,
            commandHandler: commandHandler,
            
            /**
             * Main entry point for handling IoT actions
             * @param {string} userId - User ID
             * @param {string} action - Action string
             * @param {string} userInput - Optional user text input
             * @returns {Promise<{message: string, quickReplies?: Array}>}
             */
            handleAction: async (userId, action, userInput = null) => {
                return await commandHandler.handleAction(userId, action, userInput);
            },

            /**
             * Check if an action is IoT-related
             * @param {string} action - Action string
             * @returns {boolean} True if IoT action
             */
            isIoTAction: (action) => {
                return CommandHandler.isIoTAction(action);
            },

            /**
             * Handle text input during IoT setup
             * @param {string} userId - User ID
             * @param {string} text - User's text input
             * @returns {Promise<{message: string, quickReplies?: Array}>}
             */
            handleTextInput: async (userId, text) => {
                const session = iotManager.getSession(userId);
                
                if (session && (session.state === 'URL_INPUT' || session.state === 'TOKEN_INPUT')) {
                    return await setupFlow.handleTextInput(userId, session, text);
                }
                
                return {
                    message: 'Please use the menu buttons to navigate IoT controls.',
                    quickReplies: [
                        { label: '🏠 IoT Menu', action: 'IOT_MONITORING' }
                    ]
                };
            },

            /**
             * Get user's session state
             * @param {string} userId - User ID
             * @returns {Object|null} Session object
             */
            getUserSession: (userId) => {
                return iotManager.getSession(userId);
            },

            /**
             * Clear user's session
             * @param {string} userId - User ID
             */
            clearUserSession: (userId) => {
                iotManager.clearSession(userId);
            },

            /**
             * Check if user has IoT configured
             * @param {string} userId - User ID
             * @returns {Promise<boolean>} True if configured
             */
            hasConfiguration: async (userId) => {
                return await iotManager.hasConfiguration(userId);
            }
        };
    }

    return iotInstance;
}

/**
 * Get IoT menu button for hamburger menu
 * @returns {Object} Menu button configuration
 */
function getMenuButton() {
    return {
        id: 'iot_monitoring',
        label: '🏠 IoT Device Monitoring',
        action: 'IOT_MONITORING',
        description: 'Control your smart home devices'
    };
}

/**
 * Get IoT module information
 * @returns {Object} Module info
 */
function getModuleInfo() {
    return {
        name: 'IoT Device Monitoring',
        version: '1.0.0',
        description: 'Home Assistant integration for smart device control',
        features: [
            'Home Assistant integration',
            'Real-time device control',
            'Quick reply button interface',
            'Secure token encryption',
            'Multi-category device support'
        ],
        supportedDevices: [
            'Lights',
            'Climate/AC',
            'Switches',
            'Sensors',
            'Media Players',
            'Covers/Blinds',
            'Locks',
            'Cameras',
            'Vacuum Cleaners'
        ]
    };
}

module.exports = {
    initialize: initializeIoT,
    getMenuButton,
    getModuleInfo,
    
    // Export individual components for testing
    IoTManager,
    SetupFlow,
    DeviceMenu,
    CommandHandler
};