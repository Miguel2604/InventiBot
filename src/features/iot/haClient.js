const axios = require('axios');

class HomeAssistantClient {
    constructor() {
        this.timeout = parseInt(process.env.HA_TIMEOUT || '10000');
    }

    /**
     * Test connection to Home Assistant
     * @param {string} url - Home Assistant URL
     * @param {string} token - Access token
     * @returns {Promise<{success: boolean, message: string, version?: string}>}
     */
    async connectHA(url, token) {
        try {
            const response = await axios.get(
                `${url}/api/`,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: this.timeout
                }
            );

            return {
                success: true,
                message: 'Connected successfully',
                version: response.data.message || 'Unknown version'
            };
        } catch (error) {
            console.error('HA Connection error:', error.message);
            
            if (error.code === 'ECONNREFUSED') {
                return {
                    success: false,
                    message: 'Cannot connect to Home Assistant. Please check the URL.'
                };
            }
            
            if (error.response?.status === 401) {
                return {
                    success: false,
                    message: 'Invalid access token. Please check your token.'
                };
            }

            if (error.code === 'ETIMEDOUT') {
                return {
                    success: false,
                    message: 'Connection timed out. Please check your network.'
                };
            }

            return {
                success: false,
                message: error.message || 'Connection failed'
            };
        }
    }

    /**
     * Fetch all devices/entities from Home Assistant
     * @param {string} url - Home Assistant URL
     * @param {string} token - Access token
     * @returns {Promise<Array>} Array of entities
     */
    async getDevices(url, token) {
        try {
            const response = await axios.get(
                `${url}/api/states`,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: this.timeout
                }
            );

            // Filter out some system entities that users typically don't need to control
            const filteredEntities = response.data.filter(entity => {
                const domain = entity.entity_id.split('.')[0];
                const excludedDomains = ['automation', 'zone', 'sun', 'weather', 'person', 'device_tracker'];
                return !excludedDomains.includes(domain);
            });

            return filteredEntities;
        } catch (error) {
            console.error('Failed to fetch devices:', error.message);
            throw new Error('Failed to fetch devices from Home Assistant');
        }
    }

    /**
     * Get current state of a specific device
     * @param {string} url - Home Assistant URL
     * @param {string} token - Access token
     * @param {string} deviceId - Entity ID
     * @returns {Promise<Object>} Device state
     */
    async getDeviceState(url, token, deviceId) {
        try {
            const response = await axios.get(
                `${url}/api/states/${deviceId}`,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: this.timeout
                }
            );

            return response.data;
        } catch (error) {
            console.error(`Failed to get state for ${deviceId}:`, error.message);
            
            if (error.response?.status === 404) {
                throw new Error(`Device ${deviceId} not found`);
            }
            
            throw new Error(`Failed to get device state`);
        }
    }

    /**
     * Control a device through Home Assistant services
     * @param {string} url - Home Assistant URL
     * @param {string} token - Access token
     * @param {string} deviceId - Entity ID
     * @param {string} action - Action to perform (turn_on, turn_off, etc.)
     * @param {Object} params - Additional parameters for the action
     * @returns {Promise<{success: boolean, message: string}>}
     */
    async controlDevice(url, token, deviceId, action, params = {}) {
        try {
            const domain = deviceId.split('.')[0];
            
            const serviceData = {
                entity_id: deviceId,
                ...params
            };

            const response = await axios.post(
                `${url}/api/services/${domain}/${action}`,
                serviceData,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: this.timeout
                }
            );

            // Get the new state to confirm the action
            const newState = await this.getDeviceState(url, token, deviceId);

            return {
                success: true,
                message: `Successfully executed ${action} on ${deviceId}`,
                newState: newState.state
            };
        } catch (error) {
            console.error(`Failed to control device ${deviceId}:`, error.message);
            
            return {
                success: false,
                message: error.message || `Failed to control device`
            };
        }
    }

    /**
     * Call a Home Assistant service
     * @param {string} url - Home Assistant URL
     * @param {string} token - Access token  
     * @param {string} domain - Service domain
     * @param {string} service - Service name
     * @param {Object} serviceData - Service data
     * @returns {Promise<Object>} Service response
     */
    async callService(url, token, domain, service, serviceData = {}) {
        try {
            const response = await axios.post(
                `${url}/api/services/${domain}/${service}`,
                serviceData,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: this.timeout
                }
            );

            return {
                success: true,
                data: response.data
            };
        } catch (error) {
            console.error(`Service call failed (${domain}/${service}):`, error.message);
            
            return {
                success: false,
                message: error.message
            };
        }
    }

    /**
     * Get available services from Home Assistant
     * @param {string} url - Home Assistant URL
     * @param {string} token - Access token
     * @returns {Promise<Object>} Available services
     */
    async getServices(url, token) {
        try {
            const response = await axios.get(
                `${url}/api/services`,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: this.timeout
                }
            );

            return response.data;
        } catch (error) {
            console.error('Failed to fetch services:', error.message);
            throw new Error('Failed to fetch available services');
        }
    }
}

// Singleton instance
const haClient = new HomeAssistantClient();

module.exports = {
    connectHA: (url, token) => haClient.connectHA(url, token),
    getDevices: (url, token) => haClient.getDevices(url, token),
    getDeviceState: (url, token, deviceId) => haClient.getDeviceState(url, token, deviceId),
    controlDevice: (url, token, deviceId, action, params) => 
        haClient.controlDevice(url, token, deviceId, action, params),
    callService: (url, token, domain, service, serviceData) => 
        haClient.callService(url, token, domain, service, serviceData),
    getServices: (url, token) => haClient.getServices(url, token)
};