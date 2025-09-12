import { facebookService } from '../services/facebook.service';
import { authService } from '../services/auth.service';
import { authLogger } from '../utils/logger';

export class AuthHandler {
  async promptForAccessCode(senderId: string): Promise<void> {
    authLogger.info('Prompting for access code', { senderId });
    await facebookService.sendTextMessage(
      senderId,
      'Welcome to InventiBot! 🏢\n\nTo get started, please enter your unique access code provided by your property manager.'
    );
  }

  async handleAccessCode(senderId: string, code: string): Promise<void> {
    const normalized = code.trim().toUpperCase();
    authLogger.info('Processing access code', { 
      senderId,
      codeLength: code.length,
      normalized: normalized.substring(0, 3) + '***'
    });

    // Basic validation
    if (!/^[A-Z0-9-]{4,}$/.test(normalized)) {
      authLogger.info('Code format validation failed', { 
        senderId,
        pattern: 'Expected: [A-Z0-9-]{4,}'
      });
      await facebookService.sendTextMessage(
        senderId,
        '⚠️ That code format looks incorrect. Please enter the code exactly as provided (letters and numbers).'
      );
      return;
    }
    
    authLogger.debug('Code format valid, proceeding with validation', { senderId });

    await facebookService.sendTypingOn(senderId);

    const result = await authService.validateAccessCode(normalized, senderId);
    authLogger.info('Access code validation completed', {
      senderId,
      success: result.success,
      hasProfile: !!result.profile,
      hasUnit: !!result.unit,
      hasBuilding: !!result.building
    });

    if (!result.success) {
      authLogger.info('Access code validation failed', { 
        senderId,
        reason: result.message 
      });
      await facebookService.sendTextMessage(senderId, result.message);
      await facebookService.sendQuickReply(senderId, 'Need help?', [
        { title: '🔁 Try Again', payload: 'AUTH_TRY_AGAIN' },
        { title: '👤 Contact Manager', payload: 'HANDOFF_REQUEST' },
      ]);
      return;
    }

    // Create session (non-blocking on failure)
    if (result.profile) {
      try {
        await authService.createSession(result.profile.id, senderId);
      } catch (e) {
        authLogger.error('Session creation failed (non-critical)', e, { 
          senderId,
          profileId: result.profile.id 
        });
      }
    }

    // Welcome message with summary
    await facebookService.sendTextMessage(senderId, result.message);
    
    authLogger.info('User authenticated successfully', {
      senderId,
      profileId: result.profile?.id,
      unitNumber: result.unit?.unit_number,
      buildingName: result.building?.name
    });

    // Show main menu
    await facebookService.sendQuickReply(senderId, 'How can I help you today?', [
      { title: 'ℹ️ Building Info', payload: 'FAQ_MAIN' },
      { title: '🔧 Report Issue', payload: 'MAINTENANCE_REQUEST' },
      { title: '📅 Book Amenity', payload: 'BOOK_AMENITY' },
      { title: '💬 Talk to Manager', payload: 'HANDOFF_REQUEST' },
    ]);
  }
}

export const authHandler = new AuthHandler();
