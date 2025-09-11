import { facebookService } from '../../src/services/facebook.service';
import { faqHandler } from '../../src/handlers/faq.handler';

// Mock external services
jest.mock('../../src/services/facebook.service', () => ({
  facebookService: {
    sendTextMessage: jest.fn().mockResolvedValue(undefined),
    sendQuickReply: jest.fn().mockResolvedValue(undefined),
    sendTypingOn: jest.fn().mockResolvedValue(undefined),
    markSeen: jest.fn().mockResolvedValue(undefined),
    getUserProfile: jest.fn().mockResolvedValue({
      id: 'user_123',
      first_name: 'John',
      last_name: 'Doe',
    }),
  },
}));

jest.mock('../../src/config/supabase', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

describe('Conversation Flow Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Complete FAQ Flow', () => {
    it('should handle complete FAQ navigation from main menu to answer', async () => {
      const userId = 'test_user_123';

      // Step 1: User opens main FAQ menu
      await faqHandler.handleMainMenu(userId);
      
      expect(facebookService.sendQuickReply).toHaveBeenCalledWith(
        userId,
        'What information are you looking for? Please select a category:',
        expect.arrayContaining([
          { title: '🕒 Hours of Operation', payload: 'FAQ_HOURS' },
        ])
      );

      jest.clearAllMocks();

      // Step 2: User selects Hours of Operation
      await faqHandler.handlePayload(userId, 'FAQ_HOURS');

      expect(facebookService.sendQuickReply).toHaveBeenCalledWith(
        userId,
        '🕒 Hours of Operation - Select an option:',
        expect.arrayContaining([
          { title: '🏊 Pool', payload: 'FAQ_HOURS_POOL' },
        ])
      );

      jest.clearAllMocks();

      // Step 3: User selects Pool hours
      await faqHandler.handlePayload(userId, 'FAQ_HOURS_POOL');

      // Should receive the answer
      expect(facebookService.sendTextMessage).toHaveBeenCalledWith(
        userId,
        'The pool is open from 8:00 AM to 10:00 PM, Tuesday to Sunday. It is closed on Mondays for cleaning.'
      );

      // Should receive follow-up options
      expect(facebookService.sendQuickReply).toHaveBeenCalledWith(
        userId,
        'Is there anything else I can help you with?',
        expect.arrayContaining([
          { title: '↩️ Back', payload: 'FAQ_HOURS' },
          { title: '❓ Another Question', payload: 'FAQ_MAIN' },
        ])
      );

      jest.clearAllMocks();

      // Step 4: User goes back to Hours menu
      await faqHandler.handlePayload(userId, 'FAQ_HOURS');

      expect(facebookService.sendQuickReply).toHaveBeenCalledWith(
        userId,
        expect.stringContaining('Hours of Operation'),
        expect.any(Array)
      );

      jest.clearAllMocks();

      // Step 5: User returns to main FAQ menu
      await faqHandler.handlePayload(userId, 'FAQ_MAIN');

      expect(facebookService.sendQuickReply).toHaveBeenCalledWith(
        userId,
        'What information are you looking for? Please select a category:',
        expect.any(Array)
      );
    });

    it('should handle multiple FAQ queries in sequence', async () => {
      const userId = 'test_user_123';

      // Query 1: Check pool hours
      await faqHandler.handlePayload(userId, 'FAQ_HOURS_POOL');
      expect(facebookService.sendTextMessage).toHaveBeenCalledWith(
        userId,
        expect.stringContaining('pool')
      );

      jest.clearAllMocks();

      // Query 2: Check pet policy
      await faqHandler.handlePayload(userId, 'FAQ_POLICIES_PETS');
      expect(facebookService.sendTextMessage).toHaveBeenCalledWith(
        userId,
        expect.stringContaining('Pets are welcome')
      );

      jest.clearAllMocks();

      // Query 3: Check trash collection
      await faqHandler.handlePayload(userId, 'FAQ_WASTE_TRASH');
      expect(facebookService.sendTextMessage).toHaveBeenCalledWith(
        userId,
        expect.stringContaining('Trash is collected')
      );
    });
  });

  describe('Navigation Path Validation', () => {
    it('should correctly navigate through all main categories', async () => {
      const userId = 'test_user_123';
      const categories = ['FAQ_HOURS', 'FAQ_POLICIES', 'FAQ_WASTE', 'FAQ_ACCESS'];

      for (const category of categories) {
        jest.clearAllMocks();
        await faqHandler.handlePayload(userId, category);
        
        expect(facebookService.sendQuickReply).toHaveBeenCalled();
        const call = (facebookService.sendQuickReply as jest.Mock).mock.calls[0];
        expect(call[2]).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ title: expect.stringContaining('Back to FAQ') }),
            expect.objectContaining({ title: expect.stringContaining('Main Menu') }),
          ])
        );
      }
    });

    it('should handle invalid payloads gracefully', async () => {
      const userId = 'test_user_123';

      // Invalid payload should fallback to main menu
      await faqHandler.handlePayload(userId, 'INVALID_PAYLOAD_123');

      expect(facebookService.sendQuickReply).toHaveBeenCalledWith(
        userId,
        'What information are you looking for? Please select a category:',
        expect.any(Array)
      );
    });
  });

  describe('User Journey Scenarios', () => {
    it('should handle new resident onboarding flow', async () => {
      const userId = 'new_resident_123';

      // New resident asks about building policies
      await faqHandler.handlePayload(userId, 'FAQ_POLICIES');
      expect(facebookService.sendQuickReply).toHaveBeenCalled();

      jest.clearAllMocks();

      // Checks pet policy
      await faqHandler.handlePayload(userId, 'FAQ_POLICIES_PETS');
      expect(facebookService.sendTextMessage).toHaveBeenCalledWith(
        userId,
        expect.stringContaining('Pets are welcome')
      );

      jest.clearAllMocks();

      // Goes back to check noise policy
      await faqHandler.handlePayload(userId, 'FAQ_POLICIES');
      await faqHandler.handlePayload(userId, 'FAQ_POLICIES_NOISE');
      expect(facebookService.sendTextMessage).toHaveBeenCalledWith(
        userId,
        expect.stringContaining('Quiet hours')
      );

      jest.clearAllMocks();

      // Checks parking policy
      await faqHandler.handlePayload(userId, 'FAQ_POLICIES_PARKING');
      expect(facebookService.sendTextMessage).toHaveBeenCalledWith(
        userId,
        expect.stringContaining('parking')
      );
    });

    it('should handle emergency access inquiry flow', async () => {
      const userId = 'emergency_user_123';

      // User needs emergency access info
      await faqHandler.handlePayload(userId, 'FAQ_ACCESS');
      expect(facebookService.sendQuickReply).toHaveBeenCalledWith(
        userId,
        expect.stringContaining('Access & Keys'),
        expect.arrayContaining([
          { title: '🚨 Emergency Access', payload: 'FAQ_ACCESS_EMERGENCY' },
        ])
      );

      jest.clearAllMocks();

      // User selects emergency access
      await faqHandler.handlePayload(userId, 'FAQ_ACCESS_EMERGENCY');
      expect(facebookService.sendTextMessage).toHaveBeenCalledWith(
        userId,
        expect.stringContaining('24/7 emergency line')
      );

      // Should offer talk to manager option for emergencies
      expect(facebookService.sendQuickReply).toHaveBeenCalledWith(
        userId,
        'Is there anything else I can help you with?',
        expect.arrayContaining([
          { title: '💬 Talk to Manager', payload: 'HANDOFF_REQUEST' },
        ])
      );
    });

    it('should handle facility hours inquiry flow', async () => {
      const userId = 'facility_user_123';

      // User wants to check all facility hours
      const facilities = [
        { payload: 'FAQ_HOURS_POOL', name: 'pool' },
        { payload: 'FAQ_HOURS_GYM', name: 'gym' },
        { payload: 'FAQ_HOURS_OFFICE', name: 'office' },
      ];

      for (const facility of facilities) {
        jest.clearAllMocks();
        await faqHandler.handlePayload(userId, facility.payload);
        
        expect(facebookService.sendTextMessage).toHaveBeenCalledWith(
          userId,
          expect.stringMatching(new RegExp(facility.name, 'i'))
        );
      }
    });
  });

  describe('Error Recovery', () => {
    it('should recover from service errors', async () => {
      const userId = 'error_user_123';

      // Simulate service error
      (facebookService.sendTextMessage as jest.Mock).mockRejectedValueOnce(
        new Error('Network error')
      );

      // Should not throw error
      await expect(
        faqHandler.handlePayload(userId, 'FAQ_HOURS_POOL')
      ).resolves.not.toThrow();
    });

    it('should handle rapid sequential requests', async () => {
      const userId = 'rapid_user_123';

      // Simulate rapid button clicks
      const promises = [
        faqHandler.handlePayload(userId, 'FAQ_MAIN'),
        faqHandler.handlePayload(userId, 'FAQ_HOURS'),
        faqHandler.handlePayload(userId, 'FAQ_POLICIES'),
      ];

      await Promise.all(promises);

      // All requests should be handled
      expect(facebookService.sendQuickReply).toHaveBeenCalledTimes(3);
    });
  });

  describe('Context Switching', () => {
    it('should allow smooth context switching between topics', async () => {
      const userId = 'context_user_123';

      // Start with hours inquiry
      await faqHandler.handlePayload(userId, 'FAQ_HOURS_POOL');
      expect(facebookService.sendTextMessage).toHaveBeenCalled();

      jest.clearAllMocks();

      // Switch to waste management without going back
      await faqHandler.handlePayload(userId, 'FAQ_WASTE_RECYCLING');
      expect(facebookService.sendTextMessage).toHaveBeenCalledWith(
        userId,
        expect.stringContaining('Recycling')
      );

      jest.clearAllMocks();

      // Switch to access info
      await faqHandler.handlePayload(userId, 'FAQ_ACCESS_LOST');
      expect(facebookService.sendTextMessage).toHaveBeenCalledWith(
        userId,
        expect.stringContaining('Lost keys')
      );
    });
  });
});
