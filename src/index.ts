import express, { Request, Response } from 'express';
import bodyParser from 'body-parser';
import crypto from 'crypto';
import { config } from './config/env';
import { facebookService } from './services/facebook.service';
import { authService } from './services/auth.service';
import { faqHandler } from './handlers/faq.handler';
import { authHandler } from './handlers/auth.handler';
import { MessagingEvent, WebhookEvent } from './types/facebook';

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
    console.log('WEBHOOK_VERIFIED');
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
          console.error('Error handling event:', error);
        }
      }
    }

    return res.status(200).send('EVENT_RECEIVED');
  }

  return res.sendStatus(404);
});

// Track users awaiting authentication
const awaitingAuth = new Map<string, boolean>();

async function handleMessagingEvent(event: MessagingEvent) {
  const senderId = event.sender.id;

  // Check if user is authenticated
  const authStatus = await authService.isAuthenticated(senderId);

  // Handle quick replies and postbacks
  const payload = event.message?.quick_reply?.payload || event.postback?.payload;

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

    // Check if user is in authentication flow
    if (awaitingAuth.get(senderId) || !authStatus.authenticated) {
      // Treat text as access code
      awaitingAuth.delete(senderId);
      await authHandler.handleAccessCode(senderId, text);
      return;
    }

    // Authenticated user sending text - show main menu
    await sendMainMenu(senderId);
    return;
  }
}

async function routePayload(senderId: string, payload: string) {
  switch (payload) {
    case 'GET_STARTED':
    case 'MAIN_MENU':
      await sendMainMenu(senderId);
      break;

    case 'FAQ_MAIN':
      await faqHandler.handleMainMenu(senderId);
      break;

    default:
      if (payload.startsWith('FAQ_')) {
        await faqHandler.handlePayload(senderId, payload);
        break;
      }

      // Fallback
      await sendMainMenu(senderId);
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

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok' });
});

app.listen(config.port, () => {
  console.log(`Server is running on http://${config.host}:${config.port}`);
});

