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

            // Filter out system entities and diagnostic sensors that users typically don't need to control
            const filteredEntities = response.data.filter(entity => {
                const domain = entity.entity_id.split('.')[0];
                const entityId = entity.entity_id.toLowerCase();
                const entityName = entityId.split('.')[1];
                const attributes = entity.attributes || {};
                
                // Exclude system domains
                const excludedDomains = [
                    'automation', 'zone', 'sun', 'weather', 'person', 'device_tracker',
                    'script', 'scene', 'input_text', 'input_datetime', 'timer',
                    'counter', 'group', 'persistent_notification', 'update'
                ];
                
                if (excludedDomains.includes(domain)) {
                    return false;
                }
                
                // Filter out diagnostic and configuration entities
                const diagnosticPatterns = [
                    '_enabled$',           // auto-off enabled, auto-update enabled, etc.
                    '_config$',            // configuration entities
                    '_diagnostic$',        // diagnostic entities  
                    '_status$',            // status entities
                    '_last_',              // last updated, last seen, etc.
                    '_battery$',           // battery level sensors (unless it's the main entity)
                    '_rssi$',              // signal strength
                    '_linkquality$',       // link quality
                    '_voltage$',           // voltage sensors
                    '_current$',           // current sensors
                    '_power$',             // power sensors (unless main power switch)
                    '_energy$',            // energy sensors
                    '_temperature$',       // temperature sensors (unless it's a thermostat)
                    '_humidity$',          // humidity sensors (unless main sensor)
                    '_pressure$',          // pressure sensors
                    '_illuminance$',       // light sensors
                    '_update_available$',  // update available sensors
                    '_restart$',           // restart switches
                    '_identify$',          // identify switches
                    'wifi_',               // WiFi related sensors
                    'uptime',              // uptime sensors
                    'heap_',               // memory sensors
                    'flash_',              // flash memory sensors
                ];
                
                // Check if entity matches diagnostic patterns
                const isDiagnostic = diagnosticPatterns.some(pattern => {
                    const regex = new RegExp(pattern);
                    return regex.test(entityName);
                });
                
                if (isDiagnostic) {
                    return false;
                }
                
                // Filter out entities marked as diagnostic in attributes
                if (attributes.entity_category === 'diagnostic' || 
                    attributes.entity_category === 'config') {
                    return false;
                }
                
                // For sensors, only keep main sensors, not auxiliary ones
                if (domain === 'sensor' || domain === 'binary_sensor') {
                    // Keep climate-related sensors if they're the main device
                    if (entityName.includes('temperature') || entityName.includes('humidity')) {
                        // Only keep if it seems like a main sensor, not a diagnostic one
                        if (!entityName.includes('_') || entityName.endsWith('_temperature') || entityName.endsWith('_humidity')) {
                            return true;
                        }
                        return false;
                    }
                    
                    // Keep motion, door, window sensors as they're primary devices
                    const primarySensorTypes = ['motion', 'door', 'window', 'occupancy', 'contact', 'smoke', 'leak'];
                    if (primarySensorTypes.some(type => entityName.includes(type))) {
                        return true;
                    }
                    
                    // For other sensors, be more selective
                    // Keep sensors that don't seem like diagnostic ones
                    if (!entityName.includes('_') || 
                        entityName.match(/^[^_]+_(sensor|detector|monitor)$/)) {
                        return true;
                    }
                    
                    return false;
                }
                
                // Keep all controllable devices (lights, switches, etc.)
                const controllableDomains = ['light', 'switch', 'climate', 'fan', 'media_player', 'cover', 'lock', 'camera', 'vacuum'];
                if (controllableDomains.includes(domain)) {
                    // But filter out LED controls and similar auxiliary switches
                    if (domain === 'switch' && (entityName.includes('_led') || entityName.includes('_indicator'))) {
                        return false;
                    }
                    return true;
                }
                
                return true;
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