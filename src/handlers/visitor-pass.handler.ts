import { supabase } from '../config/supabase';
import { facebookService } from '../services/facebook.service';
import { authService } from '../services/auth.service';
import { mainLogger } from '../utils/logger';

interface VisitorPassSession {
  step: 'START' | 'NAME' | 'PHONE' | 'TYPE' | 'PURPOSE' | 'DATE' | 'DURATION' | 'CONFIRM';
  visitorName?: string;
  visitorPhone?: string;
  visitorType?: string;
  purpose?: string;
  visitDate?: string;
  duration?: number; // in hours
  validFrom?: Date;
  validUntil?: Date;
}

export class VisitorPassHandler {
  private visitorSessions: Map<string, VisitorPassSession> = new Map();

  /**
   * Handle visitor pass creation flow
   */
  async handleVisitorPassCreation(senderId: string, message: any) {
    try {
      // Check if user is authenticated
      const authStatus = await authService.isAuthenticated(senderId);
      if (!authStatus.authenticated || !authStatus.profile) {
        await facebookService.sendTextMessage(
          senderId,
          "Please authenticate first before creating a visitor pass."
        );
        return { success: false, error: 'Not authenticated' };
      }

      // Get or create visitor pass session
      let passSession = this.visitorSessions.get(senderId);
      if (!passSession) {
        passSession = { step: 'START' };
        this.visitorSessions.set(senderId, passSession);
      }

      // Handle based on current step
      switch (passSession.step) {
        case 'START':
          return await this.handleStart(senderId, passSession);
        case 'NAME':
          return await this.handleName(senderId, message, passSession);
        case 'PHONE':
          return await this.handlePhone(senderId, message, passSession);
        case 'TYPE':
          return await this.handleType(senderId, message, passSession);
        case 'PURPOSE':
          return await this.handlePurpose(senderId, message, passSession);
        case 'DATE':
          return await this.handleDate(senderId, message, passSession);
        case 'DURATION':
          return await this.handleDuration(senderId, message, passSession, authStatus.profile);
        case 'CONFIRM':
          return await this.handleConfirm(senderId, message, passSession, authStatus.profile);
        default:
          return await this.handleStart(senderId, passSession);
      }
    } catch (error) {
      mainLogger.error('Error in visitor pass creation:', error);
      await facebookService.sendTextMessage(
        senderId,
        "Sorry, there was an error creating the visitor pass. Please try again."
      );
      this.visitorSessions.delete(senderId);
      return { success: false, error: 'Failed to create visitor pass' };
    }
  }

  private async handleStart(senderId: string, session: VisitorPassSession) {
    session.step = 'NAME';
    await facebookService.sendTextMessage(
      senderId,
      "Let's create a visitor pass. What is the visitor's full name?"
    );
    return { success: true };
  }

  private async handleName(senderId: string, message: any, session: VisitorPassSession) {
    if (!message.text || message.text.trim().length < 2) {
      await facebookService.sendTextMessage(
        senderId,
        "Please provide a valid name for the visitor."
      );
      return { success: true };
    }

    session.visitorName = message.text.trim();
    session.step = 'PHONE';
    
    await facebookService.sendTextMessage(
      senderId,
      "What is the visitor's phone number? (Optional - type 'skip' to skip)"
    );
    return { success: true };
  }

  private async handlePhone(senderId: string, message: any, session: VisitorPassSession) {
    if (message.text && message.text.toLowerCase() !== 'skip') {
      session.visitorPhone = message.text.trim();
    }
    
    session.step = 'TYPE';
    
    await facebookService.sendQuickReply(
      senderId,
      "What type of visitor is this?",
      [
        { title: '👥 Guest', payload: 'VISITOR_TYPE_GUEST' },
        { title: '📦 Delivery', payload: 'VISITOR_TYPE_DELIVERY' },
        { title: '🔧 Contractor', payload: 'VISITOR_TYPE_CONTRACTOR' },
        { title: '🏥 Service', payload: 'VISITOR_TYPE_SERVICE' },
        { title: '📝 Other', payload: 'VISITOR_TYPE_OTHER' }
      ]
    );
    return { success: true };
  }

  private async handleType(senderId: string, message: any, session: VisitorPassSession) {
    const payload = message.quick_reply?.payload || message.postback?.payload;
    
    if (!payload || !payload.startsWith('VISITOR_TYPE_')) {
      await facebookService.sendQuickReply(
        senderId,
        "Please select a visitor type:",
        [
          { title: '👥 Guest', payload: 'VISITOR_TYPE_GUEST' },
          { title: '📦 Delivery', payload: 'VISITOR_TYPE_DELIVERY' },
          { title: '🔧 Contractor', payload: 'VISITOR_TYPE_CONTRACTOR' },
          { title: '🏥 Service', payload: 'VISITOR_TYPE_SERVICE' },
          { title: '📝 Other', payload: 'VISITOR_TYPE_OTHER' }
        ]
      );
      return { success: true };
    }

    session.visitorType = payload.replace('VISITOR_TYPE_', '').toLowerCase();
    session.step = 'PURPOSE';
    
    await facebookService.sendTextMessage(
      senderId,
      "What is the purpose of the visit? (Brief description)"
    );
    return { success: true };
  }

  private async handlePurpose(senderId: string, message: any, session: VisitorPassSession) {
    if (!message.text || message.text.trim().length < 2) {
      await facebookService.sendTextMessage(
        senderId,
        "Please provide a brief description of the visit purpose."
      );
      return { success: true };
    }

    session.purpose = message.text.trim();
    session.step = 'DATE';
    
    await facebookService.sendQuickReply(
      senderId,
      "When will the visitor arrive?",
      [
        { title: '📅 Today', payload: 'VISIT_DATE_TODAY' },
        { title: '📅 Tomorrow', payload: 'VISIT_DATE_TOMORROW' },
        { title: '📅 Day After', payload: 'VISIT_DATE_DAY_AFTER' }
      ]
    );
    return { success: true };
  }

  private async handleDate(senderId: string, message: any, session: VisitorPassSession) {
    const payload = message.quick_reply?.payload || message.postback?.payload;
    
    if (!payload || !payload.startsWith('VISIT_DATE_')) {
      await facebookService.sendQuickReply(
        senderId,
        "Please select when the visitor will arrive:",
        [
          { title: '📅 Today', payload: 'VISIT_DATE_TODAY' },
          { title: '📅 Tomorrow', payload: 'VISIT_DATE_TOMORROW' },
          { title: '📅 Day After', payload: 'VISIT_DATE_DAY_AFTER' }
        ]
      );
      return { success: true };
    }

    const today = new Date();
    let visitDate = new Date();
    
    switch (payload) {
      case 'VISIT_DATE_TODAY':
        // Today
        break;
      case 'VISIT_DATE_TOMORROW':
        visitDate.setDate(today.getDate() + 1);
        break;
      case 'VISIT_DATE_DAY_AFTER':
        visitDate.setDate(today.getDate() + 2);
        break;
    }
    
    session.visitDate = visitDate.toISOString().split('T')[0];
    session.step = 'DURATION';
    
    // Different durations based on visitor type
    const durationOptions = session.visitorType === 'delivery' 
      ? [
          { title: '⏱️ 30 minutes', payload: 'DURATION_0.5' },
          { title: '⏱️ 1 hour', payload: 'DURATION_1' },
          { title: '⏱️ 2 hours', payload: 'DURATION_2' }
        ]
      : [
          { title: '⏱️ 2 hours', payload: 'DURATION_2' },
          { title: '⏱️ 4 hours', payload: 'DURATION_4' },
          { title: '⏱️ 8 hours', payload: 'DURATION_8' },
          { title: '📅 All day', payload: 'DURATION_24' }
        ];
    
    await facebookService.sendQuickReply(
      senderId,
      "How long will the visit last?",
      durationOptions
    );
    return { success: true };
  }

  private async handleDuration(senderId: string, message: any, session: VisitorPassSession, _userSession: any) {
    const payload = message.quick_reply?.payload || message.postback?.payload;
    
    if (!payload || !payload.startsWith('DURATION_')) {
      await facebookService.sendTextMessage(
        senderId,
        "Please select a duration from the options provided."
      );
      return { success: true };
    }

    session.duration = parseFloat(payload.replace('DURATION_', ''));
    
    // Calculate valid from and until times
    const visitDate = new Date(session.visitDate!);
    visitDate.setHours(8, 0, 0, 0); // Default start at 8 AM
    session.validFrom = visitDate;
    
    const validUntil = new Date(visitDate);
    validUntil.setHours(validUntil.getHours() + session.duration);
    session.validUntil = validUntil;
    
    session.step = 'CONFIRM';
    
    // Create confirmation message
    const confirmMessage = `
📋 **Visitor Pass Summary**

👤 Visitor: ${session.visitorName}
📱 Phone: ${session.visitorPhone || 'Not provided'}
🏷️ Type: ${session.visitorType}
📝 Purpose: ${session.purpose}
📅 Date: ${session.visitDate}
⏰ Valid: ${session.validFrom.toLocaleTimeString()} - ${session.validUntil.toLocaleTimeString()}

Is this correct?`;
    
    await facebookService.sendQuickReply(
      senderId,
      confirmMessage,
      [
        { title: '✅ Confirm', payload: 'CONFIRM_PASS_YES' },
        { title: '❌ Cancel', payload: 'CONFIRM_PASS_NO' }
      ]
    );
    return { success: true };
  }

  private async handleConfirm(senderId: string, message: any, session: VisitorPassSession, userSession: any) {
    const payload = message.quick_reply?.payload || message.postback?.payload;
    
    if (payload === 'CONFIRM_PASS_NO') {
      this.visitorSessions.delete(senderId);
      await facebookService.sendTextMessage(
        senderId,
        "Visitor pass creation cancelled. How else can I help you?"
      );
      return { success: true };
    }
    
    if (payload !== 'CONFIRM_PASS_YES') {
      await facebookService.sendQuickReply(
        senderId,
        "Please confirm or cancel the visitor pass:",
        [
          { title: '✅ Confirm', payload: 'CONFIRM_PASS_YES' },
          { title: '❌ Cancel', payload: 'CONFIRM_PASS_NO' }
        ]
      );
      return { success: true };
    }

    // Create the visitor pass in the database
    try {
      // Generate pass code using database function
      const { data: codeData, error: codeError } = await supabase
        .rpc('generate_visitor_pass_code');
      
      if (codeError) throw codeError;
      
      const passCode = codeData;
      
      // Create the pass
      const { data: pass, error: passError } = await supabase
        .from('visitor_passes')
        .insert({
          pass_code: passCode,
          visitor_name: session.visitorName,
          visitor_phone: session.visitorPhone,
          visitor_type: session.visitorType as any,
          purpose: session.purpose,
          created_by_tenant_id: userSession.id,
          unit_id: userSession.unit_id,
          building_id: userSession.units?.buildings?.id || userSession.units?.building_id,
          valid_from: session.validFrom?.toISOString(),
          valid_until: session.validUntil?.toISOString(),
          single_use: session.visitorType === 'delivery' // Delivery passes are single use
        })
        .select()
        .single();
      
      if (passError) throw passError;
      
      // Clear session
      this.visitorSessions.delete(senderId);
      
      // Send success message with pass details
      const successMessage = `
✅ **Visitor Pass Created Successfully!**

🎫 Pass Code: **${passCode}**

Share this code with ${session.visitorName}. They can use it to check in when they arrive.

The pass is valid:
📅 Date: ${session.visitDate}
⏰ Time: ${session.validFrom!.toLocaleTimeString()} - ${session.validUntil!.toLocaleTimeString()}

The building management has been notified about this visitor.`;
      
      await facebookService.sendTextMessage(senderId, successMessage);
      
      mainLogger.info('Visitor pass created', {
        passId: pass.id,
        tenantId: userSession.id,
        visitorName: session.visitorName
      });
      
      return { 
        success: true, 
        data: { passCode, passId: pass.id }
      };
      
    } catch (error) {
      mainLogger.error('Failed to create visitor pass in database:', error);
      await facebookService.sendTextMessage(
        senderId,
        "Sorry, there was an error creating the visitor pass. Please try again later."
      );
      this.visitorSessions.delete(senderId);
      return { success: false, error: 'Database error' };
    }
  }

  /**
   * Handle visitor check-in with pass code
   */
  async handleVisitorCheckIn(senderId: string, passCode: string) {
    try {
      // Clean up the pass code
      const cleanCode = passCode.trim().toUpperCase();
      
      // Validate pass using database function
      const { data, error } = await supabase
        .rpc('use_visitor_pass', { p_pass_code: cleanCode });
      
      if (error) {
        mainLogger.error('Error validating visitor pass:', error);
        await facebookService.sendTextMessage(
          senderId,
          "Sorry, there was an error validating your pass. Please try again."
        );
        return { success: false, error: 'Validation error' };
      }
      
      if (!data.success) {
        await facebookService.sendTextMessage(
          senderId,
          `❌ ${data.error}\n\nPlease check your pass code and try again.`
        );
        return { success: false, error: data.error };
      }
      
      // Get unit details for welcome message
      const { data: unitData } = await supabase
        .from('units')
        .select('unit_number, buildings(name)')
        .eq('id', data.unit_id)
        .single();
      
      const buildingName = (unitData as any)?.buildings?.name || 'N/A';
      
      const welcomeMessage = `
✅ **Welcome, ${data.visitor_name}!**

Your visitor pass has been validated.

📍 You're authorized to visit:
🏢 Building: ${buildingName}
🏠 Unit: ${unitData?.unit_number || 'N/A'}

⏰ This pass is valid until: ${new Date(data.valid_until).toLocaleString()}

Please proceed to the building. Have a great visit!`;
      
      await facebookService.sendTextMessage(senderId, welcomeMessage);
      
      mainLogger.info('Visitor checked in', {
        visitorName: data.visitor_name,
        unitId: data.unit_id,
        passCode: cleanCode
      });
      
      return { 
        success: true, 
        data: {
          visitorName: data.visitor_name,
          unitId: data.unit_id,
          validUntil: data.valid_until
        }
      };
      
    } catch (error) {
      mainLogger.error('Error in visitor check-in:', error);
      await facebookService.sendTextMessage(
        senderId,
        "Sorry, there was an error checking you in. Please contact the building management."
      );
      return { success: false, error: 'Check-in failed' };
    }
  }

  /**
   * List active visitor passes for a tenant
   */
  async listVisitorPasses(senderId: string) {
    try {
      const authStatus = await authService.isAuthenticated(senderId);
      if (!authStatus.authenticated || !authStatus.profile) {
        await facebookService.sendTextMessage(
          senderId,
          "Please authenticate first to view your visitor passes."
        );
        return { success: false, error: 'Not authenticated' };
      }
      const session = authStatus.profile;

      const { data: passes, error } = await supabase
        .from('visitor_passes')
        .select('*')
        .eq('created_by_tenant_id', session.id)
        .eq('status', 'active')
        .gte('valid_until', new Date().toISOString())
        .order('valid_from', { ascending: true })
        .limit(5);

      if (error) throw error;

      if (!passes || passes.length === 0) {
        await facebookService.sendTextMessage(
          senderId,
          "You don't have any active visitor passes at the moment."
        );
        return { success: true };
      }

      let message = "📋 **Your Active Visitor Passes:**\n\n";
      
      for (const pass of passes) {
        const validFrom = new Date(pass.valid_from);
        const validUntil = new Date(pass.valid_until);
        
        message += `🎫 Code: ${pass.pass_code}\n`;
        message += `👤 Visitor: ${pass.visitor_name}\n`;
        message += `📅 Valid: ${validFrom.toLocaleDateString()} ${validFrom.toLocaleTimeString()} - ${validUntil.toLocaleTimeString()}\n`;
        message += `Status: ${pass.used_count > 0 ? `Used ${pass.used_count} time(s)` : 'Not used yet'}\n`;
        message += `---\n\n`;
      }

      await facebookService.sendTextMessage(senderId, message);
      
      return { success: true, data: passes };
      
    } catch (error) {
      mainLogger.error('Error listing visitor passes:', error);
      await facebookService.sendTextMessage(
        senderId,
        "Sorry, there was an error retrieving your visitor passes."
      );
      return { success: false, error: 'Failed to list passes' };
    }
  }

  /**
   * Cancel a visitor pass
   */
  async cancelVisitorPass(senderId: string, passCode: string) {
    try {
      const authStatus = await authService.isAuthenticated(senderId);
      if (!authStatus.authenticated || !authStatus.profile) {
        await facebookService.sendTextMessage(
          senderId,
          "Please authenticate first to cancel visitor passes."
        );
        return { success: false, error: 'Not authenticated' };
      }
      const session = authStatus.profile;

      const { data, error } = await supabase
        .from('visitor_passes')
        .update({ 
          status: 'cancelled',
          updated_at: new Date().toISOString()
        })
        .eq('pass_code', passCode.toUpperCase())
        .eq('created_by_tenant_id', session.id)
        .eq('status', 'active')
        .select()
        .single();

      if (error || !data) {
        await facebookService.sendTextMessage(
          senderId,
          "Could not find or cancel that visitor pass. It may have already been used or expired."
        );
        return { success: false, error: 'Pass not found' };
      }

      await facebookService.sendTextMessage(
        senderId,
        `✅ Visitor pass ${passCode} has been cancelled successfully.`
      );
      
      mainLogger.info('Visitor pass cancelled', {
        passId: data.id,
        tenantId: session.id
      });
      
      return { success: true, data };
      
    } catch (error) {
      mainLogger.error('Error cancelling visitor pass:', error);
      await facebookService.sendTextMessage(
        senderId,
        "Sorry, there was an error cancelling the visitor pass."
      );
      return { success: false, error: 'Failed to cancel pass' };
    }
  }
}

export const visitorPassHandler = new VisitorPassHandler();
