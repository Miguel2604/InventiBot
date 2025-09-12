import { facebookService } from '../services/facebook.service';
import { supabase } from '../config/supabase';
import { authService } from '../services/auth.service';

interface MaintenanceSession {
  step: 'category' | 'description' | 'urgency' | 'confirmation';
  categoryId?: string;
  categoryName?: string;
  title?: string;
  description?: string;
  urgency?: string;
}

// Store maintenance request sessions in memory
const sessions = new Map<string, MaintenanceSession>();

export class MaintenanceHandler {
  /**
   * Start maintenance request flow
   */
  async startRequest(senderId: string): Promise<void> {
    // Initialize session
    sessions.set(senderId, { step: 'category' });
    
    // Get user profile to find their building
    const profile = await authService.getUserProfile(senderId);
    if (!profile || !profile.unit_id) {
      await facebookService.sendTextMessage(
        senderId,
        '❌ Unable to create maintenance request. Please contact your property manager.'
      );
      return;
    }

    // Get maintenance categories for the building
    const { data: categories, error } = await supabase
      .from('maintenance_categories')
      .select('*')
      .or(`building_id.eq.${profile.units?.buildings?.id},building_id.is.null`)
      .eq('is_active', true)
      .order('name');

    if (error || !categories || categories.length === 0) {
      await facebookService.sendTextMessage(
        senderId,
        '❌ No maintenance categories available. Please contact your property manager.'
      );
      sessions.delete(senderId);
      return;
    }

    // Create quick replies for categories (max 11 due to FB limit)
    const quickReplies = categories.slice(0, 10).map(cat => ({
      title: cat.name,
      payload: `MAINT_CAT_${cat.id}`
    }));

    // Add cancel option
    quickReplies.push({
      title: '❌ Cancel',
      payload: 'MAIN_MENU'
    });

    await facebookService.sendQuickReply(
      senderId,
      '🔧 What type of issue are you reporting?',
      quickReplies
    );
  }

  /**
   * Handle category selection
   */
  async handleCategorySelection(senderId: string, categoryId: string): Promise<void> {
    const session = sessions.get(senderId);
    if (!session || session.step !== 'category') {
      await this.startRequest(senderId);
      return;
    }

    // Get category details
    const { data: category } = await supabase
      .from('maintenance_categories')
      .select('name')
      .eq('id', categoryId)
      .single();

    if (!category) {
      await facebookService.sendTextMessage(senderId, '❌ Invalid category selected.');
      await this.startRequest(senderId);
      return;
    }

    // Update session
    session.categoryId = categoryId;
    session.categoryName = category.name;
    session.step = 'description';
    sessions.set(senderId, session);

    // Provide common issue templates based on category
    const templates = this.getIssueTemplates(category.name);
    
    if (templates.length > 0) {
      const quickReplies = templates.slice(0, 10).map(template => ({
        title: template,
        payload: `MAINT_TEMPLATE_${template}`
      }));

      quickReplies.push({
        title: '✏️ Other',
        payload: 'MAINT_TEMPLATE_OTHER'
      });

      await facebookService.sendQuickReply(
        senderId,
        `What's the specific issue with ${category.name.toLowerCase()}?`,
        quickReplies
      );
    } else {
      await facebookService.sendTextMessage(
        senderId,
        `Please describe the ${category.name.toLowerCase()} issue you're experiencing:`
      );
    }
  }

  /**
   * Handle description input
   */
  async handleDescription(senderId: string, description: string): Promise<void> {
    const session = sessions.get(senderId);
    if (!session || session.step !== 'description') {
      await this.startRequest(senderId);
      return;
    }

    // Store description
    session.description = description;
    session.title = description.substring(0, 50); // Simple title from first 50 chars
    session.step = 'urgency';
    sessions.set(senderId, session);

    // Ask for urgency level
    await facebookService.sendQuickReply(
      senderId,
      '⚡ How urgent is this issue?',
      [
        { title: '🟢 Low - Can wait', payload: 'MAINT_URGENCY_low' },
        { title: '🟡 Medium - Soon please', payload: 'MAINT_URGENCY_medium' },
        { title: '🔴 High - Today needed', payload: 'MAINT_URGENCY_high' },
        { title: '🚨 Emergency - Now!', payload: 'MAINT_URGENCY_emergency' }
      ]
    );
  }

  /**
   * Handle urgency selection
   */
  async handleUrgencySelection(senderId: string, urgency: string): Promise<void> {
    const session = sessions.get(senderId);
    if (!session || session.step !== 'urgency') {
      await this.startRequest(senderId);
      return;
    }

    session.urgency = urgency;
    session.step = 'confirmation';
    sessions.set(senderId, session);

    // Show confirmation
    const urgencyEmoji = {
      low: '🟢',
      medium: '🟡',
      high: '🔴',
      emergency: '🚨'
    }[urgency] || '🟡';

    const confirmMessage = `
📋 **Maintenance Request Summary**
Category: ${session.categoryName}
Issue: ${session.description}
Urgency: ${urgencyEmoji} ${urgency.charAt(0).toUpperCase() + urgency.slice(1)}

Ready to submit?`;

    await facebookService.sendQuickReply(
      senderId,
      confirmMessage,
      [
        { title: '✅ Submit', payload: 'MAINT_CONFIRM_YES' },
        { title: '❌ Cancel', payload: 'MAINT_CONFIRM_NO' }
      ]
    );
  }

  /**
   * Submit the maintenance request
   */
  async submitRequest(senderId: string): Promise<void> {
    const session = sessions.get(senderId);
    if (!session || session.step !== 'confirmation') {
      await facebookService.sendTextMessage(senderId, '❌ Session expired. Please start over.');
      await this.startRequest(senderId);
      return;
    }

    // Get user profile
    const profile = await authService.getUserProfile(senderId);
    if (!profile) {
      await facebookService.sendTextMessage(senderId, '❌ Unable to submit request. Please try again.');
      sessions.delete(senderId);
      return;
    }

    // Submit to database
    const { data: request, error } = await supabase
      .from('maintenance_requests')
      .insert({
        building_id: profile.units?.buildings?.id,
        unit_id: profile.unit_id,
        tenant_id: profile.id,
        category_id: session.categoryId,
        title: session.title || 'Maintenance Request',
        description: session.description || '',
        urgency: session.urgency || 'medium',
        status: 'submitted'
      })
      .select()
      .single();

    if (error || !request) {
      console.error('Error submitting maintenance request:', error);
      await facebookService.sendTextMessage(
        senderId,
        '❌ Failed to submit request. Please try again or contact the office.'
      );
    } else {
      // Success! Send confirmation
      const ticketNumber = request.id.substring(0, 8).toUpperCase();
      
      await facebookService.sendTextMessage(
        senderId,
        `✅ Maintenance request submitted successfully!

📋 Ticket #${ticketNumber}
Status: Submitted
Unit: ${profile.units?.unit_number}

Our team will review your request and contact you soon. For emergencies, please call our 24/7 hotline.`
      );

      // If it's an emergency, send additional message
      if (session.urgency === 'emergency') {
        await facebookService.sendTextMessage(
          senderId,
          '🚨 EMERGENCY DETECTED: Our on-call team has been notified. Someone will contact you shortly.'
        );
      }

      // Show what to do next
      await facebookService.sendQuickReply(
        senderId,
        'What would you like to do next?',
        [
          { title: '🏠 Main Menu', payload: 'MAIN_MENU' },
          { title: '🔧 Another Request', payload: 'MAINTENANCE_REQUEST' },
          { title: '📅 Book Amenity', payload: 'BOOK_AMENITY' }
        ]
      );
    }

    // Clear session
    sessions.delete(senderId);
  }

  /**
   * Cancel maintenance request
   */
  async cancelRequest(senderId: string): Promise<void> {
    sessions.delete(senderId);
    
    await facebookService.sendQuickReply(
      senderId,
      'Maintenance request cancelled. How can I help you?',
      [
        { title: '🏠 Main Menu', payload: 'MAIN_MENU' },
        { title: 'ℹ️ Building Info', payload: 'FAQ_MAIN' },
        { title: '📅 Book Amenity', payload: 'BOOK_AMENITY' }
      ]
    );
  }

  /**
   * Handle any maintenance-related payload
   */
  async handlePayload(senderId: string, payload: string): Promise<void> {
    // Check for category selection
    if (payload.startsWith('MAINT_CAT_')) {
      const categoryId = payload.replace('MAINT_CAT_', '');
      await this.handleCategorySelection(senderId, categoryId);
      return;
    }

    // Check for template selection
    if (payload.startsWith('MAINT_TEMPLATE_')) {
      const template = payload.replace('MAINT_TEMPLATE_', '');
      if (template === 'OTHER') {
        await facebookService.sendTextMessage(
          senderId,
          'Please describe the issue in your own words:'
        );
      } else {
        await this.handleDescription(senderId, template);
      }
      return;
    }

    // Check for urgency selection
    if (payload.startsWith('MAINT_URGENCY_')) {
      const urgency = payload.replace('MAINT_URGENCY_', '');
      await this.handleUrgencySelection(senderId, urgency);
      return;
    }

    // Check for confirmation
    if (payload === 'MAINT_CONFIRM_YES') {
      await this.submitRequest(senderId);
      return;
    }

    if (payload === 'MAINT_CONFIRM_NO') {
      await this.cancelRequest(senderId);
      return;
    }
  }

  /**
   * Handle text input during maintenance flow
   */
  async handleTextInput(senderId: string, text: string): Promise<void> {
    const session = sessions.get(senderId);
    if (!session) return;

    if (session.step === 'description') {
      await this.handleDescription(senderId, text);
    }
  }

  /**
   * Get issue templates based on category
   */
  private getIssueTemplates(category: string): string[] {
    const templates: { [key: string]: string[] } = {
      'Plumbing': [
        'Leaking faucet',
        'Clogged drain',
        'No hot water',
        'Toilet not flushing',
        'Low water pressure'
      ],
      'Electrical': [
        'Power outlet not working',
        'Light not working',
        'Circuit breaker tripped',
        'Sparking outlet',
        'Flickering lights'
      ],
      'HVAC': [
        'AC not cooling',
        'Heater not working',
        'Strange noise from AC',
        'Thermostat issue',
        'Poor air flow'
      ],
      'Appliances': [
        'Refrigerator not cooling',
        'Dishwasher not working',
        'Oven not heating',
        'Washer not draining',
        'Dryer not heating'
      ],
      'Locks & Keys': [
        'Lock broken',
        'Key not working',
        'Door won\'t close',
        'Lost key',
        'Need lock change'
      ]
    };

    return templates[category] || [];
  }
}

export const maintenanceHandler = new MaintenanceHandler();
