/**
 * Device Parser - Categorizes and simplifies Home Assistant entities
 */

class DeviceParser {
    constructor() {
        // Define device categories and their domains
        this.categories = {
            lights: ['light'],
            climate: ['climate', 'fan'],
            switches: ['switch', 'input_boolean'],
            sensors: ['sensor', 'binary_sensor'],
            media: ['media_player'],
            covers: ['cover'],
            locks: ['lock'],
            cameras: ['camera'],
            vacuum: ['vacuum']
        };

        // Icons for each category
        this.categoryIcons = {
            lights: '💡',
            climate: '🌡️',
            switches: '🔌',
            sensors: '📊',
            media: '🎵',
            covers: '🪟',
            locks: '🔒',
            cameras: '📷',
            vacuum: '🤖'
        };

        // Device state mappings for user-friendly display
        this.stateDisplayMap = {
            'on': 'On',
            'off': 'Off',
            'unavailable': 'Offline',
            'unknown': 'Unknown',
            'playing': 'Playing',
            'paused': 'Paused',
            'idle': 'Idle',
            'heat': 'Heating',
            'cool': 'Cooling',
            'auto': 'Auto',
            'locked': 'Locked',
            'unlocked': 'Unlocked',
            'open': 'Open',
            'closed': 'Closed',
            'opening': 'Opening',
            'closing': 'Closing'
        };
    }

    /**
     * Categorize devices by their domain
     * @param {Array} entities - Raw entities from Home Assistant
     * @returns {Object} Categorized devices
     */
    categorizeDevices(entities) {
        const categorized = {
            lights: [],
            climate: [],
            switches: [],
            sensors: [],
            media: [],
            covers: [],
            locks: [],
            cameras: [],
            vacuum: [],
            other: []
        };

        // Group entities by base device name to consolidate related entities
        const deviceGroups = this.groupRelatedEntities(entities);
        
        // Process each group and pick the primary entity
        deviceGroups.forEach(group => {
            const primaryEntity = this.selectPrimaryEntity(group);
            if (primaryEntity) {
                const domain = primaryEntity.entity_id.split('.')[0];
                const deviceInfo = this.parseDevice(primaryEntity);
                
                // Find the right category for this domain
                let categorized_flag = false;
                for (const [category, domains] of Object.entries(this.categories)) {
                    if (domains.includes(domain)) {
                        categorized[category].push(deviceInfo);
                        categorized_flag = true;
                        break;
                    }
                }
                
                // If no category matched, put in 'other'
                if (!categorized_flag) {
                    categorized.other.push(deviceInfo);
                }
            }
        });

        // Remove empty categories
        Object.keys(categorized).forEach(key => {
            if (categorized[key].length === 0) {
                delete categorized[key];
            }
        });

        return categorized;
    }

    /**
     * Group related entities by their base device name
     * @param {Array} entities - Raw entities from Home Assistant
     * @returns {Array} Array of entity groups
     */
    groupRelatedEntities(entities) {
        const groups = new Map();
        
        entities.forEach(entity => {
            const baseName = this.extractBaseDeviceName(entity.entity_id);
            
            if (!groups.has(baseName)) {
                groups.set(baseName, []);
            }
            
            groups.get(baseName).push(entity);
        });
        
        return Array.from(groups.values());
    }

    /**
     * Extract base device name from entity ID
     * @param {string} entityId - Entity ID like 'switch.smart_plug_led'
     * @returns {string} Base name like 'smart_plug'
     */
    extractBaseDeviceName(entityId) {
        const [domain, name] = entityId.split('.');
        
        // Remove common suffixes to group related entities
        const suffixesToRemove = [
            '_led', '_indicator', '_status', '_enabled', '_config',
            '_auto_off_enabled', '_auto_update_enabled', '_restart',
            '_identify', '_update_available', '_battery', '_rssi',
            '_linkquality', '_voltage', '_current', '_power', '_energy',
            '_temperature', '_humidity', '_pressure', '_illuminance'
        ];
        
        let baseName = name;
        
        // Remove suffixes to find the base device name
        for (const suffix of suffixesToRemove) {
            if (baseName.endsWith(suffix)) {
                baseName = baseName.substring(0, baseName.length - suffix.length);
                break;
            }
        }
        
        return `${domain}.${baseName}`;
    }

    /**
     * Select the primary entity from a group of related entities
     * @param {Array} entityGroup - Group of related entities
     * @returns {Object|null} Primary entity or null
     */
    selectPrimaryEntity(entityGroup) {
        if (entityGroup.length === 0) {
            return null;
        }
        
        if (entityGroup.length === 1) {
            return entityGroup[0];
        }
        
        // Priority order for selecting primary entity
        const domainPriority = {
            'switch': 10,      // Main switches are high priority
            'light': 9,        // Lights are high priority
            'climate': 8,      // Climate controls
            'fan': 7,          // Fans
            'cover': 6,        // Covers/blinds
            'lock': 6,         // Locks
            'media_player': 5, // Media players
            'camera': 5,       // Cameras
            'vacuum': 5,       // Vacuum cleaners
            'sensor': 2,       // Sensors are lower priority
            'binary_sensor': 1 // Binary sensors are lowest priority
        };
        
        // Sort by priority and select the highest priority entity
        const sortedEntities = entityGroup.sort((a, b) => {
            const domainA = a.entity_id.split('.')[0];
            const domainB = b.entity_id.split('.')[0];
            const priorityA = domainPriority[domainA] || 0;
            const priorityB = domainPriority[domainB] || 0;
            
            if (priorityA !== priorityB) {
                return priorityB - priorityA; // Higher priority first
            }
            
            // If same domain priority, prefer simpler names (less underscores = main entity)
            const underscoreCountA = (a.entity_id.match(/_/g) || []).length;
            const underscoreCountB = (b.entity_id.match(/_/g) || []).length;
            
            return underscoreCountA - underscoreCountB; // Fewer underscores first
        });
        
        return sortedEntities[0];
    }

    /**
     * Parse a single device entity
     * @param {Object} entity - Raw entity from Home Assistant
     * @returns {Object} Parsed device info
     */
    parseDevice(entity) {
        const domain = entity.entity_id.split('.')[0];
        const attributes = entity.attributes || {};
        
        return {
            id: entity.entity_id,
            name: this.simplifyDeviceName(entity),
            state: this.getDisplayState(entity.state),
            rawState: entity.state,
            domain: domain,
            area: attributes.area || null,
            capabilities: this.getDeviceCapabilities(entity),
            attributes: this.getRelevantAttributes(entity),
            icon: this.getDeviceIcon(domain, entity),
            isAvailable: entity.state !== 'unavailable'
        };
    }

    /**
     * Simplify device name for user display
     * @param {Object} entity - Entity object
     * @returns {string} Simplified name
     */
    simplifyDeviceName(entity) {
        const attributes = entity.attributes || {};
        
        // Use friendly_name if available
        if (attributes.friendly_name) {
            return attributes.friendly_name;
        }
        
        // Otherwise, parse entity_id
        const entityName = entity.entity_id.split('.')[1];
        return entityName
            .replace(/_/g, ' ')
            .replace(/\b\w/g, l => l.toUpperCase());
    }

    /**
     * Get user-friendly display state
     * @param {string} state - Raw state value
     * @returns {string} Display state
     */
    getDisplayState(state) {
        return this.stateDisplayMap[state?.toLowerCase()] || state;
    }

    /**
     * Determine device capabilities based on domain and attributes
     * @param {Object} entity - Entity object
     * @returns {Array} List of capabilities
     */
    getDeviceCapabilities(entity) {
        const domain = entity.entity_id.split('.')[0];
        const attributes = entity.attributes || {};
        const capabilities = [];

        // Common capabilities
        if (['light', 'switch', 'fan', 'media_player', 'climate'].includes(domain)) {
            capabilities.push('turn_on', 'turn_off');
        }

        // Light-specific
        if (domain === 'light') {
            if (attributes.brightness !== undefined) {
                capabilities.push('brightness');
            }
            if (attributes.rgb_color !== undefined || attributes.hs_color !== undefined) {
                capabilities.push('color');
            }
            if (attributes.color_temp !== undefined) {
                capabilities.push('color_temperature');
            }
        }

        // Climate-specific
        if (domain === 'climate') {
            capabilities.push('set_temperature');
            if (attributes.fan_modes) {
                capabilities.push('fan_mode');
            }
            if (attributes.swing_modes) {
                capabilities.push('swing_mode');
            }
            if (attributes.preset_modes) {
                capabilities.push('preset_mode');
            }
        }

        // Media player-specific
        if (domain === 'media_player') {
            capabilities.push('play', 'pause', 'stop');
            if (attributes.volume_level !== undefined) {
                capabilities.push('volume');
            }
        }

        // Cover-specific
        if (domain === 'cover') {
            capabilities.push('open', 'close');
            if (attributes.position !== undefined) {
                capabilities.push('set_position');
            }
        }

        // Lock-specific
        if (domain === 'lock') {
            capabilities.push('lock', 'unlock');
        }

        return capabilities;
    }

    /**
     * Get relevant attributes for display
     * @param {Object} entity - Entity object
     * @returns {Object} Relevant attributes
     */
    getRelevantAttributes(entity) {
        const domain = entity.entity_id.split('.')[0];
        const attributes = entity.attributes || {};
        const relevant = {};

        // Climate attributes
        if (domain === 'climate') {
            if (attributes.current_temperature !== undefined) {
                relevant.currentTemp = attributes.current_temperature;
            }
            if (attributes.temperature !== undefined) {
                relevant.targetTemp = attributes.temperature;
            }
            if (attributes.hvac_modes) {
                relevant.modes = attributes.hvac_modes;
            }
        }

        // Light attributes
        if (domain === 'light') {
            if (attributes.brightness !== undefined) {
                relevant.brightness = Math.round((attributes.brightness / 255) * 100);
            }
            if (attributes.color_temp !== undefined) {
                relevant.colorTemp = attributes.color_temp;
            }
        }

        // Sensor attributes
        if (domain === 'sensor' || domain === 'binary_sensor') {
            if (attributes.unit_of_measurement) {
                relevant.unit = attributes.unit_of_measurement;
            }
            if (attributes.device_class) {
                relevant.type = attributes.device_class;
            }
        }

        // Media player attributes
        if (domain === 'media_player') {
            if (attributes.volume_level !== undefined) {
                relevant.volume = Math.round(attributes.volume_level * 100);
            }
            if (attributes.media_title) {
                relevant.nowPlaying = attributes.media_title;
            }
        }

        // Cover attributes
        if (domain === 'cover') {
            if (attributes.position !== undefined) {
                relevant.position = attributes.position;
            }
        }

        return relevant;
    }

    /**
     * Get appropriate icon for device
     * @param {string} domain - Device domain
     * @param {Object} entity - Entity object
     * @returns {string} Icon emoji
     */
    getDeviceIcon(domain, entity) {
        const attributes = entity.attributes || {};
        
        // Check for device class specific icons
        if (attributes.device_class) {
            const deviceClassIcons = {
                temperature: '🌡️',
                humidity: '💧',
                door: '🚪',
                window: '🪟',
                motion: '🚶',
                garage_door: '🚗',
                smoke: '🔥',
                battery: '🔋',
                power: '⚡'
            };
            
            if (deviceClassIcons[attributes.device_class]) {
                return deviceClassIcons[attributes.device_class];
            }
        }

        // Default domain icons
        const domainIcons = {
            light: '💡',
            switch: '🔌',
            climate: '❄️',
            fan: '💨',
            sensor: '📊',
            binary_sensor: '🔔',
            media_player: '🎵',
            cover: '🪟',
            lock: '🔒',
            camera: '📷',
            vacuum: '🤖',
            scene: '🎬',
            script: '📜',
            input_boolean: '🎚️',
            input_number: '🔢',
            input_select: '📝'
        };

        return domainIcons[domain] || '📱';
    }

    /**
     * Get summary statistics for devices
     * @param {Object} categorizedDevices - Categorized devices
     * @returns {Object} Summary stats
     */
    getDeviceSummary(categorizedDevices) {
        const summary = {
            total: 0,
            byCategory: {},
            online: 0,
            offline: 0
        };

        for (const [category, devices] of Object.entries(categorizedDevices)) {
            summary.byCategory[category] = devices.length;
            summary.total += devices.length;
            
            devices.forEach(device => {
                if (device.isAvailable) {
                    summary.online++;
                } else {
                    summary.offline++;
                }
            });
        }

        return summary;
    }

    /**
     * Format device list for display
     * @param {Array} devices - List of devices
     * @returns {string} Formatted text
     */
    formatDeviceList(devices) {
        if (devices.length === 0) {
            return 'No devices found';
        }

        return devices.map(device => {
            const status = device.isAvailable ? device.state : '(Offline)';
            const extras = [];
            
            if (device.attributes.brightness !== undefined) {
                extras.push(`${device.attributes.brightness}%`);
            }
            if (device.attributes.currentTemp !== undefined) {
                extras.push(`${device.attributes.currentTemp}°`);
            }
            
            const extraStr = extras.length > 0 ? ` - ${extras.join(', ')}` : '';
            return `${device.icon} ${device.name}: ${status}${extraStr}`;
        }).join('\n');
    }
}

// Singleton instance
const deviceParser = new DeviceParser();

module.exports = {
    categorizeDevices: (entities) => deviceParser.categorizeDevices(entities),
    parseDevice: (entity) => deviceParser.parseDevice(entity),
    simplifyDeviceName: (entity) => deviceParser.simplifyDeviceName(entity),
    getDeviceCapabilities: (entity) => deviceParser.getDeviceCapabilities(entity),
    getDeviceSummary: (categorizedDevices) => deviceParser.getDeviceSummary(categorizedDevices),
    formatDeviceList: (devices) => deviceParser.formatDeviceList(devices),
    categoryIcons: deviceParser.categoryIcons
};