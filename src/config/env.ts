import dotenv from 'dotenv';

dotenv.config();

export const config = {
  // Server config
  port: parseInt(process.env.PORT || '3000', 10),
  host: process.env.HOST || '0.0.0.0', // Changed for Render
  
  // Facebook Messenger config
  facebook: {
    verifyToken: process.env.FACEBOOK_VERIFY_TOKEN || '',
    accessToken: process.env.FACEBOOK_ACCESS_TOKEN || '',
    appSecret: process.env.FACEBOOK_APP_SECRET || '',
    graphApiUrl: 'https://graph.facebook.com/v18.0'
  },
  
  // Supabase config
  supabase: {
    url: process.env.SUPABASE_URL || '',
    anonKey: process.env.SUPABASE_ANON_KEY || ''
  },
  
  // Session config
  sessionDurationHours: parseInt(process.env.SESSION_DURATION_HOURS || '24', 10),
  
  // Debug mode
  debug: process.env.DEBUG === 'true'
};

// Validate required environment variables
const requiredEnvVars = [
  'FACEBOOK_VERIFY_TOKEN',
  'FACEBOOK_ACCESS_TOKEN',
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY'
];

for (const varName of requiredEnvVars) {
  if (!process.env[varName]) {
    console.error(`Missing required environment variable: ${varName}`);
    process.exit(1);
  }
}
