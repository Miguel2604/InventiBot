import { facebookService } from '../services/facebook.service';
import { supabaseAdmin } from '../config/supabase';
import { authService } from '../services/auth.service';

interface FAQ {
  id: string;
  building_id: string | null;
  category: string;
  question: string;
  answer: string;
  keywords: string[];
  priority: number;
  is_published: boolean;
  views_count?: number;
  helpful_count?: number;
}

interface FAQSession {
  currentCategory?: string;
  faqList?: FAQ[];
}

// Store FAQ sessions in memory
const sessions = new Map<string, FAQSession>();

// Category emoji mapping
const categoryEmojis: { [key: string]: string } = {
  'Hours of Operation': '🕒',
  'Policies': '📜',
  'Waste & Recycling': '🗑️',
  'Access & Keys': '🔑',
  'Maintenance': '🔧',
  'Amenities': '🏊',
  'Payments': '💰',
  'Emergencies': '🚨',
  'General': 'ℹ️'
};

export class FAQHandler {
  /**
   * Get user's building ID from their profile
   */
  private async getUserBuildingId(senderId: string): Promise<string | null> {
    const profile = await authService.getUserProfile(senderId);
    return profile?.units?.buildings?.id || null;
  }

  /**
   * Handle main FAQ menu - show categories from database
   */
  async handleMainMenu(senderId: string): Promise<void> {
    try {
      const buildingId = await this.getUserBuildingId(senderId);
      
      // Get unique categories from database
      // First try building-specific, then fall back to global
      let query = supabaseAdmin
        .from('faqs')
        .select('category')
        .eq('is_published', true);

      // Get both building-specific and global FAQs
      if (buildingId) {
        query = query.or(`building_id.eq.${buildingId},building_id.is.null`);
      } else {
        query = query.is('building_id', null);
      }

      const { data: faqData, error } = await query;

      if (error) {
        console.error('Error fetching FAQ categories:', error);
        await facebookService.sendTextMessage(
          senderId,
          '❌ Unable to load FAQs. Please try again later.'
        );
        return;
      }

      // Get unique categories
      const categories = [...new Set(faqData?.map(f => f.category) || [])];
      
      if (categories.length === 0) {
        await facebookService.sendTextMessage(
          senderId,
          '📢 No FAQs available at the moment. Please contact the office for assistance.'
        );
        return;
      }

      // Sort categories by priority (using a predefined order)
      const categoryOrder = ['Emergencies', 'Hours of Operation', 'Policies', 'Maintenance', 
                            'Amenities', 'Payments', 'Waste & Recycling', 'Access & Keys', 'General'];
      categories.sort((a, b) => {
        const indexA = categoryOrder.indexOf(a);
        const indexB = categoryOrder.indexOf(b);
        if (indexA === -1) return 1;
        if (indexB === -1) return -1;
        return indexA - indexB;
      });

      // Create quick replies for categories (max 10 due to FB limit)
      const quickReplies = categories.slice(0, 10).map(category => ({
        title: `${categoryEmojis[category] || '📌'} ${category}`,
        payload: `FAQ_CAT_${category.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}`
      }));

      // Add back to main menu option
      quickReplies.push({
        title: '🏠 Back to Main',
        payload: 'MAIN_MENU'
      });

      await facebookService.sendQuickReply(
        senderId,
        'What information are you looking for? Please select a category:',
        quickReplies
      );
    } catch (error) {
      console.error('Error in handleMainMenu:', error);
      await facebookService.sendTextMessage(
        senderId,
        '❌ An error occurred. Please try again later.'
      );
    }
  }

  /**
   * Handle FAQ category selection - show FAQs from that category
   */
  async handleCategorySelection(senderId: string, categoryName: string): Promise<void> {
    try {
      const buildingId = await this.getUserBuildingId(senderId);
      
      // Get FAQs for this category
      let query = supabaseAdmin
        .from('faqs')
        .select('*')
        .eq('category', categoryName)
        .eq('is_published', true)
        .order('priority', { ascending: true });

      // Get both building-specific and global FAQs
      if (buildingId) {
        query = query.or(`building_id.eq.${buildingId},building_id.is.null`);
      } else {
        query = query.is('building_id', null);
      }

      const { data: faqs, error } = await query;

      if (error) {
        console.error('Error fetching FAQs for category:', error);
        await this.handleMainMenu(senderId);
        return;
      }

      if (!faqs || faqs.length === 0) {
        await facebookService.sendTextMessage(
          senderId,
          `No FAQs found for ${categoryName}. Please try another category.`
        );
        await this.handleMainMenu(senderId);
        return;
      }

      // Store FAQs in session for later retrieval
      sessions.set(senderId, { currentCategory: categoryName, faqList: faqs });

      // If only one FAQ, show it directly
      if (faqs.length === 1) {
        await this.sendAnswer(senderId, faqs[0].answer, faqs[0].question);
        return;
      }

      // Create quick replies for FAQs (max 9 to leave room for navigation)
      const quickReplies = faqs.slice(0, 9).map((faq, index) => {
        // Truncate question if too long for Facebook button
        const title = faq.question.length > 20 
          ? faq.question.substring(0, 17) + '...' 
          : faq.question;
        return {
          title,
          payload: `FAQ_ITEM_${index}`
        };
      });

      // Add navigation options
      quickReplies.push(
        {
          title: '↩️ Back to Categories',
          payload: 'FAQ_MAIN'
        },
        {
          title: '🏠 Main Menu',
          payload: 'MAIN_MENU'
        }
      );

      const emoji = categoryEmojis[categoryName] || '📌';
      await facebookService.sendQuickReply(
        senderId,
        `${emoji} ${categoryName} - Select a question:`,
        quickReplies
      );
    } catch (error) {
      console.error('Error in handleCategorySelection:', error);
      await this.handleMainMenu(senderId);
    }
  }

  /**
   * Handle individual FAQ item selection
   */
  async handleFAQItemSelection(senderId: string, itemIndex: number): Promise<void> {
    try {
      const session = sessions.get(senderId);
      if (!session || !session.faqList) {
        await this.handleMainMenu(senderId);
        return;
      }

      const faq = session.faqList[itemIndex];
      if (!faq) {
        await this.handleMainMenu(senderId);
        return;
      }

      // Send the answer with the question as context
      await this.sendAnswer(senderId, faq.answer, faq.question, session.currentCategory);

      // Update view count (optional, for analytics)
      await supabaseAdmin
        .from('faqs')
        .update({ views_count: (faq.views_count || 0) + 1 })
        .eq('id', faq.id);

    } catch (error) {
      console.error('Error in handleFAQItemSelection:', error);
      await this.handleMainMenu(senderId);
    }
  }

  /**
   * Send an answer with follow-up options
   */
  private async sendAnswer(senderId: string, answer: string, question?: string, category?: string): Promise<void> {
    try {
      // Format the response with the question for context
      let responseText = answer;
      if (question) {
        responseText = `💬 **${question}**\n\n${answer}`;
      }
      
      // Send the answer
      await facebookService.sendTextMessage(senderId, responseText);

      // Send follow-up quick replies
      const quickReplies = [];

      if (category) {
        quickReplies.push({
          title: '↩️ Back to ' + (category.length > 10 ? category.substring(0, 7) + '...' : category),
          payload: `FAQ_CAT_${category.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}`
        });
      }

      quickReplies.push(
        {
          title: '❓ Another Question',
          payload: 'FAQ_MAIN'
        },
        {
          title: '💬 Talk to Manager',
          payload: 'HANDOFF_REQUEST'
        },
        {
          title: '🏠 Main Menu',
          payload: 'MAIN_MENU'
        }
      );

      await facebookService.sendQuickReply(
        senderId,
        'Is there anything else I can help you with?',
        quickReplies
      );
    } catch (error) {
      console.error('Error sending answer:', error);
      // Silently fail but don't throw - the answer may have been sent even if follow-up fails
    }
  }

  /**
   * Handle any FAQ-related payload
   */
  async handlePayload(senderId: string, payload: string): Promise<void> {
    // Check if it's the main FAQ menu
    if (payload === 'FAQ_MAIN') {
      await this.handleMainMenu(senderId);
      return;
    }

    // Check if it's a category selection
    if (payload.startsWith('FAQ_CAT_')) {
      // Extract category name from payload
      const categoryKey = payload.replace('FAQ_CAT_', '');
      // Convert back from uppercase with underscores to original format
      // This is a simple reverse mapping - in production you might want a more robust solution
      const categoryName = categoryKey.replace(/_/g, ' ')
        .split(' ')
        .map(word => word.charAt(0) + word.slice(1).toLowerCase())
        .join(' ');
      
      // Special case handling for known categories
      const knownCategories: { [key: string]: string } = {
        'HOURS_OF_OPERATION': 'Hours of Operation',
        'WASTE_RECYCLING': 'Waste & Recycling',
        'ACCESS_KEYS': 'Access & Keys'
      };
      
      const finalCategoryName = knownCategories[categoryKey] || categoryName;
      await this.handleCategorySelection(senderId, finalCategoryName);
      return;
    }

    // Check if it's an FAQ item selection
    if (payload.startsWith('FAQ_ITEM_')) {
      const itemIndex = parseInt(payload.replace('FAQ_ITEM_', ''), 10);
      if (!isNaN(itemIndex)) {
        await this.handleFAQItemSelection(senderId, itemIndex);
        return;
      }
    }
    
    // Fallback to main menu for unknown payloads
    await this.handleMainMenu(senderId);
  }

  /**
   * Search FAQs from database by keyword
   */
  async searchFAQs(senderId: string, searchTerm: string): Promise<FAQ[]> {
    try {
      const buildingId = await this.getUserBuildingId(senderId);
      
      // Search in questions, answers, and keywords
      let query = supabaseAdmin
        .from('faqs')
        .select('*')
        .eq('is_published', true);

      // Get both building-specific and global FAQs
      if (buildingId) {
        query = query.or(`building_id.eq.${buildingId},building_id.is.null`);
      } else {
        query = query.is('building_id', null);
      }

      // Search in multiple fields
      const searchPattern = `%${searchTerm.toLowerCase()}%`;
      query = query.or(`question.ilike.${searchPattern},answer.ilike.${searchPattern}`);

      const { data, error } = await query
        .order('priority', { ascending: true })
        .limit(10);

      if (error) {
        console.error('Error searching FAQs:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in FAQ search:', error);
      return [];
    }
  }
}

export const faqHandler = new FAQHandler();
