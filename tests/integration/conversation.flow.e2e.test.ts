import { 
  mockFacebookService, 
  mockAuthService,
  mockSupabase,
  setupSupabaseMock,
  resetAllMocks,
  testData 
} from '../mocks';

// Create conversation tester utility
class ConversationTester {
  private messageSequence: any[] = [];
  
  constructor() {
    this.reset();
  }

  reset() {
    resetAllMocks();
    this.messageSequence = [];
  }

  async sendMessage(senderId: string, text: string | any) {
    this.messageSequence.push({ type: 'message', senderId, text });
    // Simulate message handling
    return this.processMessage(senderId, text);
  }

  async sendQuickReply(senderId: string, payload: string) {
    this.messageSequence.push({ type: 'quick_reply', senderId, payload });
    // Simulate quick reply handling
    return this.processQuickReply(senderId, payload);
  }

  async sendPostback(senderId: string, payload: string) {
    this.messageSequence.push({ type: 'postback', senderId, payload });
    // Simulate postback handling
    return this.processPostback(senderId, payload);
  }

  private async processMessage(_senderId: string, _text: string | any) {
    // Simulate webhook processing
    const authStatus = await mockAuthService.isAuthenticated(_senderId);
    if (!authStatus || !authStatus.authenticated) {
      return { response: 'Please enter your access code' };
    }
    return { response: 'Message received' };
  }

  private async processQuickReply(_senderId: string, payload: string) {
    // Simulate quick reply processing
    return { response: `Processing ${payload}` };
  }

  private async processPostback(_senderId: string, payload: string) {
    // Simulate postback processing
    return { response: `Processing ${payload}` };
  }

  getMessageHistory() {
    return this.messageSequence;
  }
}

describe('End-to-End Conversation Flows', () => {
  let tester: ConversationTester;

  beforeEach(() => {
    tester = new ConversationTester();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('New User Onboarding Flow', () => {
    it('should complete full onboarding process', async () => {
      const userId = 'new_user_123';
      
      // Step 1: User sends first message
      mockAuthService.isAuthenticated.mockResolvedValueOnce({
        authenticated: false
      });
      
      await tester.sendMessage(userId, 'Hello');
      
      expect(mockFacebookService.sendTextMessage).toHaveBeenCalledWith(
        userId,
        expect.stringContaining('Welcome to InventiBot')
      );
      expect(mockFacebookService.sendTextMessage).toHaveBeenCalledWith(
        userId,
        expect.stringContaining('access code')
      );

      // Step 2: User enters invalid code
      mockAuthService.validateAccessCode.mockResolvedValueOnce({
        success: false,
        message: 'Invalid code'
      });
      
      await tester.sendMessage(userId, 'WRONG123');
      
      expect(mockAuthService.validateAccessCode).toHaveBeenCalledWith('WRONG123', userId);
      expect(mockFacebookService.sendTextMessage).toHaveBeenCalledWith(
        userId,
        expect.stringContaining('Invalid')
      );

      // Step 3: User enters valid code
      mockAuthService.validateAccessCode.mockResolvedValueOnce({
        success: true,
        message: 'Welcome!',
        profile: testData.userProfile,
        unit: testData.unit,
        building: testData.building
      });
      
      await tester.sendMessage(userId, 'TEST123');
      
      expect(mockAuthService.validateAccessCode).toHaveBeenCalledWith('TEST123', userId);
      expect(mockFacebookService.sendTextMessage).toHaveBeenCalledWith(
        userId,
        expect.stringContaining('Welcome')
      );
      expect(mockFacebookService.sendQuickReply).toHaveBeenCalledWith(
        userId,
        expect.any(String),
        expect.arrayContaining([
          expect.objectContaining({ payload: 'FAQ_MAIN' }),
          expect.objectContaining({ payload: 'MAINTENANCE_REQUEST' }),
          expect.objectContaining({ payload: 'BOOK_AMENITY' })
        ])
      );

      // Verify session was created
      expect(mockAuthService.createSession).toHaveBeenCalled();
    });

    it('should handle expired invite code', async () => {
      const userId = 'new_user_456';
      
      mockAuthService.isAuthenticated.mockResolvedValueOnce({
        authenticated: false
      });
      
      await tester.sendMessage(userId, 'Hi');
      
      // User enters expired code
      mockAuthService.validateAccessCode.mockResolvedValueOnce({
        success: false,
        message: 'This access code has expired'
      });
      
      await tester.sendMessage(userId, 'EXPIRED123');
      
      expect(mockFacebookService.sendTextMessage).toHaveBeenCalledWith(
        userId,
        expect.stringContaining('expired')
      );
    });
  });

  describe('FAQ Navigation Flow', () => {
    const authenticatedUser = 'auth_user_123';
    
    beforeEach(() => {
      mockAuthService.isAuthenticated.mockResolvedValue({
        authenticated: true,
        profile: testData.userProfile
      });
      mockAuthService.getSession.mockResolvedValue({
        userId: testData.userProfile.id,
        buildingId: testData.building.id,
        unitId: testData.unit.id
      });
    });

    it('should navigate through FAQ categories to answer', async () => {
      // Step 1: Open FAQ menu
      await tester.sendQuickReply(authenticatedUser, 'FAQ_MAIN');
      
      expect(mockFacebookService.sendQuickReply).toHaveBeenCalledWith(
        authenticatedUser,
        expect.stringContaining('What information'),
        expect.arrayContaining([
          expect.objectContaining({ payload: 'FAQ_HOURS' }),
          expect.objectContaining({ payload: 'FAQ_POLICIES' }),
          expect.objectContaining({ payload: 'FAQ_WASTE' }),
          expect.objectContaining({ payload: 'FAQ_ACCESS' })
        ])
      );

      // Step 2: Select Hours category
      await tester.sendQuickReply(authenticatedUser, 'FAQ_HOURS');
      
      expect(mockFacebookService.sendQuickReply).toHaveBeenCalledWith(
        authenticatedUser,
        expect.stringContaining('Hours'),
        expect.arrayContaining([
          expect.objectContaining({ payload: 'FAQ_HOURS_POOL' }),
          expect.objectContaining({ payload: 'FAQ_HOURS_GYM' }),
          expect.objectContaining({ payload: 'FAQ_HOURS_OFFICE' })
        ])
      );

      // Step 3: Select Pool hours
      await tester.sendQuickReply(authenticatedUser, 'FAQ_HOURS_POOL');
      
      expect(mockFacebookService.sendTextMessage).toHaveBeenCalledWith(
        authenticatedUser,
        expect.stringContaining('pool is open from 8:00 AM to 10:00 PM')
      );
      
      // Should offer follow-up options
      expect(mockFacebookService.sendQuickReply).toHaveBeenCalledWith(
        authenticatedUser,
        expect.stringContaining('anything else'),
        expect.arrayContaining([
          expect.objectContaining({ payload: 'FAQ_MAIN' }),
          expect.objectContaining({ payload: 'FAQ_HOURS' }),
          expect.objectContaining({ payload: 'MAIN_MENU' })
        ])
      );

      // Step 4: Go back to FAQ main
      await tester.sendQuickReply(authenticatedUser, 'FAQ_MAIN');
      
      expect(mockFacebookService.sendQuickReply).toHaveBeenCalledWith(
        authenticatedUser,
        expect.stringContaining('What information'),
        expect.any(Array)
      );
    });

    it('should search FAQs from database', async () => {
      const mockFAQs = [
        { ...testData.faq, question: 'Pet policy?', answer: 'Pets are allowed' }
      ];
      
      setupSupabaseMock(mockFAQs);
      
      await tester.sendMessage(authenticatedUser, 'What is the pet policy?');
      
      expect(mockSupabase.from).toHaveBeenCalledWith('faqs');
      expect(mockFacebookService.sendTextMessage).toHaveBeenCalledWith(
        authenticatedUser,
        expect.stringContaining('Pets are allowed')
      );
    });
  });

  describe('Maintenance Request Flow', () => {
    const authenticatedUser = 'auth_user_789';
    
    beforeEach(() => {
      mockAuthService.isAuthenticated.mockResolvedValue({
        authenticated: true,
        profile: testData.userProfile
      });
      mockAuthService.getSession.mockResolvedValue({
        userId: testData.userProfile.id,
        buildingId: testData.building.id,
        unitId: testData.unit.id
      });
    });

    it('should create maintenance request', async () => {
      // Step 1: Start maintenance request
      await tester.sendQuickReply(authenticatedUser, 'MAINTENANCE_REQUEST');
      
      // Mock categories
      const categories = [
        { id: 'cat1', name: 'Plumbing', emoji: '🚿' },
        { id: 'cat2', name: 'Electrical', emoji: '⚡' },
        { id: 'cat3', name: 'HVAC', emoji: '❄️' }
      ];
      
      setupSupabaseMock(categories);
      
      expect(mockFacebookService.sendQuickReply).toHaveBeenCalledWith(
        authenticatedUser,
        expect.stringContaining('category'),
        expect.arrayContaining([
          expect.objectContaining({ payload: 'MAINT_CAT_cat1' }),
          expect.objectContaining({ payload: 'MAINT_CAT_cat2' }),
          expect.objectContaining({ payload: 'MAINT_CAT_cat3' })
        ])
      );

      // Step 2: Select category
      await tester.sendQuickReply(authenticatedUser, 'MAINT_CAT_cat1');
      
      expect(mockFacebookService.sendTextMessage).toHaveBeenCalledWith(
        authenticatedUser,
        expect.stringContaining('describe the issue')
      );

      // Step 3: Describe issue
      await tester.sendMessage(authenticatedUser, 'Kitchen sink is leaking');
      
      expect(mockFacebookService.sendQuickReply).toHaveBeenCalledWith(
        authenticatedUser,
        expect.stringContaining('urgency'),
        expect.arrayContaining([
          expect.objectContaining({ payload: 'URGENCY_low' }),
          expect.objectContaining({ payload: 'URGENCY_medium' }),
          expect.objectContaining({ payload: 'URGENCY_high' }),
          expect.objectContaining({ payload: 'URGENCY_emergency' })
        ])
      );

      // Step 4: Select urgency
      await tester.sendQuickReply(authenticatedUser, 'URGENCY_medium');
      
      expect(mockFacebookService.sendTextMessage).toHaveBeenCalledWith(
        authenticatedUser,
        expect.stringContaining('upload photos')
      );

      // Step 5: Skip photos
      await tester.sendQuickReply(authenticatedUser, 'SKIP_PHOTOS');
      
      // Mock request creation
      setupSupabaseMock({
        ...testData.maintenanceRequest,
        id: 'new_request_123'
      });
      
      expect(mockSupabase.from).toHaveBeenCalledWith('maintenance_requests');
      expect(mockSupabase.insert).toHaveBeenCalled();
      
      expect(mockFacebookService.sendTextMessage).toHaveBeenCalledWith(
        authenticatedUser,
        expect.stringContaining('Request #')
      );
    });

    it('should handle photo upload in maintenance request', async () => {
      // Start maintenance flow
      await tester.sendQuickReply(authenticatedUser, 'MAINTENANCE_REQUEST');
      
      // ... go through category and description ...
      
      // Send attachment
      const attachmentMessage = {
        attachments: [{
          type: 'image',
          payload: { url: 'https://example.com/leak.jpg' }
        }]
      };
      
      // Mock storage upload
      mockSupabase.storage.from.mockReturnThis();
      mockSupabase.storage.upload.mockResolvedValueOnce({
        data: { path: 'maintenance/leak.jpg' },
        error: null
      });
      
      await tester.sendMessage(authenticatedUser, attachmentMessage);
      
      expect(mockSupabase.storage.upload).toHaveBeenCalled();
      expect(mockFacebookService.sendTextMessage).toHaveBeenCalledWith(
        authenticatedUser,
        expect.stringContaining('received')
      );
    });
  });

  describe('Amenity Booking Flow', () => {
    const authenticatedUser = 'booking_user_123';
    
    beforeEach(() => {
      mockAuthService.isAuthenticated.mockResolvedValue({
        authenticated: true,
        profile: testData.userProfile
      });
      mockAuthService.getSession.mockResolvedValue({
        userId: testData.userProfile.id,
        buildingId: testData.building.id,
        unitId: testData.unit.id
      });
    });

    it('should complete amenity booking', async () => {
      // Step 1: Start booking
      await tester.sendQuickReply(authenticatedUser, 'BOOK_AMENITY');
      
      // Mock amenities
      const amenities = [
        { ...testData.amenity, id: 'pool', name: 'Swimming Pool' },
        { ...testData.amenity, id: 'gym', name: 'Fitness Center' }
      ];
      
      setupSupabaseMock(amenities);
      
      expect(mockFacebookService.sendGenericTemplate).toHaveBeenCalledWith(
        authenticatedUser,
        expect.arrayContaining([
          expect.objectContaining({
            title: 'Swimming Pool',
            buttons: expect.arrayContaining([
              expect.objectContaining({ payload: 'BOOK_AMENITY_pool' })
            ])
          })
        ])
      );

      // Step 2: Select amenity
      await tester.sendQuickReply(authenticatedUser, 'BOOK_AMENITY_pool');
      
      // Should show date selection
      expect(mockFacebookService.sendQuickReply).toHaveBeenCalledWith(
        authenticatedUser,
        expect.stringContaining('date'),
        expect.any(Array)
      );

      // Step 3: Select date
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const datePayload = `DATE_${tomorrow.toISOString().split('T')[0]}`;
      
      await tester.sendQuickReply(authenticatedUser, datePayload);
      
      // Mock available time slots
      mockSupabase.rpc.mockResolvedValueOnce({
        data: false, // No conflict
        error: null
      });
      
      expect(mockFacebookService.sendQuickReply).toHaveBeenCalledWith(
        authenticatedUser,
        expect.stringContaining('time'),
        expect.any(Array)
      );

      // Step 4: Select time
      await tester.sendQuickReply(authenticatedUser, 'TIME_10:00');
      
      // Mock booking creation
      setupSupabaseMock({
        ...testData.booking,
        id: 'new_booking_123'
      });
      
      expect(mockSupabase.from).toHaveBeenCalledWith('bookings');
      expect(mockSupabase.insert).toHaveBeenCalled();
      
      expect(mockFacebookService.sendTextMessage).toHaveBeenCalledWith(
        authenticatedUser,
        expect.stringContaining('confirmed')
      );
    });

    it('should handle booking conflicts', async () => {
      // Setup conflict scenario
      mockSupabase.rpc.mockResolvedValueOnce({
        data: true, // Has conflict
        error: null
      });
      
      await tester.sendQuickReply(authenticatedUser, 'BOOK_AMENITY_pool');
      // ... select date ...
      await tester.sendQuickReply(authenticatedUser, 'TIME_10:00');
      
      expect(mockFacebookService.sendTextMessage).toHaveBeenCalledWith(
        authenticatedUser,
        expect.stringContaining('not available')
      );
    });
  });

  describe('Error Recovery Flow', () => {
    it('should recover from database errors', async () => {
      const userId = 'error_user_123';
      
      mockAuthService.isAuthenticated.mockRejectedValueOnce(
        new Error('Database connection failed')
      );
      
      await tester.sendMessage(userId, 'Hello');
      
      expect(mockFacebookService.sendTextMessage).toHaveBeenCalledWith(
        userId,
        expect.stringContaining('technical issue')
      );
    });

    it('should handle invalid quick reply payloads', async () => {
      const userId = 'invalid_user_123';
      
      mockAuthService.isAuthenticated.mockResolvedValue({
        authenticated: true,
        profile: testData.userProfile
      });
      
      await tester.sendQuickReply(userId, 'INVALID_PAYLOAD_XYZ');
      
      expect(mockFacebookService.sendTextMessage).toHaveBeenCalledWith(
        userId,
        expect.stringContaining("didn't understand")
      );
      
      // Should offer main menu
      expect(mockFacebookService.sendQuickReply).toHaveBeenCalledWith(
        userId,
        expect.any(String),
        expect.arrayContaining([
          expect.objectContaining({ payload: 'MAIN_MENU' })
        ])
      );
    });
  });

  describe('Session Management Flow', () => {
    it('should maintain session across messages', async () => {
      const userId = 'session_user_123';
      
      // First message - authenticate
      mockAuthService.isAuthenticated.mockResolvedValueOnce({
        authenticated: false
      });
      
      await tester.sendMessage(userId, 'Hi');
      
      // Enter access code
      mockAuthService.validateAccessCode.mockResolvedValueOnce({
        success: true,
        profile: testData.userProfile
      });
      
      await tester.sendMessage(userId, 'TEST123');
      
      // Session should be created
      expect(mockAuthService.createSession).toHaveBeenCalled();
      
      // Subsequent messages should use session
      mockAuthService.isAuthenticated.mockResolvedValue({
        authenticated: true,
        profile: testData.userProfile
      });
      
      mockAuthService.getSession.mockResolvedValue({
        userId: testData.userProfile.id,
        buildingId: testData.building.id
      });
      
      await tester.sendMessage(userId, 'Show FAQ');
      
      // Should not ask for authentication again
      expect(mockFacebookService.sendTextMessage).not.toHaveBeenCalledWith(
        userId,
        expect.stringContaining('access code')
      );
    });

    it('should handle expired session', async () => {
      const userId = 'expired_session_user';
      
      // Session expired
      mockAuthService.getSession.mockResolvedValueOnce(null);
      mockAuthService.isAuthenticated.mockResolvedValueOnce({
        authenticated: false
      });
      
      await tester.sendMessage(userId, 'Show bookings');
      
      expect(mockFacebookService.sendTextMessage).toHaveBeenCalledWith(
        userId,
        expect.stringContaining('session has expired')
      );
      expect(mockFacebookService.sendTextMessage).toHaveBeenCalledWith(
        userId,
        expect.stringContaining('access code')
      );
    });
  });

  describe('Complete User Journey', () => {
    it('should handle complete user journey from onboarding to service usage', async () => {
      const userId = 'complete_journey_user';
      const journeyLog: any[] = [];
      
      // Track all interactions
      mockFacebookService.sendTextMessage.mockImplementation((_id, text) => {
        journeyLog.push({ type: 'text', text });
      });
      mockFacebookService.sendQuickReply.mockImplementation((_id, text, replies) => {
        journeyLog.push({ type: 'quick_reply', text, options: replies.length });
      });
      
      // 1. New user arrives
      mockAuthService.isAuthenticated.mockResolvedValueOnce({
        authenticated: false
      });
      await tester.sendMessage(userId, 'Hello');
      
      // 2. Onboard with access code
      mockAuthService.validateAccessCode.mockResolvedValueOnce({
        success: true,
        profile: testData.userProfile
      });
      await tester.sendMessage(userId, 'TEST123');
      
      // 3. Ask an FAQ question
      mockAuthService.isAuthenticated.mockResolvedValue({
        authenticated: true,
        profile: testData.userProfile
      });
      await tester.sendQuickReply(userId, 'FAQ_MAIN');
      await tester.sendQuickReply(userId, 'FAQ_POLICIES');
      await tester.sendQuickReply(userId, 'FAQ_POLICIES_PETS');
      
      // 4. Create a maintenance request
      await tester.sendQuickReply(userId, 'MAINTENANCE_REQUEST');
      setupSupabaseMock([{ id: 'cat1', name: 'Plumbing' }]);
      await tester.sendQuickReply(userId, 'MAINT_CAT_cat1');
      await tester.sendMessage(userId, 'Sink is broken');
      await tester.sendQuickReply(userId, 'URGENCY_high');
      
      // 5. Book an amenity
      await tester.sendQuickReply(userId, 'BOOK_AMENITY');
      setupSupabaseMock([testData.amenity]);
      await tester.sendQuickReply(userId, 'BOOK_AMENITY_amenity_123');
      
      // Verify complete journey
      expect(journeyLog.length).toBeGreaterThan(10);
      expect(journeyLog).toContainEqual(
        expect.objectContaining({ text: expect.stringContaining('Welcome') })
      );
      expect(journeyLog).toContainEqual(
        expect.objectContaining({ text: expect.stringContaining('confirmed') })
      );
      
      // Verify session maintained throughout
      const history = tester.getMessageHistory();
      expect(history.length).toBeGreaterThan(10);
    });
  });
});
