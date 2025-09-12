import express, { Request, Response } from 'express';
import bodyParser from 'body-parser';
import crypto from 'crypto';
import { config } from './config/env';
import { supabase } from './config/supabase';
import { facebookService } from './services/facebook.service';
import { authService } from './services/auth.service';
import { faqHandler } from './handlers/faq.handler';
import { authHandler } from './handlers/auth.handler';
import { maintenanceHandler } from './handlers/maintenance.handler';
import { bookingHandler } from './handlers/booking.handler';
import { MessagingEvent, WebhookEvent } from './types/facebook';
import { webhookLogger, mainLogger } from './utils/logger';

const app = express();

// Verify request came from Facebook (optional but recommended)
function verifyRequestSignature(req: Request, _res: Response, buf: Buffer) {
  const signature = req.headers['x-hub-signature-256'] as string | undefined;
  if (!signature) {
    return; // Allow if you don't want to enforce signature in dev
  }
  const elements = signature.split('=');
  const signatureHash = elements[1];
  const expectedHash = crypto
    .createHmac('sha256', config.facebook.appSecret)
    .update(buf)
    .digest('hex');

  if (signatureHash !== expectedHash) {
    throw new Error('Could not validate the request signature.');
  }
}

// Use body-parser with raw buffer for signature verification
app.use(bodyParser.json({ verify: verifyRequestSignature }));

// Webhook verification endpoint
app.get('/webhook', (req: Request, res: Response) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === config.facebook.verifyToken) {
    mainLogger.info('Webhook verified successfully');
    return res.status(200).send(challenge as string);
  }

  return res.sendStatus(403);
});

// Webhook receiver endpoint
app.post('/webhook', async (req: Request, res: Response) => {
  const body = req.body as WebhookEvent;

  if (body.object === 'page') {
    for (const entry of body.entry) {
      const webhookEvent = entry.messaging || [];

      for (const event of webhookEvent) {
        try {
          await handleMessagingEvent(event);
        } catch (error) {
          webhookLogger.error('Error handling messaging event', error, {
            senderId: event.sender?.id,
            eventType: event.message ? 'message' : event.postback ? 'postback' : 'unknown'
          });
        }
      }
    }

    return res.status(200).send('EVENT_RECEIVED');
  }

  return res.sendStatus(404);
});

// Track users awaiting authentication
const awaitingAuth = new Map<string, boolean>();
// Track users in maintenance flow
const inMaintenanceFlow = new Map<string, boolean>();

async function handleMessagingEvent(event: MessagingEvent) {
  const senderId = event.sender.id;
  const eventType = event.message ? 'message' : event.postback ? 'postback' : 'unknown';
  const payload = event.message?.quick_reply?.payload || event.postback?.payload;
  const text = event.message?.text;
  
  webhookLogger.webhookLog(eventType, senderId, payload, text);

  // Check if user is authenticated
  const authStatus = await authService.isAuthenticated(senderId);
  webhookLogger.info('Authentication check', {
    senderId,
    authenticated: authStatus.authenticated,
    hasProfile: !!authStatus.profile
  });

  if (payload) {
    // Special handling for GET_STARTED
    if (payload === 'GET_STARTED') {
      if (!authStatus.authenticated) {
        awaitingAuth.set(senderId, true);
        await authHandler.promptForAccessCode(senderId);
        return;
      }
      await sendMainMenu(senderId);
      return;
    }

    // Allow AUTH_TRY_AGAIN without authentication
    if (payload === 'AUTH_TRY_AGAIN') {
      awaitingAuth.set(senderId, true);
      await authHandler.promptForAccessCode(senderId);
      return;
    }

    // Require authentication for other payloads
    if (!authStatus.authenticated) {
      awaitingAuth.set(senderId, true);
      await authHandler.promptForAccessCode(senderId);
      return;
    }

    await routePayload(senderId, payload);
    return;
  }

  // Handle text messages
  if (event.message?.text) {
    const text = event.message.text.trim();

    // If user is not authenticated, do not treat arbitrary text as an access code by default.
    // Instead, use any free-text (e.g., "hello", "hi", "get started") as a start trigger to prompt for the code.
    if (!authStatus.authenticated) {
      if (awaitingAuth.get(senderId)) {
        // We previously prompted for an access code, so this message is the code.
        awaitingAuth.delete(senderId);
        await authHandler.handleAccessCode(senderId, text);
        return;
      }

      // Treat any first free-text from unauthenticated users as a "start" trigger
      awaitingAuth.set(senderId, true);
      await authHandler.promptForAccessCode(senderId);
      return;
    }

    // Check if user is in maintenance flow
    if (inMaintenanceFlow.get(senderId)) {
      await maintenanceHandler.handleTextInput(senderId, text);
      return;
    }

    // Log conversation for analytics (simple version)
    logConversation(senderId, text, 'user');

    // Authenticated user sending text - show main menu
    await sendMainMenu(senderId);
    return;
  }
}

async function routePayload(senderId: string, payload: string) {
  // Clear flow states when navigating
  if (payload === 'MAIN_MENU') {
    inMaintenanceFlow.delete(senderId);
  }

  switch (payload) {
    case 'GET_STARTED':
    case 'MAIN_MENU':
      await sendMainMenu(senderId);
      break;

    case 'FAQ_MAIN':
      await faqHandler.handleMainMenu(senderId);
      break;

    case 'MAINTENANCE_REQUEST':
      inMaintenanceFlow.set(senderId, true);
      await maintenanceHandler.startRequest(senderId);
      break;

    case 'BOOK_AMENITY':
      await bookingHandler.startBooking(senderId);
      break;

    case 'MY_BOOKINGS':
      await bookingHandler.showMyBookings(senderId);
      break;

    case 'HANDOFF_REQUEST':
      await handleHandoffRequest(senderId);
      break;

    default:
      // Check for specific handler prefixes
      if (payload.startsWith('FAQ_')) {
        await faqHandler.handlePayload(senderId, payload);
      } else if (payload.startsWith('MAINT_')) {
        await maintenanceHandler.handlePayload(senderId, payload);
        // Clear flow state if they completed or cancelled
        if (payload === 'MAINT_CONFIRM_YES' || payload === 'MAINT_CONFIRM_NO') {
          inMaintenanceFlow.delete(senderId);
        }
      } else if (payload.startsWith('BOOK_')) {
        await bookingHandler.handlePayload(senderId, payload);
      } else {
        // Fallback to main menu
        await sendMainMenu(senderId);
      }
  }
}

async function sendMainMenu(senderId: string) {
  // Get user profile for personalized greeting
  const profile = await authService.getUserProfile(senderId);
  const greeting = profile?.full_name 
    ? `Hi ${profile.full_name}! What would you like to do?`
    : 'Hi! What would you like to do?';

  await facebookService.sendQuickReply(senderId, greeting, [
    { title: 'ℹ️ Building Info', payload: 'FAQ_MAIN' },
    { title: '🔧 Report Issue', payload: 'MAINTENANCE_REQUEST' },
    { title: '📅 Book Amenity', payload: 'BOOK_AMENITY' },
    { title: '💬 Talk to Manager', payload: 'HANDOFF_REQUEST' }
  ]);
}

// Simple handoff handler
async function handleHandoffRequest(senderId: string) {
  // Log the handoff request
  const profile = await authService.getUserProfile(senderId);
  const unit = profile?.units?.unit_number || 'Unknown';
  
  webhookLogger.info('Handoff request', {
    senderId,
    unit,
    profileId: profile?.id
  });
  
  await facebookService.sendTextMessage(
    senderId,
    `🤝 I've notified the property manager about your request.\n\n` +
    `Someone from our team will contact you within 1 business hour during office hours, ` +
    `or the next business day if after hours.\n\n` +
    `For emergencies, please call our 24/7 hotline at (555) 123-4567.`
  );

  // Show options
  await facebookService.sendQuickReply(
    senderId,
    'While you wait, is there anything else I can help with?',
    [
      { title: '🏠 Main Menu', payload: 'MAIN_MENU' },
      { title: 'ℹ️ Building Info', payload: 'FAQ_MAIN' },
      { title: '📅 Book Amenity', payload: 'BOOK_AMENITY' }
    ]
  );
}

// Simple conversation logger
function logConversation(senderId: string, message: string, sender: 'user' | 'bot') {
  // For demo, just log to console
  // In production, this would save to the chatbot_conversations table
  webhookLogger.info('Conversation', {
    senderId,
    sender,
    message: message.substring(0, 100)
  });
}

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok' });
});

// Debug endpoint to check database and invites
app.get('/debug/invites', async (_req: Request, res: Response) => {
  mainLogger.info('Debug endpoint accessed: /debug/invites');
  
  try {
    // Test database connection
    const { error: connError } = await supabase
      .from('invites')
      .select('count')
      .limit(1);
    
    if (connError) {
      mainLogger.error('Database connection test failed', connError);
      return res.status(500).json({ 
        error: 'Database connection failed', 
        details: connError 
      });
    }
    
    // Get all invites
    const { data: invites, error: invitesError } = await supabase
      .from('invites')
      .select('id, login_code, status, expires_at, full_name, created_at')
      .order('created_at', { ascending: false });
    
    if (invitesError) {
      mainLogger.error('Error fetching invites', invitesError);
      return res.status(500).json({ 
        error: 'Failed to fetch invites', 
        details: invitesError 
      });
    }
    
    mainLogger.info('Invites fetched successfully', { count: invites?.length || 0 });
    
    return res.status(200).json({
      database: 'connected',
      invites_count: invites?.length || 0,
      invites: invites || [],
      supabase_url: config.supabase.url
    });
  } catch (error) {
    mainLogger.error('Unexpected error in debug endpoint', error);
    return res.status(500).json({ error: 'Unexpected error', details: error });
  }
});

// Export app for testing
export default app;

// Only start server if not in test environment
if (process.env.NODE_ENV !== 'test') {
  app.listen(config.port, () => {
    mainLogger.info('Server started successfully', {
      host: config.host,
      port: config.port,
      webhookUrl: `http://${config.host}:${config.port}/webhook`,
      environment: process.env.NODE_ENV || 'production',
      debug: config.debug
    });
    
    console.log(`\n🚀 InventiBot is ready!`);
    console.log(`Server: http://${config.host}:${config.port}`);
    console.log(`Webhook: http://${config.host}:${config.port}/webhook`);
    console.log('\nFeatures enabled:');
    console.log('  ✅ Authentication with invite codes');
    console.log('  ✅ FAQ system');
    console.log('  ✅ Maintenance requests');
    console.log('  ✅ Amenity bookings');
    console.log('  ✅ Human handoff');
    console.log('  ✅ Structured logging for Render');
  });
}

