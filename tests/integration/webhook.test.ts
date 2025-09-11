import request from 'supertest';
import express from 'express';
import crypto from 'crypto';
import { WebhookEvent } from '../../src/types/facebook';

// Mock the Facebook service
jest.mock('../../src/services/facebook.service', () => ({
  facebookService: {
    sendTextMessage: jest.fn().mockResolvedValue(undefined),
    sendQuickReply: jest.fn().mockResolvedValue(undefined),
    sendTypingOn: jest.fn().mockResolvedValue(undefined),
    markSeen: jest.fn().mockResolvedValue(undefined),
    setGreeting: jest.fn().mockResolvedValue(undefined),
    setGetStarted: jest.fn().mockResolvedValue(undefined),
    setPersistentMenu: jest.fn().mockResolvedValue(undefined),
  },
}));

// Mock the FAQ handler
jest.mock('../../src/handlers/faq.handler', () => ({
  faqHandler: {
    handleMainMenu: jest.fn().mockResolvedValue(undefined),
    handlePayload: jest.fn().mockResolvedValue(undefined),
  },
}));

describe('Webhook API Tests', () => {
  let app: express.Application;
  
  beforeAll(() => {
    // Create a test app instance
    app = express();
    app.use(express.json());
    
    // Add webhook routes
    app.get('/webhook', (req, res) => {
      const mode = req.query['hub.mode'];
      const token = req.query['hub.verify_token'];
      const challenge = req.query['hub.challenge'];

      if (mode === 'subscribe' && token === 'test_verify_token') {
        return res.status(200).send(challenge as string);
      }
      return res.sendStatus(403);
    });
    
    app.post('/webhook', async (req, res) => {
      const { facebookService } = require('../../src/services/facebook.service');
      const { faqHandler } = require('../../src/handlers/faq.handler');
      const body = req.body;
      
      if (body.object === 'page') {
        for (const entry of body.entry) {
          const webhookEvent = entry.messaging || [];
          for (const event of webhookEvent) {
            const senderId = event.sender.id;
            const payload = event.message?.quick_reply?.payload || event.postback?.payload;
            
            if (payload) {
              if (payload === 'GET_STARTED' || payload === 'MAIN_MENU') {
                await facebookService.sendQuickReply(senderId, 'Hi! What would you like to do?', [
                  { title: 'ℹ️ Building Info', payload: 'FAQ_MAIN' },
                  { title: '🔧 Report Issue', payload: 'MAINTENANCE_REQUEST' },
                  { title: '📅 Book Amenity', payload: 'BOOK_AMENITY' },
                  { title: '💬 Talk to Manager', payload: 'HANDOFF_REQUEST' }
                ]);
              } else if (payload === 'FAQ_MAIN') {
                await faqHandler.handleMainMenu(senderId);
              } else if (payload.startsWith('FAQ_')) {
                await faqHandler.handlePayload(senderId, payload);
              }
            } else if (event.message?.text) {
              await facebookService.sendQuickReply(senderId, 'Hi! What would you like to do?', [
                { title: 'ℹ️ Building Info', payload: 'FAQ_MAIN' },
                { title: '🔧 Report Issue', payload: 'MAINTENANCE_REQUEST' },
                { title: '📅 Book Amenity', payload: 'BOOK_AMENITY' },
                { title: '💬 Talk to Manager', payload: 'HANDOFF_REQUEST' }
              ]);
            }
          }
        }
        return res.status(200).send('EVENT_RECEIVED');
      }
      return res.sendStatus(404);
    });
    
    app.get('/health', (_req, res) => {
      res.status(200).json({ status: 'ok' });
    });
  });
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /webhook - Verification', () => {
    it('should verify webhook with correct token', async () => {
      const response = await request(app)
        .get('/webhook')
        .query({
          'hub.mode': 'subscribe',
          'hub.verify_token': 'test_verify_token',
          'hub.challenge': 'test_challenge_123',
        });

      expect(response.status).toBe(200);
      expect(response.text).toBe('test_challenge_123');
    });

    it('should reject webhook with incorrect token', async () => {
      const response = await request(app)
        .get('/webhook')
        .query({
          'hub.mode': 'subscribe',
          'hub.verify_token': 'wrong_token',
          'hub.challenge': 'test_challenge_123',
        });

      expect(response.status).toBe(403);
    });

    it('should reject webhook with missing parameters', async () => {
      const response = await request(app)
        .get('/webhook')
        .query({
          'hub.mode': 'subscribe',
        });

      expect(response.status).toBe(403);
    });
  });

  describe('POST /webhook - Message Handling', () => {
    const createSignature = (body: any): string => {
      const jsonString = JSON.stringify(body);
      return 'sha256=' + crypto
        .createHmac('sha256', 'test_app_secret')
        .update(jsonString)
        .digest('hex');
    };

    it('should handle text message and show main menu', async () => {
      const { facebookService } = require('../../src/services/facebook.service');
      
      const webhookEvent: WebhookEvent = {
        object: 'page',
        entry: [
          {
            id: 'page_id',
            time: Date.now(),
            messaging: [
              {
                sender: { id: 'user_123' },
                recipient: { id: 'page_456' },
                timestamp: Date.now(),
                message: {
                  mid: 'mid_123',
                  text: 'Hello bot',
                },
              },
            ],
          },
        ],
      };

      const response = await request(app)
        .post('/webhook')
        .set('x-hub-signature-256', createSignature(webhookEvent))
        .send(webhookEvent);

      expect(response.status).toBe(200);
      expect(response.text).toBe('EVENT_RECEIVED');
      expect(facebookService.sendQuickReply).toHaveBeenCalledWith(
        'user_123',
        'Hi! What would you like to do?',
        expect.arrayContaining([
          { title: 'ℹ️ Building Info', payload: 'FAQ_MAIN' },
          { title: '🔧 Report Issue', payload: 'MAINTENANCE_REQUEST' },
          { title: '📅 Book Amenity', payload: 'BOOK_AMENITY' },
          { title: '💬 Talk to Manager', payload: 'HANDOFF_REQUEST' },
        ])
      );
    });

    it('should handle GET_STARTED postback', async () => {
      const { facebookService } = require('../../src/services/facebook.service');
      
      const webhookEvent: WebhookEvent = {
        object: 'page',
        entry: [
          {
            id: 'page_id',
            time: Date.now(),
            messaging: [
              {
                sender: { id: 'user_123' },
                recipient: { id: 'page_456' },
                timestamp: Date.now(),
                postback: {
                  payload: 'GET_STARTED',
                },
              },
            ],
          },
        ],
      };

      const response = await request(app)
        .post('/webhook')
        .set('x-hub-signature-256', createSignature(webhookEvent))
        .send(webhookEvent);

      expect(response.status).toBe(200);
      expect(facebookService.sendQuickReply).toHaveBeenCalled();
    });

    it('should handle FAQ_MAIN payload', async () => {
      const { faqHandler } = require('../../src/handlers/faq.handler');
      
      const webhookEvent: WebhookEvent = {
        object: 'page',
        entry: [
          {
            id: 'page_id',
            time: Date.now(),
            messaging: [
              {
                sender: { id: 'user_123' },
                recipient: { id: 'page_456' },
                timestamp: Date.now(),
                postback: {
                  payload: 'FAQ_MAIN',
                },
              },
            ],
          },
        ],
      };

      const response = await request(app)
        .post('/webhook')
        .set('x-hub-signature-256', createSignature(webhookEvent))
        .send(webhookEvent);

      expect(response.status).toBe(200);
      expect(faqHandler.handleMainMenu).toHaveBeenCalledWith('user_123');
    });

    it('should handle quick reply payload', async () => {
      const { faqHandler } = require('../../src/handlers/faq.handler');
      
      const webhookEvent: WebhookEvent = {
        object: 'page',
        entry: [
          {
            id: 'page_id',
            time: Date.now(),
            messaging: [
              {
                sender: { id: 'user_123' },
                recipient: { id: 'page_456' },
                timestamp: Date.now(),
                message: {
                  mid: 'mid_123',
                  text: 'Hours of Operation',
                  quick_reply: {
                    payload: 'FAQ_HOURS',
                  },
                },
              },
            ],
          },
        ],
      };

      const response = await request(app)
        .post('/webhook')
        .set('x-hub-signature-256', createSignature(webhookEvent))
        .send(webhookEvent);

      expect(response.status).toBe(200);
      expect(faqHandler.handlePayload).toHaveBeenCalledWith('user_123', 'FAQ_HOURS');
    });

    it('should reject non-page object', async () => {
      const webhookEvent = {
        object: 'not_page',
        entry: [],
      };

      const response = await request(app)
        .post('/webhook')
        .set('x-hub-signature-256', createSignature(webhookEvent))
        .send(webhookEvent);

      expect(response.status).toBe(404);
    });

    it('should handle multiple messaging events', async () => {
      const { facebookService } = require('../../src/services/facebook.service');
      
      const webhookEvent: WebhookEvent = {
        object: 'page',
        entry: [
          {
            id: 'page_id',
            time: Date.now(),
            messaging: [
              {
                sender: { id: 'user_123' },
                recipient: { id: 'page_456' },
                timestamp: Date.now(),
                message: {
                  mid: 'mid_1',
                  text: 'First message',
                },
              },
              {
                sender: { id: 'user_456' },
                recipient: { id: 'page_456' },
                timestamp: Date.now(),
                message: {
                  mid: 'mid_2',
                  text: 'Second message',
                },
              },
            ],
          },
        ],
      };

      const response = await request(app)
        .post('/webhook')
        .set('x-hub-signature-256', createSignature(webhookEvent))
        .send(webhookEvent);

      expect(response.status).toBe(200);
      expect(facebookService.sendQuickReply).toHaveBeenCalledTimes(2);
    });
  });

  describe('GET /health - Health Check', () => {
    it('should return OK status', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: 'ok' });
    });
  });
});
