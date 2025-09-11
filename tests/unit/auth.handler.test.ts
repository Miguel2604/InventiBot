import { authHandler } from '../../src/handlers/auth.handler';
import { facebookService } from '../../src/services/facebook.service';
import { authService } from '../../src/services/auth.service';

jest.mock('../../src/services/facebook.service', () => ({
  facebookService: {
    sendTextMessage: jest.fn().mockResolvedValue(undefined),
    sendQuickReply: jest.fn().mockResolvedValue(undefined),
    sendTypingOn: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../../src/services/auth.service', () => ({
  authService: {
    isAuthenticated: jest.fn().mockResolvedValue({ authenticated: false }),
    validateAccessCode: jest.fn(),
    createSession: jest.fn().mockResolvedValue('session_token'),
    getTenantInfo: jest.fn().mockResolvedValue(null),
  },
}));

describe('Auth Handler', () => {
  const senderId = 'user_abc_123';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should prompt for access code', async () => {
    await authHandler.promptForAccessCode(senderId);

    expect(facebookService.sendTextMessage).toHaveBeenCalledWith(
      senderId,
      expect.stringContaining('enter your unique access code')
    );
  });

  it('should warn on invalid access code format', async () => {
    await authHandler.handleAccessCode(senderId, '***');

    expect(facebookService.sendTextMessage).toHaveBeenCalledWith(
      senderId,
      expect.stringContaining('format looks incorrect')
    );
  });

  it('should handle failed access code validation', async () => {
    (authService.validateAccessCode as jest.Mock).mockResolvedValue({
      success: false,
      message: '❌ Invalid or expired access code. Please contact your property manager.',
    });

    await authHandler.handleAccessCode(senderId, 'ABCD1234');

    expect(facebookService.sendTypingOn).toHaveBeenCalledWith(senderId);
    expect(facebookService.sendTextMessage).toHaveBeenCalledWith(
      senderId,
      expect.stringContaining('Invalid or expired')
    );
    expect(facebookService.sendQuickReply).toHaveBeenCalledWith(
      senderId,
      'Need help?',
      expect.arrayContaining([
        { title: '🔁 Try Again', payload: 'AUTH_TRY_AGAIN' },
        { title: '👤 Contact Manager', payload: 'HANDOFF_REQUEST' },
      ])
    );
  });

  it('should handle successful access code and create session', async () => {
    (authService.validateAccessCode as jest.Mock).mockResolvedValue({
      success: true,
      message: '✅ Welcome John! You\'re now registered for Unit 12A at Sky Tower.',
      tenant: { id: 1, facebook_id: senderId, name: 'John', status: 'active' },
    });

    await authHandler.handleAccessCode(senderId, 'ABCD1234');

    expect(facebookService.sendTypingOn).toHaveBeenCalledWith(senderId);
    expect(authService.createSession).toHaveBeenCalledWith(1, senderId);
    expect(facebookService.sendTextMessage).toHaveBeenCalledWith(
      senderId,
      expect.stringContaining('Welcome John')
    );
    expect(facebookService.sendQuickReply).toHaveBeenCalledWith(
      senderId,
      'How can I help you today?',
      expect.arrayContaining([
        { title: 'ℹ️ Building Info', payload: 'FAQ_MAIN' },
        { title: '🔧 Report Issue', payload: 'MAINTENANCE_REQUEST' },
        { title: '📅 Book Amenity', payload: 'BOOK_AMENITY' },
        { title: '💬 Talk to Manager', payload: 'HANDOFF_REQUEST' },
      ])
    );
  });
});
