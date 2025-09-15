import { supabase } from '../config/supabase';
import { facebookService } from '../services/facebook.service';
import { authService } from '../services/auth.service';
import { webhookLogger } from '../utils/logger';

interface Announcement {
  id: string;
  building_id: string;
  title: string;
  content: string;
  category: string | null;
  priority: 'urgent' | 'high' | 'normal' | 'low';
  target_units: string[] | null;
  published_at: string;
  expires_at: string | null;
  is_published: boolean;
}

class AnnouncementsHandler {
  /**
   * Show announcements menu or list
   */
  async showAnnouncements(senderId: string): Promise<void> {
    try {
      // Get user profile to get building_id and unit_id
      const profile = await authService.getUserProfile(senderId);
      
      if (!profile || !profile.building_id) {
        await facebookService.sendTextMessage(
          senderId,
          '❌ Unable to fetch announcements. Your profile is not properly configured.'
        );
        return;
      }

      // Fetch announcements for the user's building
      const announcements = await this.fetchUserAnnouncements(
        profile.building_id,
        profile.unit_id
      );

      if (announcements.length === 0) {
        await facebookService.sendTextMessage(
          senderId,
          '📢 No active announcements for your building at this time.'
        );
        
        // Show return to menu option
        await facebookService.sendQuickReply(
          senderId,
          'What would you like to do?',
          [
            { title: '🏠 Main Menu', payload: 'MAIN_MENU' },
            { title: 'ℹ️ Building Info', payload: 'FAQ_MAIN' }
          ]
        );
        return;
      }

      // Send announcements
      await this.sendAnnouncementMessages(senderId, announcements);

    } catch (error) {
      webhookLogger.error('Error showing announcements', error, { senderId });
      await facebookService.sendTextMessage(
        senderId,
        '❌ Sorry, there was an error fetching announcements. Please try again later.'
      );
    }
  }

  /**
   * Fetch announcements for a specific user
   */
  private async fetchUserAnnouncements(
    buildingId: string,
    unitId?: string
  ): Promise<Announcement[]> {
    const { data, error } = await supabase
      .from('announcements')
      .select('*')
      .eq('building_id', buildingId)
      .eq('is_published', true)
      .order('priority', { ascending: true })
      .order('published_at', { ascending: false });

    if (error) {
      webhookLogger.error('Error fetching announcements from database', error);
      throw error;
    }

    // Filter announcements based on:
    // 1. Not expired
    // 2. Targeted to user's unit or all units
    const now = new Date();
    return (data || []).filter(announcement => {
      // Check expiry
      if (announcement.expires_at) {
        const expiryDate = new Date(announcement.expires_at);
        if (expiryDate < now) {
          return false;
        }
      }

      // Check unit targeting
      if (announcement.target_units && announcement.target_units.length > 0) {
        return unitId && announcement.target_units.includes(unitId);
      }

      return true;
    });
  }

  /**
   * Send announcement messages to user
   */
  private async sendAnnouncementMessages(
    senderId: string,
    announcements: Announcement[]
  ): Promise<void> {
    // Send header
    await facebookService.sendTextMessage(
      senderId,
      `📢 Building Announcements (${announcements.length})`
    );

    // Send each announcement
    for (const announcement of announcements.slice(0, 10)) { // Limit to 10
      const priorityEmoji = this.getPriorityEmoji(announcement.priority);
      const priorityText = announcement.priority.toUpperCase();
      
      let message = `${priorityEmoji} ${priorityText}: ${announcement.title}\n`;
      message += `━━━━━━━━━━━━━━━\n`;
      message += `${announcement.content}\n\n`;
      
      if (announcement.category) {
        message += `Category: ${announcement.category}\n`;
      }
      
      const publishedDate = new Date(announcement.published_at);
      message += `Posted: ${publishedDate.toLocaleDateString()}`;
      
      if (announcement.expires_at) {
        const expiryDate = new Date(announcement.expires_at);
        message += `\nExpires: ${expiryDate.toLocaleDateString()}`;
      }

      await facebookService.sendTextMessage(senderId, message);
    }

    // Show menu options
    await facebookService.sendQuickReply(
      senderId,
      'What would you like to do next?',
      [
        { title: '🏠 Main Menu', payload: 'MAIN_MENU' },
        { title: '🔧 Report Issue', payload: 'MAINTENANCE_REQUEST' },
        { title: '📅 Book Amenity', payload: 'BOOK_AMENITY' }
      ]
    );
  }

  /**
   * Get emoji for priority level
   */
  private getPriorityEmoji(priority: string): string {
    switch (priority) {
      case 'urgent': return '🔴';
      case 'high': return '🟠';
      case 'normal': return '🔵';
      case 'low': return '⚪';
      default: return '📌';
    }
  }

  /**
   * Send notification to specific tenant about new announcement
   */
  async sendAnnouncementNotification(
    chatPlatformId: string,
    announcement: Announcement
  ): Promise<void> {
    try {
      const priorityEmoji = this.getPriorityEmoji(announcement.priority);
      const priorityText = announcement.priority === 'urgent' || announcement.priority === 'high' 
        ? announcement.priority.toUpperCase() + ' - ' 
        : '';
      
      // Send notification
      let message = `🔔 New Announcement!\n\n`;
      message += `${priorityEmoji} ${priorityText}${announcement.title}\n\n`;
      
      // Add first 100 chars of content
      const preview = announcement.content.length > 100 
        ? announcement.content.substring(0, 100) + '...'
        : announcement.content;
      message += `${preview}\n\n`;
      message += `Type "announcements" or click below to read more.`;

      await facebookService.sendTextMessage(chatPlatformId, message);

      // Add quick reply to view all announcements
      await facebookService.sendQuickReply(
        chatPlatformId,
        'Would you like to:',
        [
          { title: '📢 View Announcements', payload: 'VIEW_ANNOUNCEMENTS' },
          { title: '🏠 Main Menu', payload: 'MAIN_MENU' }
        ]
      );

      webhookLogger.info('Announcement notification sent', {
        chatPlatformId,
        announcementId: announcement.id,
        priority: announcement.priority
      });

    } catch (error) {
      webhookLogger.error('Error sending announcement notification', error, {
        chatPlatformId,
        announcementId: announcement.id
      });
    }
  }

  /**
   * Process webhook notification for new announcement
   */
  async processAnnouncementWebhook(payload: {
    announcement: Announcement;
    building_id: string;
    target_units?: string[];
  }): Promise<{ sent: number; failed: number }> {
    const { announcement, building_id, target_units } = payload;
    let sent = 0;
    let failed = 0;

    try {
      // Build query for affected tenants
      let query = supabase
        .from('profiles')
        .select('id, chat_platform_id, unit_id')
        .eq('building_id', building_id)
        .eq('is_manager', false)
        .not('chat_platform_id', 'is', null);

      // If targeting specific units, filter by those
      if (target_units && target_units.length > 0) {
        query = query.in('unit_id', target_units);
      }

      const { data: tenants, error } = await query;

      if (error) {
        webhookLogger.error('Error fetching tenants for notification', error);
        throw error;
      }

      if (!tenants || tenants.length === 0) {
        webhookLogger.info('No tenants found for announcement notification', {
          buildingId: building_id,
          targetUnits: target_units
        });
        return { sent: 0, failed: 0 };
      }

      // Send notifications to each tenant
      for (const tenant of tenants) {
        if (tenant.chat_platform_id) {
          try {
            await this.sendAnnouncementNotification(
              tenant.chat_platform_id,
              announcement
            );
            sent++;
            
            // Add small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 100));
          } catch (error) {
            failed++;
            webhookLogger.error('Failed to send notification to tenant', error, {
              tenantId: tenant.id,
              chatPlatformId: tenant.chat_platform_id
            });
          }
        }
      }

      webhookLogger.info('Announcement notifications processed', {
        announcementId: announcement.id,
        sent,
        failed,
        total: tenants.length
      });

    } catch (error) {
      webhookLogger.error('Error processing announcement webhook', error);
      throw error;
    }

    return { sent, failed };
  }
}

export const announcementsHandler = new AnnouncementsHandler();