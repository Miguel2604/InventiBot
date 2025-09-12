import { facebookService } from '../services/facebook.service';
import { authService } from '../services/auth.service';

export class AuthHandler {
  async promptForAccessCode(senderId: string): Promise<void> {
    await facebookService.sendTextMessage(
      senderId,
      'Welcome to InventiBot! 🏢\n\nTo get started, please enter your unique access code provided by your property manager.'
    );
  }

  async handleAccessCode(senderId: string, code: string): Promise<void> {
    const normalized = code.trim().toUpperCase();
    console.log(`[AUTH_HANDLER] Processing access code from ${senderId}: "${code}" -> "${normalized}"`);

    // Basic validation
    if (!/^[A-Z0-9-]{4,}$/.test(normalized)) {
      console.log(`[AUTH_HANDLER] Code format validation failed for: ${normalized}`);
      await facebookService.sendTextMessage(
        senderId,
        '⚠️ That code format looks incorrect. Please enter the code exactly as provided (letters and numbers).'
      );
      return;
    }
    
    console.log(`[AUTH_HANDLER] Code format valid, proceeding with validation`);

    await facebookService.sendTypingOn(senderId);

    const result = await authService.validateAccessCode(normalized, senderId);
    console.log(`[AUTH_HANDLER] Validation result:`, {
      success: result.success,
      message: result.message,
      hasProfile: !!result.profile,
      hasUnit: !!result.unit,
      hasBuilding: !!result.building
    });

    if (!result.success) {
      console.log(`[AUTH_HANDLER] Access code validation failed for ${senderId}`);
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
        console.error('Auth session creation failed:', e);
      }
    }

    // Welcome message with summary
    await facebookService.sendTextMessage(senderId, result.message);

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
