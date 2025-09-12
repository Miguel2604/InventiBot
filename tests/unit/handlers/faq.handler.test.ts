import { FAQHandler } from '../../../src/handlers/faq.handler';
import { facebookService } from '../../../src/services/facebook.service';
import { supabase } from '../../../src/config/supabase';
import { 
  mockFacebookService, 
  mockSupabase, 
  setupSupabaseMock,
  resetAllMocks, 
  testData 
} from '../../mocks';

// Mock dependencies
jest.mock('../../../src/services/facebook.service', () => ({
  facebookService: mockFacebookService
}));

jest.mock('../../../src/config/supabase', () => ({
  supabase: mockSupabase
}));

describe('FAQHandler', () => {
  let faqHandler: FAQHandler;

  beforeEach(() => {
    resetAllMocks();
    faqHandler = new FAQHandler();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('handleMainMenu', () => {
    it('should display main FAQ categories', async () => {
      await faqHandler.handleMainMenu('user123');

      expect(mockFacebookService.sendQuickReply).toHaveBeenCalledWith(
        'user123',
        'What information are you looking for? Please select a category:',
        expect.arrayContaining([
          expect.objectContaining({
            title: expect.stringContaining('Hours of Operation'),
            payload: 'FAQ_HOURS'
          }),
          expect.objectContaining({
            title: expect.stringContaining('Policies'),
            payload: 'FAQ_POLICIES'
          }),
          expect.objectContaining({
            title: expect.stringContaining('Waste & Recycling'),
            payload: 'FAQ_WASTE'
          }),
          expect.objectContaining({
            title: expect.stringContaining('Access & Keys'),
            payload: 'FAQ_ACCESS'
          }),
          expect.objectContaining({
            title: expect.stringContaining('Back to Main'),
            payload: 'MAIN_MENU'
          })
        ])
      );
    });

    it('should include all FAQ categories', async () => {
      await faqHandler.handleMainMenu('user123');

      const call = mockFacebookService.sendQuickReply.mock.calls[0];
      const quickReplies = call[2];

      // Should have 4 FAQ categories + 1 back button
      expect(quickReplies).toHaveLength(5);
    });
  });

  describe('handleCategorySelection', () => {
    it('should display subcategories for Hours category', async () => {
      await faqHandler.handleCategorySelection('user123', 'FAQ_HOURS');

      expect(mockFacebookService.sendQuickReply).toHaveBeenCalledWith(
        'user123',
        expect.stringContaining('Hours of Operation'),
        expect.arrayContaining([
          expect.objectContaining({
            title: expect.stringContaining('Pool'),
            payload: 'FAQ_HOURS_POOL'
          }),
          expect.objectContaining({
            title: expect.stringContaining('Gym'),
            payload: 'FAQ_HOURS_GYM'
          }),
          expect.objectContaining({
            title: expect.stringContaining('Office'),
            payload: 'FAQ_HOURS_OFFICE'
          })
        ])
      );
    });

    it('should display subcategories for Policies category', async () => {
      await faqHandler.handleCategorySelection('user123', 'FAQ_POLICIES');

      expect(mockFacebookService.sendQuickReply).toHaveBeenCalledWith(
        'user123',
        expect.stringContaining('Policies'),
        expect.arrayContaining([
          expect.objectContaining({
            title: expect.stringContaining('Pets'),
            payload: 'FAQ_POLICIES_PETS'
          }),
          expect.objectContaining({
            title: expect.stringContaining('Noise'),
            payload: 'FAQ_POLICIES_NOISE'
          }),
          expect.objectContaining({
            title: expect.stringContaining('Parking'),
            payload: 'FAQ_POLICIES_PARKING'
          })
        ])
      );
    });

    it('should include navigation buttons', async () => {
      await faqHandler.handleCategorySelection('user123', 'FAQ_HOURS');

      expect(mockFacebookService.sendQuickReply).toHaveBeenCalledWith(
        'user123',
        expect.any(String),
        expect.arrayContaining([
          expect.objectContaining({
            title: expect.stringContaining('Back to FAQ'),
            payload: 'FAQ_MAIN'
          }),
          expect.objectContaining({
            title: expect.stringContaining('Main Menu'),
            payload: 'MAIN_MENU'
          })
        ])
      );
    });

    it('should handle invalid category by returning to main menu', async () => {
      await faqHandler.handleCategorySelection('user123', 'INVALID_CATEGORY');

      // Should call handleMainMenu which displays the main FAQ menu
      expect(mockFacebookService.sendQuickReply).toHaveBeenCalledWith(
        'user123',
        'What information are you looking for? Please select a category:',
        expect.any(Array)
      );
    });
  });

  describe('handleSubcategorySelection', () => {
    it('should send answer for Pool hours', async () => {
      await faqHandler.handleSubcategorySelection('user123', 'FAQ_HOURS_POOL');

      expect(mockFacebookService.sendTextMessage).toHaveBeenCalledWith(
        'user123',
        expect.stringContaining('pool is open from 8:00 AM to 10:00 PM')
      );

      // Should also send follow-up options
      expect(mockFacebookService.sendQuickReply).toHaveBeenCalled();
    });

    it('should send answer for Pet policy', async () => {
      await faqHandler.handleSubcategorySelection('user123', 'FAQ_POLICIES_PETS');

      expect(mockFacebookService.sendTextMessage).toHaveBeenCalledWith(
        'user123',
        expect.stringContaining('Pets are welcome')
      );
    });

    it('should send answer for Trash collection', async () => {
      await faqHandler.handleSubcategorySelection('user123', 'FAQ_WASTE_TRASH');

      expect(mockFacebookService.sendTextMessage).toHaveBeenCalledWith(
        'user123',
        expect.stringContaining('Trash is collected Monday, Wednesday, and Friday')
      );
    });

    it('should send answer for Lost key', async () => {
      await faqHandler.handleSubcategorySelection('user123', 'FAQ_ACCESS_LOST');

      expect(mockFacebookService.sendTextMessage).toHaveBeenCalledWith(
        'user123',
        expect.stringContaining('Lost keys or fobs can be replaced')
      );
    });

    it('should handle invalid subcategory by returning to main menu', async () => {
      await faqHandler.handleSubcategorySelection('user123', 'INVALID_SUBCATEGORY');

      // Should call handleMainMenu
      expect(mockFacebookService.sendQuickReply).toHaveBeenCalledWith(
        'user123',
        'What information are you looking for? Please select a category:',
        expect.any(Array)
      );
    });
  });

  describe('sendAnswer', () => {
    it('should send answer with follow-up quick replies', async () => {
      await faqHandler.sendAnswer('user123', 'This is the answer');

      expect(mockFacebookService.sendTextMessage).toHaveBeenCalledWith(
        'user123',
        'This is the answer'
      );

      expect(mockFacebookService.sendQuickReply).toHaveBeenCalledWith(
        'user123',
        'Is there anything else I can help you with?',
        expect.arrayContaining([
          expect.objectContaining({
            title: expect.stringContaining('Another Question'),
            payload: 'FAQ_MAIN'
          }),
          expect.objectContaining({
            title: expect.stringContaining('Back'),
            payload: expect.any(String)
          }),
          expect.objectContaining({
            title: expect.stringContaining('Talk to Manager'),
            payload: 'TALK_TO_MANAGER'
          }),
          expect.objectContaining({
            title: expect.stringContaining('Main Menu'),
            payload: 'MAIN_MENU'
          })
        ])
      );
    });

    it('should include parent category in back navigation', async () => {
      await faqHandler.sendAnswer('user123', 'Answer text', 'FAQ_HOURS');

      expect(mockFacebookService.sendQuickReply).toHaveBeenCalledWith(
        'user123',
        'Is there anything else I can help you with?',
        expect.arrayContaining([
          expect.objectContaining({
            title: expect.stringContaining('Back'),
            payload: 'FAQ_HOURS'
          })
        ])
      );
    });
  });

  describe('handleFAQFromDatabase', () => {
    it('should fetch and display FAQs from database', async () => {
      const mockFAQs = [
        { ...testData.faq, id: '1', question: 'Question 1', answer: 'Answer 1' },
        { ...testData.faq, id: '2', question: 'Question 2', answer: 'Answer 2' }
      ];

      setupSupabaseMock(mockFAQs);

      await faqHandler.handleFAQFromDatabase('user123', 'building123', 'policies');

      expect(mockSupabase.from).toHaveBeenCalledWith('faqs');
      expect(mockSupabase.select).toHaveBeenCalledWith('*');
      expect(mockSupabase.eq).toHaveBeenCalledWith('building_id', 'building123');
      expect(mockSupabase.eq).toHaveBeenCalledWith('category', 'policies');
      expect(mockSupabase.eq).toHaveBeenCalledWith('is_published', true);
    });

    it('should handle empty FAQ results', async () => {
      setupSupabaseMock([]);

      await faqHandler.handleFAQFromDatabase('user123', 'building123', 'policies');

      expect(mockFacebookService.sendTextMessage).toHaveBeenCalledWith(
        'user123',
        expect.stringContaining('No FAQs found')
      );
    });

    it('should handle database errors gracefully', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      setupSupabaseMock(null, true);

      await faqHandler.handleFAQFromDatabase('user123', 'building123', 'policies');

      expect(mockFacebookService.sendTextMessage).toHaveBeenCalledWith(
        'user123',
        expect.stringContaining('error occurred')
      );
      consoleErrorSpy.mockRestore();
    });
  });

  describe('searchFAQ', () => {
    it('should search FAQs by keywords', async () => {
      const mockFAQs = [
        { ...testData.faq, keywords: ['pet', 'dog'], answer: 'Pet policy answer' }
      ];

      setupSupabaseMock(mockFAQs);

      await faqHandler.searchFAQ('user123', 'building123', 'dog policy');

      expect(mockSupabase.from).toHaveBeenCalledWith('faqs');
      expect(mockFacebookService.sendTextMessage).toHaveBeenCalledWith(
        'user123',
        expect.stringContaining('Pet policy answer')
      );
    });

    it('should handle no search results', async () => {
      setupSupabaseMock([]);

      await faqHandler.searchFAQ('user123', 'building123', 'unknown topic');

      expect(mockFacebookService.sendTextMessage).toHaveBeenCalledWith(
        'user123',
        expect.stringContaining("couldn't find")
      );
    });

    it('should increment view count when FAQ is viewed', async () => {
      const mockFAQ = { ...testData.faq, id: 'faq123', views_count: 10 };
      setupSupabaseMock([mockFAQ]);

      // Mock the update for incrementing view count
      mockSupabase.from.mockReturnThis();
      mockSupabase.update.mockReturnThis();
      mockSupabase.eq.mockResolvedValueOnce({ data: null, error: null });

      await faqHandler.searchFAQ('user123', 'building123', 'pet');

      expect(mockSupabase.update).toHaveBeenCalledWith({
        views_count: 11
      });
      expect(mockSupabase.eq).toHaveBeenCalledWith('id', 'faq123');
    });
  });

  describe('handleQuickReplyNavigation', () => {
    it('should handle FAQ_MAIN payload', async () => {
      await faqHandler.handleQuickReplyNavigation('user123', 'FAQ_MAIN');

      expect(mockFacebookService.sendQuickReply).toHaveBeenCalledWith(
        'user123',
        'What information are you looking for? Please select a category:',
        expect.any(Array)
      );
    });

    it('should handle category payloads', async () => {
      await faqHandler.handleQuickReplyNavigation('user123', 'FAQ_POLICIES');

      expect(mockFacebookService.sendQuickReply).toHaveBeenCalledWith(
        'user123',
        expect.stringContaining('Policies'),
        expect.any(Array)
      );
    });

    it('should handle subcategory payloads', async () => {
      await faqHandler.handleQuickReplyNavigation('user123', 'FAQ_HOURS_GYM');

      expect(mockFacebookService.sendTextMessage).toHaveBeenCalledWith(
        'user123',
        expect.stringContaining('gym is open 24/7')
      );
    });

    it('should handle TALK_TO_MANAGER payload', async () => {
      await faqHandler.handleQuickReplyNavigation('user123', 'TALK_TO_MANAGER');

      expect(mockFacebookService.sendTextMessage).toHaveBeenCalledWith(
        'user123',
        expect.stringContaining('connecting you with a manager')
      );
    });
  });

  describe('FAQ structure validation', () => {
    it('should have correct FAQ structure', () => {
      const faqStructure = faqHandler.getFAQStructure();

      // Check main categories
      expect(faqStructure).toHaveLength(4);
      
      const categories = faqStructure.map(cat => cat.title);
      expect(categories).toContain('Hours of Operation');
      expect(categories).toContain('Policies');
      expect(categories).toContain('Waste & Recycling');
      expect(categories).toContain('Access & Keys');
    });

    it('should have correct subcategories for each category', () => {
      const faqStructure = faqHandler.getFAQStructure();
      
      const hoursCategory = faqStructure.find(cat => cat.title === 'Hours of Operation');
      expect(hoursCategory?.subcategories).toHaveLength(3);
      
      const policiesCategory = faqStructure.find(cat => cat.title === 'Policies');
      expect(policiesCategory?.subcategories).toHaveLength(3);
      
      const wasteCategory = faqStructure.find(cat => cat.title === 'Waste & Recycling');
      expect(wasteCategory?.subcategories).toHaveLength(3);
      
      const accessCategory = faqStructure.find(cat => cat.title === 'Access & Keys');
      expect(accessCategory?.subcategories).toHaveLength(3);
    });

    it('should have answers for all subcategories', () => {
      const faqStructure = faqHandler.getFAQStructure();
      
      faqStructure.forEach(category => {
        category.subcategories?.forEach(subcategory => {
          expect(subcategory.answer).toBeDefined();
          expect(subcategory.answer).not.toBe('');
        });
      });
    });

    it('should have unique payloads for all items', () => {
      const faqStructure = faqHandler.getFAQStructure();
      const payloads = new Set();
      
      faqStructure.forEach(category => {
        expect(payloads.has(category.payload)).toBe(false);
        payloads.add(category.payload);
        
        category.subcategories?.forEach(subcategory => {
          expect(payloads.has(subcategory.payload)).toBe(false);
          payloads.add(subcategory.payload);
        });
      });
    });
  });
});
