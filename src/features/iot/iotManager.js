const haClient = require('./haClient');
const deviceParser = require('./deviceParser');
const encryption = require('./encryption');

// In-memory session storage (replace with Redis in production)
const iotSessions = new Map();

// Rate limiting
const rateLimitMap = new Map();

class IoTManager {
    constructor(db) {
        this.db = db;
        this.maxCommandsPerMinute = 30;
        
        // Clear old sessions every 30 minutes
        setInterval(() => this.cleanupSessions(), 30 * 60 * 1000);
    }

    /**
     * Setup user's Home Assistant configuration
     * @param {string} userId - User ID
     * @param {string} url - Home Assistant URL
     * @param {string} token - Access token
     * @returns {Promise<{success: boolean, message: string, devices?: Object}>}
     */
    async setupUser(userId, url, token) {
        try {
            // Validate and sanitize inputs
            const sanitizedUrl = encryption.sanitizeInput(url).replace(/\/$/, ''); // Remove trailing slash
            const sanitizedToken = encryption.sanitizeInput(token);

            // Validate URL format
            if (!encryption.validateHAUrl(sanitizedUrl)) {
                return {
                    success: false,
                    message: '❌ Invalid Home Assistant URL format. Please use format: http://192.168.1.100:8123'
                };
            }

            // Test connection
            const connectionResult = await haClient.connectHA(sanitizedUrl, sanitizedToken);
            if (!connectionResult.success) {
                return {
                    success: false,
                    message: `❌ ${connectionResult.message}`
                };
            }

            // Encrypt token for storage
            const encryptedToken = encryption.encryptToken(sanitizedToken, userId);

            // Save or update configuration in database
            const query = `
                INSERT INTO user_ha_config (user_id, ha_url, encrypted_token, last_connected)
                VALUES ($1, $2, $3, NOW())
                ON CONFLICT (user_id)
                DO UPDATE SET 
                    ha_url = $2,
                    encrypted_token = $3,
                    last_connected = NOW(),
                    is_active = true
            `;

            await this.db.query(query, [userId, sanitizedUrl, encryptedToken]);

            // Fetch devices to show summary
            const devices = await haClient.getDevices(sanitizedUrl, sanitizedToken);
            const categorized = deviceParser.categorizeDevices(devices);
            const summary = deviceParser.getDeviceSummary(categorized);

            // Create session for this user
            this.createSession(userId);

            return {
                success: true,
                message: `✅ Connected to Home Assistant (${connectionResult.version})\n\n` +
                        `Found ${summary.total} devices:\n` +
                        Object.entries(summary.byCategory)
                            .map(([cat, count]) => `${deviceParser.categoryIcons[cat] || '📱'} ${cat}: ${count}`)
                            .join('\n'),
                devices: categorized
            };
        } catch (error) {
            console.error('Setup error:', error);
            return {
                success: false,
                message: '❌ Failed to setup Home Assistant connection. Please try again.'
            };
        }
    }

    /**
     * Get user's Home Assistant configuration
     * @param {string} userId - User ID
     * @returns {Promise<Object|null>} User configuration
     */
    async getUserConfig(userId) {
        try {
            const query = 'SELECT * FROM user_ha_config WHERE user_id = $1 AND is_active = true';
            const result = await this.db.query(query, [userId]);
            
            if (result.rows.length === 0) {
                return null;
            }

            const config = result.rows[0];
            
            // Decrypt token
            const decryptedToken = encryption.decryptToken(config.encrypted_token, userId);
            
            return {
                ...config,
                token: decryptedToken
            };
        } catch (error) {
            console.error('Error getting user config:', error);
            return null;
        }
    }

    /**
     * Get user's devices from Home Assistant
     * @param {string} userId - User ID
     * @returns {Promise<{success: boolean, data?: Object, message?: string}>}
     */
    async getUserDevices(userId) {
        try {
            const config = await this.getUserConfig(userId);
            
            if (!config) {
                return {
                    success: false,
                    message: 'No Home Assistant configuration found. Please set up first.'
                };
            }

            const devices = await haClient.getDevices(config.ha_url, config.token);
            const categorized = deviceParser.categorizeDevices(devices);

            return {
                success: true,
                data: categorized
            };
        } catch (error) {
            console.error('Error fetching devices:', error);
            return {
                success: false,
                message: 'Failed to fetch devices. Please check your Home Assistant connection.'
            };
        }
    }

    /**
     * Execute a command on a device
     * @param {string} userId - User ID
     * @param {string} deviceId - Device entity ID
     * @param {string} command - Command to execute
     * @param {Object} params - Additional parameters
     * @returns {Promise<{success: boolean, message: string}>}
     */
    async executeCommand(userId, deviceId, command, params = {}) {
        try {
            // Rate limiting
            if (!this.checkRateLimit(userId)) {
                return {
                    success: false,
                    message: '⚠️ Rate limit exceeded. Please wait a moment before trying again.'
                };
            }

            const config = await this.getUserConfig(userId);
            
            if (!config) {
                return {
                    success: false,
                    message: 'No Home Assistant configuration found.'
                };
            }

            // Execute the command
            const result = await haClient.controlDevice(
                config.ha_url,
                config.token,
                deviceId,
                command,
                params
            );

            // Update last_connected timestamp
            await this.db.query(
                'UPDATE user_ha_config SET last_connected = NOW() WHERE user_id = $1',
                [userId]
            );

            return result;
        } catch (error) {
            console.error('Command execution error:', error);
            return {
                success: false,
                message: 'Failed to execute command. Please try again.'
            };
        }
    }

    /**
     * Validate Home Assistant connection
     * @param {string} userId - User ID
     * @returns {Promise<{success: boolean, message: string}>}
     */
    async validateConnection(userId) {
        try {
            const config = await this.getUserConfig(userId);
            
            if (!config) {
                return {
                    success: false,
                    message: 'No configuration found'
                };
            }

            const result = await haClient.connectHA(config.ha_url, config.token);
            
            if (result.success) {
                // Update last_connected
                await this.db.query(
                    'UPDATE user_ha_config SET last_connected = NOW() WHERE user_id = $1',
                    [userId]
                );
            }

            return result;
        } catch (error) {
            console.error('Validation error:', error);
            return {
                success: false,
                message: 'Failed to validate connection'
            };
        }
    }

    /**
     * Remove user's Home Assistant configuration
     * @param {string} userId - User ID
     * @returns {Promise<{success: boolean, message: string}>}
     */
    async removeConfiguration(userId) {
        try {
            await this.db.query(
                'UPDATE user_ha_config SET is_active = false WHERE user_id = $1',
                [userId]
            );

            // Clear session
            iotSessions.delete(userId);

            return {
                success: true,
                message: '✅ Home Assistant configuration removed successfully.'
            };
        } catch (error) {
            console.error('Error removing configuration:', error);
            return {
                success: false,
                message: 'Failed to remove configuration.'
            };
        }
    }

    /**
     * Get specific device state
     * @param {string} userId - User ID
     * @param {string} deviceId - Device entity ID
     * @returns {Promise<Object>} Device state
     */
    async getDeviceState(userId, deviceId) {
        try {
            const config = await this.getUserConfig(userId);
            
            if (!config) {
                throw new Error('No configuration found');
            }

            const state = await haClient.getDeviceState(config.ha_url, config.token, deviceId);
            return deviceParser.parseDevice(state);
        } catch (error) {
            console.error('Error getting device state:', error);
            throw error;
        }
    }

    /**
     * Check if user has an active configuration
     * @param {string} userId - User ID
     * @returns {Promise<boolean>}
     */
    async hasConfiguration(userId) {
        const config = await this.getUserConfig(userId);
        return config !== null;
    }

    /**
     * Create or get IoT session for user
     * @param {string} userId - User ID
     * @returns {Object} Session object
     */
    createSession(userId) {
        const session = {
            userId,
            state: 'INIT',
            context: {},
            lastActivity: Date.now()
        };
        
        iotSessions.set(userId, session);
        return session;
    }

    /**
     * Get user's IoT session
     * @param {string} userId - User ID
     * @returns {Object|null} Session object
     */
    getSession(userId) {
        return iotSessions.get(userId) || null;
    }

    /**
     * Update session state
     * @param {string} userId - User ID
     * @param {string} newState - New state
     * @param {Object} context - Additional context
     */
    updateSession(userId, newState, context = {}) {
        let session = iotSessions.get(userId);
        
        if (!session) {
            session = this.createSession(userId);
        }

        session.state = newState;
        session.context = { ...session.context, ...context };
        session.lastActivity = Date.now();
        
        iotSessions.set(userId, session);
        return session;
    }

    /**
     * Clear user's IoT session
     * @param {string} userId - User ID
     */
    clearSession(userId) {
        iotSessions.delete(userId);
    }

    /**
     * Cleanup old sessions
     */
    cleanupSessions() {
        const thirtyMinutesAgo = Date.now() - (30 * 60 * 1000);
        
        for (const [userId, session] of iotSessions.entries()) {
            if (session.lastActivity < thirtyMinutesAgo) {
                iotSessions.delete(userId);
            }
        }
    }

    /**
     * Check rate limit for user
     * @param {string} userId - User ID
     * @returns {boolean} True if within rate limit
     */
    checkRateLimit(userId) {
        const now = Date.now();
        const userLimits = rateLimitMap.get(userId) || [];
        
        // Remove timestamps older than 1 minute
        const recentCommands = userLimits.filter(timestamp => 
            now - timestamp < 60000
        );
        
        if (recentCommands.length >= this.maxCommandsPerMinute) {
            return false;
        }
        
        recentCommands.push(now);
        rateLimitMap.set(userId, recentCommands);
        
        return true;
    }
}

module.exports = IoTManager;