import { facebookService } from '../services/facebook.service';
import { supabaseAdmin } from '../config/supabase';

interface FAQCategory {
  title: string;
  emoji: string;
  payload: string;
  subcategories?: FAQCategory[];
  answer?: string;
}

// FAQ structure based on the requirements
const faqStructure: FAQCategory[] = [
  {
    title: 'Hours of Operation',
    emoji: '🕒',
    payload: 'FAQ_HOURS',
    subcategories: [
      {
        title: 'Pool',
        emoji: '🏊',
        payload: 'FAQ_HOURS_POOL',
        answer: 'The pool is open from 8:00 AM to 10:00 PM, Tuesday to Sunday. It is closed on Mondays for cleaning.'
      },
      {
        title: 'Gym',
        emoji: '🏋️',
        payload: 'FAQ_HOURS_GYM',
        answer: 'The gym is open 24/7 for all residents. Please use your key fob for access after 10:00 PM.'
      },
      {
        title: 'Office',
        emoji: '🏢',
        payload: 'FAQ_HOURS_OFFICE',
        answer: 'The management office is open Monday to Friday, 9:00 AM to 6:00 PM, and Saturday 10:00 AM to 2:00 PM. Closed on Sundays.'
      }
    ]
  },
  {
    title: 'Policies',
    emoji: '📜',
    payload: 'FAQ_POLICIES',
    subcategories: [
      {
        title: 'Pets',
        emoji: '🐕',
        payload: 'FAQ_POLICIES_PETS',
        answer: 'Pets are welcome! Maximum 2 pets per unit. Dogs must be under 50 lbs. All pets must be registered with the office.'
      },
      {
        title: 'Noise',
        emoji: '🔇',
        payload: 'FAQ_POLICIES_NOISE',
        answer: 'Quiet hours are from 10:00 PM to 8:00 AM. Please be respectful of your neighbors at all times.'
      },
      {
        title: 'Parking',
        emoji: '🚗',
        payload: 'FAQ_POLICIES_PARKING',
        answer: 'Each unit is assigned one parking spot. Guest parking is available on a first-come, first-served basis. Overnight guest parking requires a permit from the office.'
      }
    ]
  },
  {
    title: 'Waste & Recycling',
    emoji: '🗑️',
    payload: 'FAQ_WASTE',
    subcategories: [
      {
        title: 'Trash Collection',
        emoji: '🗑️',
        payload: 'FAQ_WASTE_TRASH',
        answer: 'Trash is collected Monday, Wednesday, and Friday. Please place bins at the curb by 7:00 AM on collection days.'
      },
      {
        title: 'Recycling',
        emoji: '♻️',
        payload: 'FAQ_WASTE_RECYCLING',
        answer: 'Recycling is collected every Tuesday. Accepted items: paper, cardboard, plastic bottles, glass, and aluminum cans.'
      },
      {
        title: 'Bulk Items',
        emoji: '📦',
        payload: 'FAQ_WASTE_BULK',
        answer: 'Bulk item pickup is available on the first Saturday of each month. Please schedule with the office at least 48 hours in advance.'
      }
    ]
  },
  {
    title: 'Access & Keys',
    emoji: '🔑',
    payload: 'FAQ_ACCESS',
    subcategories: [
      {
        title: 'Lost Key/Fob',
        emoji: '🔑',
        payload: 'FAQ_ACCESS_LOST',
        answer: 'Lost keys or fobs can be replaced at the office for a $50 fee. Temporary access can be arranged for emergencies.'
      },
      {
        title: 'Guest Access',
        emoji: '👥',
        payload: 'FAQ_ACCESS_GUEST',
        answer: 'Guests can be buzzed in through the intercom system. For extended stays, temporary access codes can be arranged through the office.'
      },
      {
        title: 'Emergency Access',
        emoji: '🚨',
        payload: 'FAQ_ACCESS_EMERGENCY',
        answer: 'For emergency lockouts after hours, call our 24/7 emergency line at (555) 123-4567. A fee may apply for after-hours service.'
      }
    ]
  }
];

export class FAQHandler {
  /**
   * Handle main FAQ menu
   */
  async handleMainMenu(senderId: string): Promise<void> {
    const quickReplies = faqStructure.map(category => ({
      title: `${category.emoji} ${category.title}`,
      payload: category.payload
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
  }

  /**
   * Handle FAQ category selection
   */
  async handleCategorySelection(senderId: string, payload: string): Promise<void> {
    // Find the selected category
    const category = faqStructure.find(cat => cat.payload === payload);
    
    if (!category) {
      await this.handleMainMenu(senderId);
      return;
    }

    if (category.subcategories && category.subcategories.length > 0) {
      // Show subcategories
      const quickReplies = category.subcategories.map(subcat => ({
        title: `${subcat.emoji} ${subcat.title}`,
        payload: subcat.payload
      }));

      // Add back options
      quickReplies.push(
        {
          title: '↩️ Back to FAQ',
          payload: 'FAQ_MAIN'
        },
        {
          title: '🏠 Main Menu',
          payload: 'MAIN_MENU'
        }
      );

      await facebookService.sendQuickReply(
        senderId,
        `${category.emoji} ${category.title} - Select an option:`,
        quickReplies
      );
    } else if (category.answer) {
      // Send the answer
      await this.sendAnswer(senderId, category.answer);
    }
  }

  /**
   * Handle subcategory selection
   */
  async handleSubcategorySelection(senderId: string, payload: string): Promise<void> {
    // Find the subcategory across all categories
    for (const category of faqStructure) {
      if (category.subcategories) {
        const subcategory = category.subcategories.find(sub => sub.payload === payload);
        if (subcategory && subcategory.answer) {
          await this.sendAnswer(senderId, subcategory.answer, category.payload);
          return;
        }
      }
    }

    // If not found, go back to main FAQ
    await this.handleMainMenu(senderId);
  }

  /**
   * Send an answer with follow-up options
   */
  private async sendAnswer(senderId: string, answer: string, parentPayload?: string): Promise<void> {
    try {
      // Send the answer
      await facebookService.sendTextMessage(senderId, answer);

      // Send follow-up quick replies
      const quickReplies = [];

      if (parentPayload) {
        quickReplies.push({
          title: '↩️ Back',
          payload: parentPayload
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

    // Check if it's a main category
    if (payload.startsWith('FAQ_') && !payload.includes('_', 4)) {
      await this.handleCategorySelection(senderId, payload);
      return;
    }

    // Check if it's a subcategory
    if (payload.startsWith('FAQ_')) {
      await this.handleSubcategorySelection(senderId, payload);
      return;
    }
    
    // Fallback to main menu for unknown payloads
    await this.handleMainMenu(senderId);
  }

  /**
   * Search FAQs from database (for future use with dynamic FAQs)
   */
  async searchFAQs(buildingId: string, searchTerm: string): Promise<any[]> {
    try {
      const { data, error } = await supabaseAdmin
        .from('faqs')
        .select('*')
        .eq('building_id', buildingId)
        .eq('is_active', true)
        .ilike('question', `%${searchTerm}%`)
        .order('order_index');

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
