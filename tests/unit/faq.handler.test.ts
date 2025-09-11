import { FAQHandler } from '../../src/handlers/faq.handler';
import { facebookService } from '../../src/services/facebook.service';
import { supabase } from '../../src/config/supabase';

// Mock dependencies
jest.mock('../../src/services/facebook.service', () => ({
  facebookService: {
    sendTextMessage: jest.fn().mockResolvedValue(undefined),
    sendQuickReply: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../../src/config/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          eq: jest.fn(() => ({
            ilike: jest.fn(() => ({
              order: jest.fn(() => ({
                data: [],
                error: null,
              })),
            })),
          })),
        })),
      })),
    })),
  },
}));

describe('FAQ Handler Tests', () => {
  let faqHandler: FAQHandler;

  beforeEach(() => {
    jest.clearAllMocks();
    faqHandler = new FAQHandler();
  });

  describe('handleMainMenu', () => {
    it('should display main FAQ categories', async () => {
      const senderId = 'test_user_123';

      await faqHandler.handleMainMenu(senderId);

      expect(facebookService.sendQuickReply).toHaveBeenCalledWith(
        senderId,
        'What information are you looking for? Please select a category:',
        expect.arrayContaining([
          { title: '🕒 Hours of Operation', payload: 'FAQ_HOURS' },
          { title: '📜 Policies', payload: 'FAQ_POLICIES' },
          { title: '🗑️ Waste & Recycling', payload: 'FAQ_WASTE' },
          { title: '🔑 Access & Keys', payload: 'FAQ_ACCESS' },
          { title: '🏠 Back to Main', payload: 'MAIN_MENU' },
        ])
      );
    });
  });

  describe('handlePayload', () => {
    it('should handle FAQ_MAIN payload', async () => {
      const senderId = 'test_user_123';
      const handleMainMenuSpy = jest.spyOn(faqHandler, 'handleMainMenu');

      await faqHandler.handlePayload(senderId, 'FAQ_MAIN');

      expect(handleMainMenuSpy).toHaveBeenCalledWith(senderId);
    });

    it('should handle category selection (FAQ_HOURS)', async () => {
      const senderId = 'test_user_123';

      await faqHandler.handlePayload(senderId, 'FAQ_HOURS');

      expect(facebookService.sendQuickReply).toHaveBeenCalledWith(
        senderId,
        '🕒 Hours of Operation - Select an option:',
        expect.arrayContaining([
          { title: '🏊 Pool', payload: 'FAQ_HOURS_POOL' },
          { title: '🏋️ Gym', payload: 'FAQ_HOURS_GYM' },
          { title: '🏢 Office', payload: 'FAQ_HOURS_OFFICE' },
          { title: '↩️ Back to FAQ', payload: 'FAQ_MAIN' },
          { title: '🏠 Main Menu', payload: 'MAIN_MENU' },
        ])
      );
    });

    it('should handle subcategory selection (FAQ_HOURS_POOL)', async () => {
      const senderId = 'test_user_123';

      await faqHandler.handlePayload(senderId, 'FAQ_HOURS_POOL');

      // Should send the answer
      expect(facebookService.sendTextMessage).toHaveBeenCalledWith(
        senderId,
        'The pool is open from 8:00 AM to 10:00 PM, Tuesday to Sunday. It is closed on Mondays for cleaning.'
      );

      // Should send follow-up options
      expect(facebookService.sendQuickReply).toHaveBeenCalledWith(
        senderId,
        'Is there anything else I can help you with?',
        expect.arrayContaining([
          { title: '↩️ Back', payload: 'FAQ_HOURS' },
          { title: '❓ Another Question', payload: 'FAQ_MAIN' },
          { title: '💬 Talk to Manager', payload: 'HANDOFF_REQUEST' },
          { title: '🏠 Main Menu', payload: 'MAIN_MENU' },
        ])
      );
    });

    it('should handle policy questions (FAQ_POLICIES_PETS)', async () => {
      const senderId = 'test_user_123';

      await faqHandler.handlePayload(senderId, 'FAQ_POLICIES_PETS');

      expect(facebookService.sendTextMessage).toHaveBeenCalledWith(
        senderId,
        'Pets are welcome! Maximum 2 pets per unit. Dogs must be under 50 lbs. All pets must be registered with the office.'
      );
    });

    it('should handle waste and recycling questions', async () => {
      const senderId = 'test_user_123';

      await faqHandler.handlePayload(senderId, 'FAQ_WASTE');

      expect(facebookService.sendQuickReply).toHaveBeenCalledWith(
        senderId,
        '🗑️ Waste & Recycling - Select an option:',
        expect.arrayContaining([
          { title: '🗑️ Trash Collection', payload: 'FAQ_WASTE_TRASH' },
          { title: '♻️ Recycling', payload: 'FAQ_WASTE_RECYCLING' },
          { title: '📦 Bulk Items', payload: 'FAQ_WASTE_BULK' },
        ])
      );
    });

    it('should handle access and keys questions', async () => {
      const senderId = 'test_user_123';

      await faqHandler.handlePayload(senderId, 'FAQ_ACCESS_EMERGENCY');

      expect(facebookService.sendTextMessage).toHaveBeenCalledWith(
        senderId,
        'For emergency lockouts after hours, call our 24/7 emergency line at (555) 123-4567. A fee may apply for after-hours service.'
      );
    });

    it('should handle unknown payload by showing main menu', async () => {
      const senderId = 'test_user_123';
      const handleMainMenuSpy = jest.spyOn(faqHandler, 'handleMainMenu');

      await faqHandler.handlePayload(senderId, 'UNKNOWN_PAYLOAD');

      expect(handleMainMenuSpy).toHaveBeenCalledWith(senderId);
    });
  });

  describe('searchFAQs', () => {
    it('should search FAQs from database', async () => {
      const mockData = [
        {
          id: '1',
          building_id: 'building_123',
          category: 'Hours',
          question: 'What are pool hours?',
          answer: 'Pool is open 8am-10pm',
          is_active: true,
        },
      ];

      const fromMock = jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn(() => ({
              ilike: jest.fn(() => ({
                order: jest.fn().mockResolvedValue({
                  data: mockData,
                  error: null,
                }),
              })),
            })),
          })),
        })),
      }));

      (supabase.from as jest.Mock) = fromMock;

      const results = await faqHandler.searchFAQs('building_123', 'pool');

      expect(fromMock).toHaveBeenCalledWith('faqs');
      expect(results).toEqual(mockData);
    });

    it('should handle database errors gracefully', async () => {
      const fromMock = jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn(() => ({
              ilike: jest.fn(() => ({
                order: jest.fn().mockResolvedValue({
                  data: null,
                  error: new Error('Database error'),
                }),
              })),
            })),
          })),
        })),
      }));

      (supabase.from as jest.Mock) = fromMock;

      const results = await faqHandler.searchFAQs('building_123', 'pool');

      expect(results).toEqual([]);
    });
  });

  describe('FAQ Category Navigation', () => {
    it('should navigate through all FAQ categories correctly', async () => {
      const senderId = 'test_user_123';

      // Test Hours category
      await faqHandler.handlePayload(senderId, 'FAQ_HOURS');
      expect(facebookService.sendQuickReply).toHaveBeenCalledWith(
        senderId,
        expect.stringContaining('Hours of Operation'),
        expect.any(Array)
      );

      jest.clearAllMocks();

      // Test Policies category
      await faqHandler.handlePayload(senderId, 'FAQ_POLICIES');
      expect(facebookService.sendQuickReply).toHaveBeenCalledWith(
        senderId,
        expect.stringContaining('Policies'),
        expect.any(Array)
      );

      jest.clearAllMocks();

      // Test Waste category
      await faqHandler.handlePayload(senderId, 'FAQ_WASTE');
      expect(facebookService.sendQuickReply).toHaveBeenCalledWith(
        senderId,
        expect.stringContaining('Waste & Recycling'),
        expect.any(Array)
      );

      jest.clearAllMocks();

      // Test Access category
      await faqHandler.handlePayload(senderId, 'FAQ_ACCESS');
      expect(facebookService.sendQuickReply).toHaveBeenCalledWith(
        senderId,
        expect.stringContaining('Access & Keys'),
        expect.any(Array)
      );
    });

    it('should provide correct back navigation from subcategories', async () => {
      const senderId = 'test_user_123';

      // Navigate to a subcategory answer
      await faqHandler.handlePayload(senderId, 'FAQ_POLICIES_NOISE');

      // Check that back button goes to parent category
      expect(facebookService.sendQuickReply).toHaveBeenCalledWith(
        senderId,
        'Is there anything else I can help you with?',
        expect.arrayContaining([
          { title: '↩️ Back', payload: 'FAQ_POLICIES' },
        ])
      );
    });
  });
});
