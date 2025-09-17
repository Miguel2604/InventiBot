import { supabaseAdmin } from '../config/supabase';
import { facebookService } from '../services/facebook.service';
import { authService } from '../services/auth.service';
import { mainLogger } from '../utils/logger';
import { 
  convertTimeSelectionToUTC, 
  addHoursInPhilippineTime, 
  formatPhilippineTime,
  createPhilippineTime
} from '../utils/timezone';

interface VisitorPassSession {
  step: 'START' | 'NAME' | 'PHONE' | 'TYPE' | 'PURPOSE' | 'DATE' | 'TIME' | 'DURATION' | 'CONFIRM';
  visitorName?: string;
  visitorPhone?: string;
  visitorType?: string;
  purpose?: string;
  visitDate?: string;
  startTime?: string; // morning, afternoon, evening, or now
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
      if (!authStatus.authenticated || (!authStatus.profile && !authStatus.isVisitor)) {
        await facebookService.sendTextMessage(
          senderId,
          "Please authenticate first before creating a visitor pass."
        );
        return { success: false, error: 'Not authenticated' };
      }
      
      // Check if user is a visitor (visitors cannot create passes)
      if (authStatus.isVisitor) {
        await facebookService.sendTextMessage(
          senderId,
          "⚠️ Sorry, as a visitor you don't have access to create visitor passes. This feature is only available to residents.\n\nPlease contact the resident you're visiting if you need assistance."
        );
        return { success: false, error: 'Visitors cannot create passes' };
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
        case 'TIME':
          return await this.handleTime(senderId, message, passSession);
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
    session.step = 'TIME';
    
    // Ask for preferred time
    const timeOptions = payload === 'VISIT_DATE_TODAY'
      ? [
          { title: '⏰ Start Now', payload: 'START_TIME_NOW' },
          { title: '🌅 Morning (9 AM)', payload: 'START_TIME_MORNING' },
          { title: '☀️ Afternoon (2 PM)', payload: 'START_TIME_AFTERNOON' },
          { title: '🌆 Evening (6 PM)', payload: 'START_TIME_EVENING' }
        ]
      : [
          { title: '🌅 Morning (9 AM)', payload: 'START_TIME_MORNING' },
          { title: '☀️ Afternoon (2 PM)', payload: 'START_TIME_AFTERNOON' },
          { title: '🌆 Evening (6 PM)', payload: 'START_TIME_EVENING' }
        ];
    
    await facebookService.sendQuickReply(
      senderId,
      "What time will the visitor arrive?",
      timeOptions
    );
    return { success: true };
  }
  
  private async handleTime(senderId: string, message: any, session: VisitorPassSession) {
    const payload = message.quick_reply?.payload || message.postback?.payload;
    
    if (!payload || !payload.startsWith('START_TIME_')) {
      await facebookService.sendTextMessage(
        senderId,
        "Please select a start time from the options."
      );
      return { success: true };
    }
    
    session.startTime = payload.replace('START_TIME_', '').toLowerCase();
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
    
    // Calculate valid from time using Philippine timezone
    session.validFrom = convertTimeSelectionToUTC(session.visitDate!, session.startTime!);
    
    // For all-day passes, override with full day hours in Philippine time
    if (session.duration === 24) {
      // All day: valid from 7 AM to 11 PM Philippine time
      const visitDateObj = new Date(session.visitDate!);
      session.validFrom = createPhilippineTime(7, 0, visitDateObj); // 7 AM Philippine time
      session.validUntil = createPhilippineTime(23, 0, visitDateObj); // 11 PM Philippine time
    } else {
      // Calculate end time based on duration
      session.validUntil = addHoursInPhilippineTime(session.validFrom, session.duration);
    }
    
    session.step = 'CONFIRM';
    
    // Determine if this should be a single-use pass
    const isSingleUse = session.visitorType === 'delivery' || 
                        session.visitorType === 'contractor' ||
                        session.duration <= 2; // 2 hours or less is single-use
    
    // Create confirmation message with Philippine time formatting
    const confirmMessage = `
📋 **Visitor Pass Summary**

👤 Visitor: ${session.visitorName}
📱 Phone: ${session.visitorPhone || 'Not provided'}
🏷️ Type: ${session.visitorType}
📝 Purpose: ${session.purpose}
📅 Date: ${session.visitDate}
⏰ Valid: ${formatPhilippineTime(session.validFrom, { hour: '2-digit', minute: '2-digit', hour12: true })} - ${formatPhilippineTime(session.validUntil, { hour: '2-digit', minute: '2-digit', hour12: true })} (Philippine Time)
${isSingleUse ? '⚠️ **Single-Use Pass**: This pass can only be used once' : '♻️ **Multi-Use Pass**: This pass can be used multiple times during the valid period'}

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
      // First get the building_id from the unit if not on profile
      let buildingId = userSession.building_id;
      
      if (!buildingId && userSession.unit_id) {
        // Fetch the building_id from the unit
        const { data: unitData, error: unitError } = await supabaseAdmin
          .from('units')
          .select('building_id')
          .eq('id', userSession.unit_id)
          .single();
        
        if (!unitError && unitData) {
          buildingId = unitData.building_id;
        }
      }
      
      if (!buildingId) {
        throw new Error('Could not determine building for this unit');
      }
      
      // Generate pass code using database function
      const { data: codeData, error: codeError } = await supabaseAdmin
        .rpc('generate_visitor_pass_code');
      
      if (codeError) throw codeError;
      
      const passCode = codeData;
      
      // Determine if this should be a single-use pass
      const isSingleUse = session.visitorType === 'delivery' || 
                          session.visitorType === 'contractor' ||
                          (session.duration && session.duration <= 2); // 2 hours or less is single-use
      
      // Create the pass
      const { data: pass, error: passError } = await supabaseAdmin
        .from('visitor_passes')
        .insert({
          pass_code: passCode,
          visitor_name: session.visitorName,
          visitor_phone: session.visitorPhone,
          visitor_type: session.visitorType as any,
          purpose: session.purpose,
          created_by_tenant_id: userSession.id,
          unit_id: userSession.unit_id,
          building_id: buildingId,
          valid_from: session.validFrom?.toISOString(),
          valid_until: session.validUntil?.toISOString(),
          single_use: isSingleUse,
          used_count: 0 // Explicitly set to 0 initially
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
⏰ Time: ${formatPhilippineTime(session.validFrom!, { hour: '2-digit', minute: '2-digit', hour12: true })} - ${formatPhilippineTime(session.validUntil!, { hour: '2-digit', minute: '2-digit', hour12: true })} (Philippine Time)
${isSingleUse ? '⚠️ **Important**: This is a SINGLE-USE pass and will expire after first use.' : '♻️ This pass can be used multiple times during the valid period.'}

The building management has been notified about this visitor.`;
      
      await facebookService.sendTextMessage(senderId, successMessage);
      
      mainLogger.info('Visitor pass created', {
        passId: pass.id,
        passCode: passCode,
        tenantId: userSession.id,
        visitorName: session.visitorName,
        visitorType: session.visitorType,
        duration: session.duration,
        singleUse: isSingleUse,
        validFrom: session.validFrom,
        validUntil: session.validUntil
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
      
      // First check if the pass exists and get its details
      const { data: passData, error: passError } = await supabaseAdmin
        .from('visitor_passes')
        .select('*, units(unit_number, buildings(name))')
        .eq('pass_code', cleanCode)
        .single();
      
      if (passError || !passData) {
        mainLogger.warn('Invalid visitor pass code attempt', {
          passCode: cleanCode,
          error: passError?.message
        });
        await facebookService.sendTextMessage(
          senderId,
          `❌ Invalid pass code. Please check your code and try again.`
        );
        return { success: false, error: 'Invalid pass code' };
      }
      
      // Log pass details for debugging
      mainLogger.info('Visitor pass found', {
        passCode: cleanCode,
        visitorName: passData.visitor_name,
        visitorType: passData.visitor_type,
        singleUse: passData.single_use,
        usedCount: passData.used_count,
        status: passData.status,
        usedAt: passData.used_at
      });
      
      // Check if pass is already used (for single-use passes)
      // Check both used_count and status for reliability
      if (passData.single_use && (passData.used_count > 0 || passData.status === 'used')) {
        const passType = passData.visitor_type === 'delivery' ? 'delivery' : 
                        passData.visitor_type === 'contractor' ? 'contractor visit' : 
                        'one-time access';
        await facebookService.sendTextMessage(
          senderId,
          `❌ This visitor pass has already been used and cannot be used again.\n\nThis was a single-use pass for ${passType}.\n\nPass Code: ${passData.pass_code}\nVisitor: ${passData.visitor_name}\nUsed at: ${passData.used_at ? formatPhilippineTime(new Date(passData.used_at)) : 'Unknown time'}`
        );
        return { success: false, error: 'Pass already used' };
      }
      
      // Check if pass is expired
      if (new Date(passData.valid_until) < new Date()) {
        await facebookService.sendTextMessage(
          senderId,
          `❌ This visitor pass has expired.\n\nThe pass was valid until: ${formatPhilippineTime(new Date(passData.valid_until))} (Philippine Time)`
        );
        return { success: false, error: 'Pass expired' };
      }
      
      // Check if pass is not yet valid
      if (new Date(passData.valid_from) > new Date()) {
        await facebookService.sendTextMessage(
          senderId,
          `❌ This visitor pass is not yet valid.\n\nThe pass will be valid from: ${formatPhilippineTime(new Date(passData.valid_from))} (Philippine Time)`
        );
        return { success: false, error: 'Pass not yet valid' };
      }
      
      // Check if pass status is active
      if (passData.status !== 'active') {
        await facebookService.sendTextMessage(
          senderId,
          `❌ This visitor pass is ${passData.status}. Please contact the resident who created this pass.`
        );
        return { success: false, error: `Pass is ${passData.status}` };
      }
      
      // Update pass usage count and used timestamp
      const { error: updateError } = await supabaseAdmin
        .from('visitor_passes')
        .update({
          used_count: passData.used_count + 1,
          used_at: new Date().toISOString(),
          // If single use, mark as used
          status: passData.single_use ? 'used' : 'active'
        })
        .eq('id', passData.id);
      
      if (updateError) {
        mainLogger.error('Error updating pass usage:', updateError);
        // Continue anyway, the check-in is more important
      }
      
      // Create visitor session in auth service
      authService.createVisitorSession(senderId, {
        visitorName: passData.visitor_name,
        unitId: passData.unit_id,
        validUntil: passData.valid_until,
        passCode: cleanCode,
        checkedInAt: new Date().toISOString()
      });
      
      const buildingName = (passData.units as any)?.buildings?.name || 'N/A';
      const unitNumber = (passData.units as any)?.unit_number || 'N/A';
      
      const welcomeMessage = `
✅ **Welcome, ${passData.visitor_name}!**

Your visitor pass has been validated.

📍 You're authorized to visit:
🏢 Building: ${buildingName}
🏠 Unit: ${unitNumber}

⏰ This pass is valid until: ${formatPhilippineTime(new Date(passData.valid_until))} (Philippine Time)
${passData.single_use ? '\n⚠️ Note: This is a single-use pass and has now been consumed.' : ''}

How can I assist you today?`;
      
      await facebookService.sendTextMessage(senderId, welcomeMessage);
      
      // Send visitor menu after welcome message
      await facebookService.sendQuickReply(
        senderId,
        'As a visitor, you have limited access to building features:',
        [
          { title: 'ℹ️ Building Info', payload: 'VISITOR_BUILDING_INFO' },
          { title: '📍 Get Directions', payload: 'VISITOR_DIRECTIONS' },
          { title: '☎️ Contact Info', payload: 'VISITOR_CONTACT' },
          { title: '🚪 Exit', payload: 'VISITOR_EXIT' }
        ]
      );
      
      mainLogger.info('Visitor checked in', {
        visitorName: passData.visitor_name,
        unitId: passData.unit_id,
        passCode: cleanCode,
        singleUse: passData.single_use
      });
      
      return { 
        success: true, 
        data: {
          visitorName: passData.visitor_name,
          unitId: passData.unit_id,
          validUntil: passData.valid_until
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
      if (!authStatus.authenticated || (!authStatus.profile && !authStatus.isVisitor)) {
        await facebookService.sendTextMessage(
          senderId,
          "Please authenticate first to view your visitor passes."
        );
        return { success: false, error: 'Not authenticated' };
      }
      
      // Check if user is a visitor
      if (authStatus.isVisitor) {
        await facebookService.sendTextMessage(
          senderId,
          "⚠️ Sorry, as a visitor you don't have access to view visitor passes. This feature is only available to residents."
        );
        return { success: false, error: 'Visitors cannot view passes' };
      }
      
      // At this point we know profile exists (not a visitor, authenticated)
      const session = authStatus.profile!;

      const { data: passes, error } = await supabaseAdmin
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
        message += `📅 Valid: ${formatPhilippineTime(validFrom, { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: true })} - ${formatPhilippineTime(validUntil, { hour: '2-digit', minute: '2-digit', hour12: true })} (PH Time)\n`;
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

      const { data, error } = await supabaseAdmin
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
