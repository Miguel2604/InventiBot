/**
 * Database adapter for IoT module
 * Wraps Supabase client to provide a query interface compatible with IoTManager
 */

class IoTDatabaseAdapter {
    constructor(supabaseClient) {
        this.supabase = supabaseClient;
    }

    /**
     * Execute a database query
     * Converts SQL queries to Supabase API calls
     * @param {string} text - SQL query text
     * @param {Array} params - Query parameters
     * @returns {Promise<{rows: Array}>} Query result
     */
    async query(text, params = []) {
        try {
            // Handle INSERT with ON CONFLICT
            if (text.includes('INSERT INTO user_ha_config')) {
                const [userId, haUrl, encryptedToken] = params;
                
                const { data, error } = await this.supabase
                    .from('user_ha_config')
                    .upsert({
                        user_id: userId,
                        ha_url: haUrl,
                        encrypted_token: encryptedToken,
                        last_connected: new Date().toISOString(),
                        is_active: true
                    }, {
                        onConflict: 'user_id'
                    });

                if (error) throw error;
                return { rows: data || [] };
            }

            // Handle SELECT queries
            if (text.includes('SELECT * FROM user_ha_config')) {
                const [userId] = params;
                
                const { data, error } = await this.supabase
                    .from('user_ha_config')
                    .select('*')
                    .eq('user_id', userId)
                    .eq('is_active', true);

                if (error) throw error;
                return { rows: data || [] };
            }

            // Handle UPDATE for last_connected
            if (text.includes('UPDATE user_ha_config SET last_connected')) {
                const [userId] = params;
                
                const { data, error } = await this.supabase
                    .from('user_ha_config')
                    .update({
                        last_connected: new Date().toISOString()
                    })
                    .eq('user_id', userId);

                if (error) throw error;
                return { rows: data || [] };
            }

            // Handle UPDATE for is_active (remove configuration)
            if (text.includes('UPDATE user_ha_config SET is_active')) {
                const [userId] = params;
                
                const { data, error } = await this.supabase
                    .from('user_ha_config')
                    .update({
                        is_active: false
                    })
                    .eq('user_id', userId);

                if (error) throw error;
                return { rows: data || [] };
            }

            // Default fallback - log unhandled query
            console.warn('Unhandled IoT database query:', text);
            return { rows: [] };

        } catch (error) {
            console.error('IoT Database query error:', error);
            throw error;
        }
    }
}

module.exports = IoTDatabaseAdapter;