import express, { Request, Response } from 'express';
import bodyParser from 'body-parser';
import crypto from 'crypto';
import { config } from './config/env';
import { supabase, supabaseAdmin } from './config/supabase';
import { facebookService } from './services/facebook.service';
import { authService } from './services/auth.service';
import { faqHandler } from './handlers/faq.handler';
import { authHandler } from './handlers/auth.handler';
import { maintenanceHandler } from './handlers/maintenance.handler';
import { bookingHandler } from './handlers/booking.handler';
import { visitorPassHandler } from './handlers/visitor-pass.handler';
import { announcementsHandler } from './handlers/announcements.handler';
import { MessagingEvent, WebhookEvent } from './types/facebook';
import { webhookLogger, mainLogger } from './utils/logger';

// Import IoT module using require for now (since it's JS)
const iotModule = require('./features/iot');
const IoTDatabaseAdapter = require('./features/iot/dbAdapter');
let iotHandler: any = null;

const app = express();

// Initialize IoT module with database connection
setTimeout(() => {
  // Create database adapter for IoT module using admin client to bypass RLS
  const iotDbAdapter = new IoTDatabaseAdapter(supabaseAdmin);
  iotHandler = iotModule.initialize(iotDbAdapter);
  mainLogger.info('IoT module initialized');
}, 1000);

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
// Track users in visitor pass creation flow
const inVisitorPassFlow = new Map<string, boolean>();

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
    hasProfile: !!authStatus.profile,
    isVisitor: authStatus.isVisitor
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

    // Handle user type selection (resident vs visitor)
    if (payload === 'USER_TYPE_RESIDENT' || payload === 'USER_TYPE_VISITOR') {
      await authHandler.handleUserTypeSelection(senderId, payload);
      awaitingAuth.set(senderId, true);
      return;
    }

    // Allow AUTH_TRY_AGAIN without authentication
    if (payload === 'AUTH_TRY_AGAIN') {
      awaitingAuth.set(senderId, true);
      await authHandler.promptForAccessCode(senderId);
      return;
    }

    // Handle visitor-specific payloads
    if (authStatus.isVisitor) {
      await handleVisitorPayload(senderId, payload, authStatus.visitorSession);
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

    // Handle visitor text messages
    if (authStatus.isVisitor) {
      await sendVisitorMenu(senderId, authStatus.visitorSession!);
      return;
    }

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

    // Check if user is in visitor pass creation flow
    if (inVisitorPassFlow.get(senderId)) {
      await visitorPassHandler.handleVisitorPassCreation(senderId, event.message);
      return;
    }

    // Check if user is in IoT setup flow
    if (iotHandler) {
      const iotSession = iotHandler.getUserSession(senderId);
      if (iotSession && (iotSession.state === 'URL_INPUT' || iotSession.state === 'TOKEN_INPUT')) {
        const result = await iotHandler.handleTextInput(senderId, text);
        await sendIoTResponse(senderId, result);
        return;
      }
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
    inVisitorPassFlow.delete(senderId);
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

    case 'VISITOR_PASS_MENU':
      await handleVisitorPassMenu(senderId);
      break;

    case 'CREATE_VISITOR_PASS':
      inVisitorPassFlow.set(senderId, true);
      await visitorPassHandler.handleVisitorPassCreation(senderId, {});
      break;

    case 'LIST_VISITOR_PASSES':
      await visitorPassHandler.listVisitorPasses(senderId);
      break;

    case 'VIEW_ANNOUNCEMENTS':
      await announcementsHandler.showAnnouncements(senderId);
      break;

    case 'IOT_MONITORING':
      // Handle IoT entry point
      if (iotHandler) {
        const result = await iotHandler.handleAction(senderId, 'IOT_MONITORING');
        await sendIoTResponse(senderId, result);
      } else {
        await facebookService.sendTextMessage(senderId, 'IoT module is not available at the moment. Please try again later.');
      }
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
      } else if (payload.startsWith('VISITOR_') || payload.startsWith('VISIT_') || 
                 payload.startsWith('START_TIME_') || payload.startsWith('DURATION_') || 
                 payload.startsWith('CONFIRM_PASS_')) {
        // Handle visitor pass flow payloads
        await visitorPassHandler.handleVisitorPassCreation(senderId, { 
          quick_reply: { payload } 
        });
        // Clear flow state if they completed or cancelled
        if (payload === 'CONFIRM_PASS_YES' || payload === 'CONFIRM_PASS_NO') {
          inVisitorPassFlow.delete(senderId);
        }
      } else if (payload.startsWith('IOT_') || payload === 'IOT_MONITORING') {
        // Handle IoT payloads
        if (iotHandler) {
          const result = await iotHandler.handleAction(senderId, payload);
          await sendIoTResponse(senderId, result);
        } else {
          await facebookService.sendTextMessage(senderId, 'IoT module is not available at the moment. Please try again later.');
        }
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
    { title: '📢 Announcements', payload: 'VIEW_ANNOUNCEMENTS' },
    { title: 'ℹ️ Building Info', payload: 'FAQ_MAIN' },
    { title: '🔧 Report Issue', payload: 'MAINTENANCE_REQUEST' },
    { title: '📅 Book Amenity', payload: 'BOOK_AMENITY' },
    { title: '🎫 Visitor Pass', payload: 'VISITOR_PASS_MENU' },
    { title: '🏠 IoT Devices', payload: 'IOT_MONITORING' }
  ]);
}

// IoT response handler
async function sendIoTResponse(senderId: string, result: any) {
  if (result.quickReplies && result.quickReplies.length > 0) {
    // Send with quick reply buttons
    const quickReplies = result.quickReplies.map((button: any) => ({
      title: button.label,
      payload: button.action
    }));
    await facebookService.sendQuickReply(senderId, result.message, quickReplies);
  } else {
    // Send as plain text
    await facebookService.sendTextMessage(senderId, result.message);
  }

  // Check if we need to handle special actions
  if (result.action === 'SHOW_DEVICE_MENU') {
    // Trigger device menu display
    const menuResult = await iotHandler.handleAction(senderId, 'IOT_MAIN_MENU');
    await sendIoTResponse(senderId, menuResult);
  }
}

// Visitor pass menu handler
async function handleVisitorPassMenu(senderId: string) {
  await facebookService.sendQuickReply(
    senderId,
    '🎫 Visitor Pass Management\n\nWhat would you like to do?',
    [
      { title: '➕ Create Pass', payload: 'CREATE_VISITOR_PASS' },
      { title: '📋 View My Passes', payload: 'LIST_VISITOR_PASSES' },
      { title: '🏠 Main Menu', payload: 'MAIN_MENU' }
    ]
  );
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

// Visitor menu handler
async function sendVisitorMenu(senderId: string, visitorSession: any) {
  await facebookService.sendQuickReply(
    senderId,
    `Hi ${visitorSession.visitorName}! As a visitor, you have limited access to building features:`,
    [
      { title: 'ℹ️ Building Info', payload: 'VISITOR_BUILDING_INFO' },
      { title: '📍 Get Directions', payload: 'VISITOR_DIRECTIONS' },
      { title: '☎️ Contact Info', payload: 'VISITOR_CONTACT' },
      { title: '🚪 Exit', payload: 'VISITOR_EXIT' }
    ]
  );
}

// Handle visitor-specific payloads
async function handleVisitorPayload(senderId: string, payload: string, visitorSession: any) {
  switch (payload) {
    case 'VISITOR_BUILDING_INFO':
      await facebookService.sendTextMessage(
        senderId,
        `ℹ️ **Building Information**\n\n` +
        `You are visiting a unit in this building. For detailed information, please ask the resident you're visiting.\n\n` +
        `⚠️ As a visitor, you don't have access to resident-specific features like maintenance requests or amenity bookings.`
      );
      await sendVisitorMenu(senderId, visitorSession);
      break;
      
    case 'VISITOR_DIRECTIONS':
      await facebookService.sendTextMessage(
        senderId,
        `📍 **Building Directions**\n\n` +
        `Please proceed to the lobby and check in with security. Show them your visitor pass code.\n\n` +
        `Your pass is valid until: ${new Date(visitorSession.validUntil).toLocaleString()}`
      );
      await sendVisitorMenu(senderId, visitorSession);
      break;
      
    case 'VISITOR_CONTACT':
      await facebookService.sendTextMessage(
        senderId,
        `☎️ **Contact Information**\n\n` +
        `Building Security: (555) 123-4567\n` +
        `Emergency: 911\n\n` +
        `For non-emergency assistance, please contact the resident you're visiting.`
      );
      await sendVisitorMenu(senderId, visitorSession);
      break;
      
    case 'VISITOR_EXIT':
      authService.clearVisitorSession(senderId);
      await facebookService.sendTextMessage(
        senderId,
        `👋 Thank you for visiting! Your visitor session has been ended.\n\n` +
        `Have a great day!`
      );
      break;
      
    default:
      // For any other payload, remind them they're a visitor
      await facebookService.sendTextMessage(
        senderId,
        `⚠️ Sorry, this feature is not available to visitors. You don't have access to resident features.`
      );
      await sendVisitorMenu(senderId, visitorSession);
  }
}

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok' });
});

// Webhook endpoint for announcement notifications from Supabase
app.post('/webhook/announcements', async (req: Request, res: Response) => {
  try {
    mainLogger.info('Announcement webhook received', {
      type: req.body.type,
      table: req.body.table,
      announcementId: req.body.record?.id
    });

    // Verify the webhook is from Supabase
    const webhookSecret = process.env.WEBHOOK_SECRET;
    if (webhookSecret && req.headers['x-webhook-secret'] !== webhookSecret) {
      mainLogger.warn('Webhook authentication failed');
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Handle Supabase's default webhook payload format
    const { type, table, record, old_record } = req.body;

    // Check if this is an announcement being published
    if (table === 'announcements' && record && record.is_published) {
      // For UPDATE events, check if it's newly published
      const isNewlyPublished = 
        type === 'INSERT' || 
        (type === 'UPDATE' && old_record && !old_record.is_published);

      if (isNewlyPublished) {
        // Process the announcement notification
        const result = await announcementsHandler.processAnnouncementWebhook({
          announcement: record,
          building_id: record.building_id,
          target_units: record.target_units
        });

        mainLogger.info('Announcement notifications sent', result);
        return res.status(200).json({ success: true, ...result });
      }
    }

    return res.status(200).json({ success: true, message: 'Webhook processed' });
  } catch (error) {
    mainLogger.error('Error processing announcement webhook', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
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
    console.log('  ✅ Visitor pass management');
    console.log('  ✅ Building announcements');
    console.log('  ✅ Real-time notifications');
    console.log('  ✅ Human handoff');
    console.log('  ✅ Structured logging for Render');
  });
}

