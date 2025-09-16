const crypto = require('crypto');

class EncryptionService {
    constructor() {
        // Get encryption key from environment or generate one
        this.algorithm = 'aes-256-gcm';
        this.saltLength = 32;
        this.ivLength = 16;
        this.tagLength = 16;
        this.pbkdf2Iterations = 100000;
        
        // Master key from environment
        if (!process.env.ENCRYPTION_KEY) {
            console.warn('⚠️  No ENCRYPTION_KEY found in environment. Generating one for development.');
            console.warn('⚠️  Please add ENCRYPTION_KEY to your .env file for production!');
            process.env.ENCRYPTION_KEY = crypto.randomBytes(32).toString('base64');
            console.log(`Generated key: ${process.env.ENCRYPTION_KEY}`);
        }
        this.masterKey = Buffer.from(process.env.ENCRYPTION_KEY, 'base64');
    }

    /**
     * Encrypt a token for secure storage
     * @param {string} token - The token to encrypt
     * @param {string} userId - User ID for additional entropy
     * @returns {string} Encrypted token as base64 string
     */
    encryptToken(token, userId) {
        try {
            // Generate a random salt for this encryption
            const salt = crypto.randomBytes(this.saltLength);
            
            // Derive a key using PBKDF2 with user ID as additional entropy
            const key = crypto.pbkdf2Sync(
                this.masterKey,
                Buffer.concat([salt, Buffer.from(userId)]),
                this.pbkdf2Iterations,
                32,
                'sha256'
            );

            // Generate a random IV
            const iv = crypto.randomBytes(this.ivLength);

            // Create cipher
            const cipher = crypto.createCipheriv(this.algorithm, key, iv);
            
            // Encrypt the token
            const encrypted = Buffer.concat([
                cipher.update(token, 'utf8'),
                cipher.final()
            ]);

            // Get the auth tag
            const authTag = cipher.getAuthTag();

            // Combine salt, iv, authTag, and encrypted data
            const combined = Buffer.concat([salt, iv, authTag, encrypted]);

            // Return as base64
            return combined.toString('base64');
        } catch (error) {
            console.error('Encryption error:', error);
            throw new Error('Failed to encrypt token');
        }
    }

    /**
     * Decrypt a token
     * @param {string} encryptedToken - The encrypted token as base64
     * @param {string} userId - User ID used during encryption
     * @returns {string} Decrypted token
     */
    decryptToken(encryptedToken, userId) {
        try {
            // Decode from base64
            const combined = Buffer.from(encryptedToken, 'base64');

            // Extract components
            const salt = combined.slice(0, this.saltLength);
            const iv = combined.slice(this.saltLength, this.saltLength + this.ivLength);
            const authTag = combined.slice(
                this.saltLength + this.ivLength, 
                this.saltLength + this.ivLength + this.tagLength
            );
            const encrypted = combined.slice(this.saltLength + this.ivLength + this.tagLength);

            // Derive the same key
            const key = crypto.pbkdf2Sync(
                this.masterKey,
                Buffer.concat([salt, Buffer.from(userId)]),
                this.pbkdf2Iterations,
                32,
                'sha256'
            );

            // Create decipher
            const decipher = crypto.createDecipheriv(this.algorithm, key, iv);
            decipher.setAuthTag(authTag);

            // Decrypt
            const decrypted = Buffer.concat([
                decipher.update(encrypted),
                decipher.final()
            ]);

            return decrypted.toString('utf8');
        } catch (error) {
            console.error('Decryption error:', error);
            throw new Error('Failed to decrypt token');
        }
    }

    /**
     * Validate a URL is a valid Home Assistant URL
     * @param {string} url - URL to validate
     * @returns {boolean} True if valid
     */
    validateHAUrl(url) {
        try {
            const parsedUrl = new URL(url);
            
            // Check protocol (http or https)
            if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
                return false;
            }

            // Basic validation for local IPs or domain names
            const hostname = parsedUrl.hostname;
            
            // Check for local IP patterns (192.168.x.x, 10.x.x.x, etc.)
            const localIpPattern = /^(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.)/;
            const isLocalIp = localIpPattern.test(hostname);
            
            // Check for localhost
            const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
            
            // Check for domain (including Nabu Casa domains)
            const isDomain = /^[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,}$/i.test(hostname);
            
            return isLocalIp || isLocalhost || isDomain;
        } catch (error) {
            return false;
        }
    }

    /**
     * Sanitize user input
     * @param {string} input - User input to sanitize
     * @returns {string} Sanitized input
     */
    sanitizeInput(input) {
        if (typeof input !== 'string') return '';
        
        // Remove any potential script tags or SQL injection attempts
        return input
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/[<>]/g, '')
            .trim();
    }
}

// Singleton instance
const encryptionService = new EncryptionService();

module.exports = {
    encryptToken: (token, userId) => encryptionService.encryptToken(token, userId),
    decryptToken: (encryptedToken, userId) => encryptionService.decryptToken(encryptedToken, userId),
    validateHAUrl: (url) => encryptionService.validateHAUrl(url),
    sanitizeInput: (input) => encryptionService.sanitizeInput(input)
};