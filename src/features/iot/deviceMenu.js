/**
 * Device Menu - Generates quick reply buttons for device control
 */

const deviceParser = require('./deviceParser');

class DeviceMenu {
    constructor(iotManager) {
        this.iotManager = iotManager;
        
        // Maximum number of devices to show per page
        this.devicesPerPage = 8;
        
        // Maximum number of quick reply buttons
        this.maxButtons = 10;
    }

    /**
     * Generate main device menu
     * @param {string} userId - User ID
     * @returns {Promise<{message: string, quickReplies: Array}>}
     */
    async generateMainMenu(userId) {
        const devicesResult = await this.iotManager.getUserDevices(userId);
        
        if (!devicesResult.success) {
            return {
                message: devicesResult.message,
                quickReplies: [
                    { label: '🔄 Retry', action: 'IOT_MONITORING' },
                    { label: '❌ Close', action: 'IOT_CLOSE' }
                ]
            };
        }

        const devices = devicesResult.data;
        const summary = deviceParser.getDeviceSummary(devices);
        
        // Build message
        let message = '📱 **Your Smart Home Devices**\n\n';
        message += `Total: ${summary.total} devices (${summary.online} online, ${summary.offline} offline)\n\n`;
        message += 'Select a category to view devices:';

        // Build category buttons
        const buttons = [];
        
        for (const [category, deviceList] of Object.entries(devices)) {
            if (deviceList.length > 0) {
                const icon = deviceParser.categoryIcons[category] || '📱';
                const label = `${icon} ${category.charAt(0).toUpperCase() + category.slice(1)} (${deviceList.length})`;
                buttons.push({
                    label: label,
                    action: `IOT_CATEGORY:${category}`
                });
            }
        }

        // Add utility buttons
        buttons.push(
            { label: '🔄 Refresh', action: 'IOT_REFRESH' },
            { label: '⚙️ Settings', action: 'IOT_SETTINGS' },
            { label: '❌ Close', action: 'IOT_CLOSE' }
        );

        // Limit to max buttons
        if (buttons.length > this.maxButtons) {
            buttons.splice(this.maxButtons - 1);
            buttons.push({ label: '➡️ More', action: 'IOT_MORE_CATEGORIES' });
        }

        return {
            message,
            quickReplies: buttons
        };
    }

    /**
     * Generate category device list
     * @param {string} userId - User ID
     * @param {string} category - Device category
     * @param {number} page - Page number (for pagination)
     * @returns {Promise<{message: string, quickReplies: Array}>}
     */
    async generateCategoryMenu(userId, category, page = 0) {
        const devicesResult = await this.iotManager.getUserDevices(userId);
        
        if (!devicesResult.success) {
            return {
                message: 'Failed to load devices',
                quickReplies: [{ label: '← Back', action: 'IOT_MAIN_MENU' }]
            };
        }

        const categoryDevices = devicesResult.data[category] || [];
        
        if (categoryDevices.length === 0) {
            return {
                message: `No ${category} devices found`,
                quickReplies: [{ label: '← Back', action: 'IOT_MAIN_MENU' }]
            };
        }

        // Paginate devices
        const startIdx = page * this.devicesPerPage;
        const endIdx = startIdx + this.devicesPerPage;
        const pageDevices = categoryDevices.slice(startIdx, endIdx);
        const totalPages = Math.ceil(categoryDevices.length / this.devicesPerPage);

        // Build message
        const icon = deviceParser.categoryIcons[category] || '📱';
        let message = `${icon} **${category.charAt(0).toUpperCase() + category.slice(1)} Devices**\n\n`;
        
        // List devices with their status
        pageDevices.forEach((device, idx) => {
            const num = startIdx + idx + 1;
            const status = device.isAvailable ? device.state : '(Offline)';
            let deviceLine = `${num}. ${device.icon} **${device.name}**: ${status}`;
            
            // Add extra info if available
            if (device.attributes.brightness !== undefined) {
                deviceLine += ` (${device.attributes.brightness}%)`;
            }
            if (device.attributes.currentTemp !== undefined) {
                deviceLine += ` (${device.attributes.currentTemp}°)`;
            }
            
            message += deviceLine + '\n';
        });

        if (totalPages > 1) {
            message += `\nPage ${page + 1} of ${totalPages}`;
        }

        // Build control buttons
        const buttons = [];
        
        // Add device control buttons (limited to available space)
        const maxDeviceButtons = this.maxButtons - 3; // Reserve space for navigation
        pageDevices.slice(0, maxDeviceButtons).forEach((device, idx) => {
            const num = startIdx + idx + 1;
            buttons.push({
                label: `${num}. ${device.icon} ${device.name}`,
                action: `IOT_DEVICE:${device.id}`
            });
        });

        // Add navigation buttons
        if (page > 0) {
            buttons.push({ label: '⬅️ Previous', action: `IOT_CATEGORY:${category}:${page - 1}` });
        }
        if (endIdx < categoryDevices.length) {
            buttons.push({ label: '➡️ Next', action: `IOT_CATEGORY:${category}:${page + 1}` });
        }
        buttons.push({ label: '← Back', action: 'IOT_MAIN_MENU' });

        return {
            message,
            quickReplies: buttons
        };
    }

    /**
     * Generate device control menu
     * @param {string} userId - User ID
     * @param {string} deviceId - Device entity ID
     * @returns {Promise<{message: string, quickReplies: Array}>}
     */
    async generateDeviceControlMenu(userId, deviceId) {
        try {
            const device = await this.iotManager.getDeviceState(userId, deviceId);
            
            if (!device) {
                return {
                    message: 'Device not found',
                    quickReplies: [{ label: '← Back', action: 'IOT_MAIN_MENU' }]
                };
            }

            // Build message
            let message = `${device.icon} **${device.name}**\n\n`;
            message += `Status: ${device.isAvailable ? device.state : 'Offline'}\n`;
            
            // Add device-specific information
            if (device.attributes.brightness !== undefined) {
                message += `Brightness: ${device.attributes.brightness}%\n`;
            }
            if (device.attributes.currentTemp !== undefined) {
                message += `Current Temperature: ${device.attributes.currentTemp}°\n`;
            }
            if (device.attributes.targetTemp !== undefined) {
                message += `Target Temperature: ${device.attributes.targetTemp}°\n`;
            }
            if (device.attributes.volume !== undefined) {
                message += `Volume: ${device.attributes.volume}%\n`;
            }
            if (device.attributes.position !== undefined) {
                message += `Position: ${device.attributes.position}%\n`;
            }

            // Generate control buttons based on capabilities
            const buttons = this.generateDeviceButtons(device);
            
            // Add back button
            buttons.push({ label: '🔄 Refresh', action: `IOT_DEVICE:${deviceId}` });
            buttons.push({ label: '← Back', action: `IOT_CATEGORY:${this.getDeviceCategory(device.domain)}` });

            return {
                message,
                quickReplies: buttons
            };
        } catch (error) {
            console.error('Error generating device control menu:', error);
            return {
                message: 'Failed to load device',
                quickReplies: [{ label: '← Back', action: 'IOT_MAIN_MENU' }]
            };
        }
    }

    /**
     * Generate control buttons for a specific device
     * @param {Object} device - Device object
     * @returns {Array} Quick reply buttons
     */
    generateDeviceButtons(device) {
        const buttons = [];
        const capabilities = device.capabilities || [];
        
        // On/Off controls
        if (capabilities.includes('turn_on') && capabilities.includes('turn_off')) {
            if (device.rawState === 'off') {
                buttons.push({ 
                    label: '🔵 Turn On', 
                    action: `IOT_CONTROL:${device.id}:turn_on` 
                });
            } else if (device.rawState === 'on') {
                buttons.push({ 
                    label: '⚫ Turn Off', 
                    action: `IOT_CONTROL:${device.id}:turn_off` 
                });
            } else {
                // Show both if state is unknown
                buttons.push(
                    { label: '🔵 Turn On', action: `IOT_CONTROL:${device.id}:turn_on` },
                    { label: '⚫ Turn Off', action: `IOT_CONTROL:${device.id}:turn_off` }
                );
            }
        }

        // Brightness control for lights
        if (capabilities.includes('brightness')) {
            buttons.push(
                { label: '🔆 25%', action: `IOT_CONTROL:${device.id}:brightness:25` },
                { label: '🔆 50%', action: `IOT_CONTROL:${device.id}:brightness:50` },
                { label: '🔆 75%', action: `IOT_CONTROL:${device.id}:brightness:75` },
                { label: '🔆 100%', action: `IOT_CONTROL:${device.id}:brightness:100` }
            );
        }

        // Temperature control for climate
        if (capabilities.includes('set_temperature')) {
            buttons.push(
                { label: '❄️ 18°', action: `IOT_CONTROL:${device.id}:temperature:18` },
                { label: '🌡️ 22°', action: `IOT_CONTROL:${device.id}:temperature:22` },
                { label: '🔥 26°', action: `IOT_CONTROL:${device.id}:temperature:26` }
            );
        }

        // Lock controls
        if (capabilities.includes('lock') && capabilities.includes('unlock')) {
            if (device.rawState === 'locked') {
                buttons.push({ 
                    label: '🔓 Unlock', 
                    action: `IOT_CONTROL:${device.id}:unlock` 
                });
            } else {
                buttons.push({ 
                    label: '🔒 Lock', 
                    action: `IOT_CONTROL:${device.id}:lock` 
                });
            }
        }

        // Cover controls
        if (capabilities.includes('open') && capabilities.includes('close')) {
            buttons.push(
                { label: '⬆️ Open', action: `IOT_CONTROL:${device.id}:open` },
                { label: '⬇️ Close', action: `IOT_CONTROL:${device.id}:close` }
            );
            
            if (capabilities.includes('set_position')) {
                buttons.push({ label: '↕️ 50%', action: `IOT_CONTROL:${device.id}:position:50` });
            }
        }

        // Media player controls
        if (device.domain === 'media_player') {
            if (capabilities.includes('play')) {
                buttons.push({ label: '▶️ Play', action: `IOT_CONTROL:${device.id}:play` });
            }
            if (capabilities.includes('pause')) {
                buttons.push({ label: '⏸️ Pause', action: `IOT_CONTROL:${device.id}:pause` });
            }
            if (capabilities.includes('volume')) {
                buttons.push(
                    { label: '🔇 Mute', action: `IOT_CONTROL:${device.id}:volume:0` },
                    { label: '🔊 50%', action: `IOT_CONTROL:${device.id}:volume:50` }
                );
            }
        }

        // Limit buttons to prevent overflow
        return buttons.slice(0, this.maxButtons - 2); // Reserve 2 for navigation
    }

    /**
     * Generate settings menu
     * @param {string} userId - User ID
     * @returns {Promise<{message: string, quickReplies: Array}>}
     */
    async generateSettingsMenu(userId) {
        const config = await this.iotManager.getUserConfig(userId);
        
        if (!config) {
            return {
                message: 'No configuration found',
                quickReplies: [{ label: '← Back', action: 'IOT_MAIN_MENU' }]
            };
        }

        let message = '⚙️ **IoT Settings**\n\n';
        message += `**Home Assistant URL:** ${config.ha_url}\n`;
        message += `**Last Connected:** ${config.last_connected ? new Date(config.last_connected).toLocaleString() : 'Never'}\n\n`;
        message += 'What would you like to do?';

        const buttons = [
            { label: '🔄 Test Connection', action: 'IOT_TEST_CONNECTION' },
            { label: '📝 Reconfigure', action: 'IOT_SETUP_START' },
            { label: '🗑️ Remove Setup', action: 'IOT_REMOVE_CONFIG' },
            { label: '← Back', action: 'IOT_MAIN_MENU' }
        ];

        return {
            message,
            quickReplies: buttons
        };
    }

    /**
     * Get device category from domain
     * @param {string} domain - Device domain
     * @returns {string} Category name
     */
    getDeviceCategory(domain) {
        for (const [category, domains] of Object.entries({
            lights: ['light'],
            climate: ['climate', 'fan'],
            switches: ['switch', 'input_boolean'],
            sensors: ['sensor', 'binary_sensor'],
            media: ['media_player'],
            covers: ['cover'],
            locks: ['lock'],
            cameras: ['camera'],
            vacuum: ['vacuum']
        })) {
            if (domains.includes(domain)) {
                return category;
            }
        }
        return 'other';
    }
}

module.exports = DeviceMenu;