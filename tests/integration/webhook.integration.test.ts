import request from 'supertest';
import crypto from 'crypto';
import { 
  testData, 
  mockFacebookService, 
  mockAuthService,
  mockSupabase,
  resetAllMocks 
} from '../mocks';

// Mock dependencies before importing app
jest.mock('../../src/services/facebook.service', () => ({
  facebookService: mockFacebookService
}));

jest.mock('../../src/services/auth.service', () => ({
  authService: mockAuthService
}));

jest.mock('../../src/config/supabase', () => ({
  supabase: mockSupabase
}));

// Import app after mocks are set up
import app from '../../src/index';

describe('Webhook Integration Tests', () => {
  const WEBHOOK_PATH = '/webhook';
  const VERIFY_TOKEN = process.env.FACEBOOK_VERIFY_TOKEN || 'test_verify_token';
  const APP_SECRET = process.env.FACEBOOK_APP_SECRET || 'test_app_secret';

  beforeEach(() => {
    resetAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /webhook - Verification', () => {
    it('should verify webhook with correct token', async () => {
      const challenge = 'test_challenge_string';
      
      const response = await request(app)
        .get(WEBHOOK_PATH)
        .query({
          'hub.mode': 'subscribe',
          'hub.verify_token': VERIFY_TOKEN,
          'hub.challenge': challenge
        });

      expect(response.status).toBe(200);
      expect(response.text).toBe(challenge);
    });

    it('should reject webhook with incorrect token', async () => {
      const response = await request(app)
        .get(WEBHOOK_PATH)
        .query({
          'hub.mode': 'subscribe',
          'hub.verify_token': 'wrong_token',
          'hub.challenge': 'test_challenge'
        });

      expect(response.status).toBe(403);
    });

    it('should reject webhook with missing parameters', async () => {
      const response = await request(app)
        .get(WEBHOOK_PATH)
        .query({
          'hub.mode': 'subscribe'
        });

      expect(response.status).toBe(403);
    });

    it('should handle invalid mode', async () => {
      const response = await request(app)
        .get(WEBHOOK_PATH)
        .query({
          'hub.mode': 'unsubscribe',
          'hub.verify_token': VERIFY_TOKEN,
          'hub.challenge': 'test_challenge'
        });

      expect(response.status).toBe(403);
    });
  });

  describe('POST /webhook - Message Handling', () => {
    const createSignature = (payload: string) => {
      return 'sha256=' + crypto
        .createHmac('sha256', APP_SECRET)
        .update(payload)
        .digest('hex');
    };

    it('should handle text message from authenticated user', async () => {
      mockAuthService.isAuthenticated.mockResolvedValue({
        authenticated: true,
        profile: testData.userProfile
      });

      const payload = testData.webhookMessage;
      const signature = createSignature(JSON.stringify(payload));

      const response = await request(app)
        .post(WEBHOOK_PATH)
        .set('x-hub-signature-256', signature)
        .send(payload);

      expect(response.status).toBe(200);
      expect(response.text).toBe('EVENT_RECEIVED');
      expect(mockAuthService.isAuthenticated).toHaveBeenCalledWith('fb_user_123');
    });

    it('should handle text message from unauthenticated user', async () => {
      mockAuthService.isAuthenticated.mockResolvedValue({
        authenticated: false
      });

      const payload = testData.webhookMessage;
      const signature = createSignature(JSON.stringify(payload));

      const response = await request(app)
        .post(WEBHOOK_PATH)
        .set('x-hub-signature-256', signature)
        .send(payload);

      expect(response.status).toBe(200);
      expect(mockFacebookService.sendTextMessage).toHaveBeenCalledWith(
        'fb_user_123',
        expect.stringContaining('access code')
      );
    });

    it('should handle postback events', async () => {
      mockAuthService.isAuthenticated.mockResolvedValue({
        authenticated: true,
        profile: testData.userProfile
      });

      const payload = testData.webhookPostback;
      const signature = createSignature(JSON.stringify(payload));

      const response = await request(app)
        .post(WEBHOOK_PATH)
        .set('x-hub-signature-256', signature)
        .send(payload);

      expect(response.status).toBe(200);
      expect(response.text).toBe('EVENT_RECEIVED');
    });

    it('should handle quick reply events', async () => {
      mockAuthService.isAuthenticated.mockResolvedValue({
        authenticated: true,
        profile: testData.userProfile
      });

      const payload = testData.webhookQuickReply;
      const signature = createSignature(JSON.stringify(payload));

      const response = await request(app)
        .post(WEBHOOK_PATH)
        .set('x-hub-signature-256', signature)
        .send(payload);

      expect(response.status).toBe(200);
      expect(response.text).toBe('EVENT_RECEIVED');
    });

    it('should reject webhook with invalid signature', async () => {
      const payload = testData.webhookMessage;
      const invalidSignature = 'sha256=invalid_signature';

      const response = await request(app)
        .post(WEBHOOK_PATH)
        .set('x-hub-signature-256', invalidSignature)
        .send(payload);

      expect(response.status).toBe(403);
    });

    it('should reject webhook without signature', async () => {
      const payload = testData.webhookMessage;

      const response = await request(app)
        .post(WEBHOOK_PATH)
        .send(payload);

      expect(response.status).toBe(403);
    });

    it('should handle multiple messaging events', async () => {
      mockAuthService.isAuthenticated.mockResolvedValue({
        authenticated: true,
        profile: testData.userProfile
      });

      const payload = {
        object: 'page',
        entry: [{
          id: 'PAGE_ID',
          time: 1234567890,
          messaging: [
            {
              sender: { id: 'user1' },
              recipient: { id: 'PAGE_ID' },
              timestamp: 1234567890,
              message: { mid: 'mid1', text: 'Hello' }
            },
            {
              sender: { id: 'user2' },
              recipient: { id: 'PAGE_ID' },
              timestamp: 1234567891,
              message: { mid: 'mid2', text: 'Hi' }
            }
          ]
        }]
      };

      const signature = createSignature(JSON.stringify(payload));

      const response = await request(app)
        .post(WEBHOOK_PATH)
        .set('x-hub-signature-256', signature)
        .send(payload);

      expect(response.status).toBe(200);
      expect(mockAuthService.isAuthenticated).toHaveBeenCalledTimes(2);
    });

    it('should handle attachment messages', async () => {
      mockAuthService.isAuthenticated.mockResolvedValue({
        authenticated: true,
        profile: testData.userProfile
      });

      const payload = {
        object: 'page',
        entry: [{
          id: 'PAGE_ID',
          time: 1234567890,
          messaging: [{
            sender: { id: 'fb_user_123' },
            recipient: { id: 'PAGE_ID' },
            timestamp: 1234567890,
            message: {
              mid: 'message_id',
              attachments: [{
                type: 'image',
                payload: {
                  url: 'https://example.com/image.jpg'
                }
              }]
            }
          }]
        }]
      };

      const signature = createSignature(JSON.stringify(payload));

      const response = await request(app)
        .post(WEBHOOK_PATH)
        .set('x-hub-signature-256', signature)
        .send(payload);

      expect(response.status).toBe(200);
    });

    it('should handle echo messages by ignoring them', async () => {
      const payload = {
        object: 'page',
        entry: [{
          id: 'PAGE_ID',
          time: 1234567890,
          messaging: [{
            sender: { id: 'PAGE_ID' },
            recipient: { id: 'fb_user_123' },
            timestamp: 1234567890,
            message: {
              mid: 'message_id',
              text: 'Echo message',
              is_echo: true
            }
          }]
        }]
      };

      const signature = createSignature(JSON.stringify(payload));

      const response = await request(app)
        .post(WEBHOOK_PATH)
        .set('x-hub-signature-256', signature)
        .send(payload);

      expect(response.status).toBe(200);
      expect(mockAuthService.isAuthenticated).not.toHaveBeenCalled();
    });
  });

  describe('POST /webhook - Error Handling', () => {
    const createSignature = (payload: string) => {
      return 'sha256=' + crypto
        .createHmac('sha256', APP_SECRET)
        .update(payload)
        .digest('hex');
    };

    it('should handle database errors gracefully', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      mockAuthService.isAuthenticated.mockRejectedValue(new Error('Database error'));

      const payload = testData.webhookMessage;
      const signature = createSignature(JSON.stringify(payload));

      const response = await request(app)
        .post(WEBHOOK_PATH)
        .set('x-hub-signature-256', signature)
        .send(payload);

      expect(response.status).toBe(200); // Still returns 200 to Facebook
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error'),
        expect.any(Error)
      );
      consoleErrorSpy.mockRestore();
    });

    it('should handle Facebook API errors gracefully', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      mockAuthService.isAuthenticated.mockResolvedValue({
        authenticated: true,
        profile: testData.userProfile
      });
      mockFacebookService.sendTextMessage.mockRejectedValue(new Error('API Error'));

      const payload = testData.webhookMessage;
      const signature = createSignature(JSON.stringify(payload));

      const response = await request(app)
        .post(WEBHOOK_PATH)
        .set('x-hub-signature-256', signature)
        .send(payload);

      expect(response.status).toBe(200); // Still returns 200 to Facebook
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error'),
        expect.any(Error)
      );
      consoleErrorSpy.mockRestore();
    });

    it('should handle malformed payload', async () => {
      const payload = { invalid: 'structure' };
      const signature = createSignature(JSON.stringify(payload));

      const response = await request(app)
        .post(WEBHOOK_PATH)
        .set('x-hub-signature-256', signature)
        .send(payload);

      expect(response.status).toBe(200);
    });

    it('should handle empty entry array', async () => {
      const payload = {
        object: 'page',
        entry: []
      };
      const signature = createSignature(JSON.stringify(payload));

      const response = await request(app)
        .post(WEBHOOK_PATH)
        .set('x-hub-signature-256', signature)
        .send(payload);

      expect(response.status).toBe(200);
    });

    it('should handle missing messaging array', async () => {
      const payload = {
        object: 'page',
        entry: [{
          id: 'PAGE_ID',
          time: 1234567890
        }]
      };
      const signature = createSignature(JSON.stringify(payload));

      const response = await request(app)
        .post(WEBHOOK_PATH)
        .set('x-hub-signature-256', signature)
        .send(payload);

      expect(response.status).toBe(200);
    });
  });

  describe('Health Check Endpoint', () => {
    it('should return healthy status', async () => {
      const response = await request(app)
        .get('/health');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: 'ok' });
    });
  });

  describe('Rate Limiting', () => {
    it('should handle rapid sequential requests', async () => {
      mockAuthService.isAuthenticated.mockResolvedValue({
        authenticated: true,
        profile: testData.userProfile
      });

      const payload = testData.webhookMessage;
      const signature = createSignature(JSON.stringify(payload));

      const promises = Array(10).fill(null).map(() => 
        request(app)
          .post(WEBHOOK_PATH)
          .set('x-hub-signature-256', signature)
          .send(payload)
      );

      const responses = await Promise.all(promises);
      
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });
  });

  describe('Concurrent Message Processing', () => {
    it('should handle concurrent messages from different users', async () => {
      mockAuthService.isAuthenticated.mockResolvedValue({
        authenticated: true,
        profile: testData.userProfile
      });

      const createPayload = (userId: string) => ({
        object: 'page',
        entry: [{
          id: 'PAGE_ID',
          time: Date.now(),
          messaging: [{
            sender: { id: userId },
            recipient: { id: 'PAGE_ID' },
            timestamp: Date.now(),
            message: {
              mid: `mid_${userId}`,
              text: `Message from ${userId}`
            }
          }]
        }]
      });

      const userIds = ['user1', 'user2', 'user3', 'user4', 'user5'];
      
      const promises = userIds.map(userId => {
        const payload = createPayload(userId);
        const signature = createSignature(JSON.stringify(payload));
        
        return request(app)
          .post(WEBHOOK_PATH)
          .set('x-hub-signature-256', signature)
          .send(payload);
      });

      const responses = await Promise.all(promises);
      
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
      
      expect(mockAuthService.isAuthenticated).toHaveBeenCalledTimes(5);
    });
  });
});

function createSignature(payload: string): string {
  return 'sha256=' + crypto
    .createHmac('sha256', process.env.FACEBOOK_APP_SECRET || 'test_app_secret')
    .update(payload)
    .digest('hex');
}
