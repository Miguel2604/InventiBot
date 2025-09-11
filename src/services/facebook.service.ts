import axios from 'axios';
import { config } from '../config/env';
import {
  OutgoingMessage,
  MessageContent,
  QuickReply,
  UserProfile
} from '../types/facebook';

class FacebookService {
  private graphApiUrl = config.facebook.graphApiUrl;
  private accessToken = config.facebook.accessToken;

  /**
   * Send a message to a user
   */
  async sendMessage(recipientId: string, message: MessageContent): Promise<void> {
    const messageData: OutgoingMessage = {
      messaging_type: 'RESPONSE',
      recipient: { id: recipientId },
      message
    };

    try {
      await axios.post(
        `${this.graphApiUrl}/me/messages`,
        messageData,
        {
          params: { access_token: this.accessToken }
        }
      );
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }

  /**
   * Send a text message
   */
  async sendTextMessage(recipientId: string, text: string): Promise<void> {
    await this.sendMessage(recipientId, { text });
  }

  /**
   * Send a message with quick replies
   */
  async sendQuickReply(
    recipientId: string,
    text: string,
    quickReplies: Array<{ title: string; payload: string }>
  ): Promise<void> {
    const replies: QuickReply[] = quickReplies.map(qr => ({
      content_type: 'text',
      title: qr.title,
      payload: qr.payload
    }));

    await this.sendMessage(recipientId, {
      text,
      quick_replies: replies
    });
  }

  /**
   * Send typing indicator
   */
  async sendTypingOn(recipientId: string): Promise<void> {
    try {
      await axios.post(
        `${this.graphApiUrl}/me/messages`,
        {
          recipient: { id: recipientId },
          sender_action: 'typing_on'
        },
        {
          params: { access_token: this.accessToken }
        }
      );
    } catch (error) {
      console.error('Error sending typing indicator:', error);
    }
  }

  /**
   * Mark message as seen
   */
  async markSeen(recipientId: string): Promise<void> {
    try {
      await axios.post(
        `${this.graphApiUrl}/me/messages`,
        {
          recipient: { id: recipientId },
          sender_action: 'mark_seen'
        },
        {
          params: { access_token: this.accessToken }
        }
      );
    } catch (error) {
      console.error('Error marking message as seen:', error);
    }
  }

  /**
   * Get user profile information
   */
  async getUserProfile(userId: string): Promise<UserProfile | null> {
    try {
      const response = await axios.get(
        `${this.graphApiUrl}/${userId}`,
        {
          params: {
            fields: 'first_name,last_name,profile_pic,locale,timezone,gender',
            access_token: this.accessToken
          }
        }
      );
      return response.data;
    } catch (error) {
      console.error('Error getting user profile:', error);
      return null;
    }
  }

  /**
   * Set persistent menu
   */
  async setPersistentMenu(): Promise<void> {
    const menuData = {
      persistent_menu: [
        {
          locale: 'default',
          composer_input_disabled: false,
          call_to_actions: [
            {
              title: '🏠 Main Menu',
              type: 'postback',
              payload: 'MAIN_MENU'
            },
            {
              title: 'ℹ️ Building Info',
              type: 'postback',
              payload: 'FAQ_MAIN'
            },
            {
              title: '🔧 Report Issue',
              type: 'postback',
              payload: 'MAINTENANCE_REQUEST'
            },
            {
              title: '📅 Book Amenity',
              type: 'postback',
              payload: 'BOOK_AMENITY'
            }
          ]
        }
      ]
    };

    try {
      await axios.post(
        `${this.graphApiUrl}/me/messenger_profile`,
        menuData,
        {
          params: { access_token: this.accessToken }
        }
      );
      console.log('Persistent menu set successfully');
    } catch (error) {
      console.error('Error setting persistent menu:', error);
    }
  }

  /**
   * Set greeting message
   */
  async setGreeting(): Promise<void> {
    const greetingData = {
      greeting: [
        {
          locale: 'default',
          text: 'Hi {{user_first_name}}! 👋 Welcome to InventiBot, your building assistant. How can I help you today?'
        }
      ]
    };

    try {
      await axios.post(
        `${this.graphApiUrl}/me/messenger_profile`,
        greetingData,
        {
          params: { access_token: this.accessToken }
        }
      );
      console.log('Greeting set successfully');
    } catch (error) {
      console.error('Error setting greeting:', error);
    }
  }

  /**
   * Set get started button
   */
  async setGetStarted(): Promise<void> {
    const getStartedData = {
      get_started: {
        payload: 'GET_STARTED'
      }
    };

    try {
      await axios.post(
        `${this.graphApiUrl}/me/messenger_profile`,
        getStartedData,
        {
          params: { access_token: this.accessToken }
        }
      );
      console.log('Get started button set successfully');
    } catch (error) {
      console.error('Error setting get started button:', error);
    }
  }
}

export const facebookService = new FacebookService();
