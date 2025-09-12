import axios from 'axios';
import { FacebookService } from '../../../src/services/facebook.service';
import { config } from '../../../src/config/env';
import { mockAxios, resetAllMocks, testData } from '../../mocks';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('FacebookService', () => {
  let facebookService: FacebookService;

  beforeEach(() => {
    resetAllMocks();
    facebookService = new FacebookService();
    // Replace axios methods with mocks
    mockedAxios.post = mockAxios.post;
    mockedAxios.get = mockAxios.get;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('sendMessage', () => {
    it('should send a message successfully', async () => {
      mockAxios.post.mockResolvedValueOnce({ data: { success: true } });

      await facebookService.sendMessage('user123', { text: 'Hello' });

      expect(mockAxios.post).toHaveBeenCalledWith(
        `${config.facebook.graphApiUrl}/me/messages`,
        {
          messaging_type: 'RESPONSE',
          recipient: { id: 'user123' },
          message: { text: 'Hello' }
        },
        {
          params: { access_token: config.facebook.accessToken }
        }
      );
    });

    it('should throw error when API call fails', async () => {
      const error = new Error('API Error');
      mockAxios.post.mockRejectedValueOnce(error);

      await expect(
        facebookService.sendMessage('user123', { text: 'Hello' })
      ).rejects.toThrow('API Error');
    });

    it('should send message with attachments', async () => {
      mockAxios.post.mockResolvedValueOnce({ data: { success: true } });

      const attachment = {
        type: 'image',
        payload: {
          url: 'https://example.com/image.jpg',
          is_reusable: true
        }
      };

      await facebookService.sendMessage('user123', { attachment });

      expect(mockAxios.post).toHaveBeenCalledWith(
        `${config.facebook.graphApiUrl}/me/messages`,
        {
          messaging_type: 'RESPONSE',
          recipient: { id: 'user123' },
          message: { attachment }
        },
        {
          params: { access_token: config.facebook.accessToken }
        }
      );
    });
  });

  describe('sendTextMessage', () => {
    it('should send a text message', async () => {
      mockAxios.post.mockResolvedValueOnce({ data: { success: true } });

      await facebookService.sendTextMessage('user123', 'Hello World');

      expect(mockAxios.post).toHaveBeenCalledWith(
        `${config.facebook.graphApiUrl}/me/messages`,
        {
          messaging_type: 'RESPONSE',
          recipient: { id: 'user123' },
          message: { text: 'Hello World' }
        },
        {
          params: { access_token: config.facebook.accessToken }
        }
      );
    });

    it('should handle empty text', async () => {
      mockAxios.post.mockResolvedValueOnce({ data: { success: true } });

      await facebookService.sendTextMessage('user123', '');

      expect(mockAxios.post).toHaveBeenCalledWith(
        `${config.facebook.graphApiUrl}/me/messages`,
        {
          messaging_type: 'RESPONSE',
          recipient: { id: 'user123' },
          message: { text: '' }
        },
        {
          params: { access_token: config.facebook.accessToken }
        }
      );
    });
  });

  describe('sendQuickReply', () => {
    it('should send quick replies', async () => {
      mockAxios.post.mockResolvedValueOnce({ data: { success: true } });

      const quickReplies = [
        { title: 'Option 1', payload: 'OPTION_1' },
        { title: 'Option 2', payload: 'OPTION_2' }
      ];

      await facebookService.sendQuickReply('user123', 'Choose an option:', quickReplies);

      expect(mockAxios.post).toHaveBeenCalledWith(
        `${config.facebook.graphApiUrl}/me/messages`,
        {
          messaging_type: 'RESPONSE',
          recipient: { id: 'user123' },
          message: {
            text: 'Choose an option:',
            quick_replies: [
              { content_type: 'text', title: 'Option 1', payload: 'OPTION_1' },
              { content_type: 'text', title: 'Option 2', payload: 'OPTION_2' }
            ]
          }
        },
        {
          params: { access_token: config.facebook.accessToken }
        }
      );
    });

    it('should handle maximum 11 quick replies', async () => {
      mockAxios.post.mockResolvedValueOnce({ data: { success: true } });

      const quickReplies = Array.from({ length: 15 }, (_, i) => ({
        title: `Option ${i + 1}`,
        payload: `OPTION_${i + 1}`
      }));

      await facebookService.sendQuickReply('user123', 'Choose:', quickReplies);

      const call = mockAxios.post.mock.calls[0];
      const sentMessage = call[1].message;
      
      // Facebook limits to 11 quick replies
      expect(sentMessage.quick_replies).toHaveLength(11);
    });

    it('should handle empty quick replies array', async () => {
      mockAxios.post.mockResolvedValueOnce({ data: { success: true } });

      await facebookService.sendQuickReply('user123', 'No options', []);

      expect(mockAxios.post).toHaveBeenCalledWith(
        `${config.facebook.graphApiUrl}/me/messages`,
        {
          messaging_type: 'RESPONSE',
          recipient: { id: 'user123' },
          message: {
            text: 'No options',
            quick_replies: []
          }
        },
        {
          params: { access_token: config.facebook.accessToken }
        }
      );
    });
  });

  describe('sendTypingOn', () => {
    it('should send typing indicator', async () => {
      mockAxios.post.mockResolvedValueOnce({ data: { success: true } });

      await facebookService.sendTypingOn('user123');

      expect(mockAxios.post).toHaveBeenCalledWith(
        `${config.facebook.graphApiUrl}/me/messages`,
        {
          recipient: { id: 'user123' },
          sender_action: 'typing_on'
        },
        {
          params: { access_token: config.facebook.accessToken }
        }
      );
    });

    it('should handle typing indicator error silently', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      mockAxios.post.mockRejectedValueOnce(new Error('API Error'));

      await facebookService.sendTypingOn('user123');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error sending typing indicator:',
        expect.any(Error)
      );
      consoleErrorSpy.mockRestore();
    });
  });

  describe('markSeen', () => {
    it('should mark message as seen', async () => {
      mockAxios.post.mockResolvedValueOnce({ data: { success: true } });

      await facebookService.markSeen('user123');

      expect(mockAxios.post).toHaveBeenCalledWith(
        `${config.facebook.graphApiUrl}/me/messages`,
        {
          recipient: { id: 'user123' },
          sender_action: 'mark_seen'
        },
        {
          params: { access_token: config.facebook.accessToken }
        }
      );
    });

    it('should handle mark seen error silently', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      mockAxios.post.mockRejectedValueOnce(new Error('API Error'));

      await facebookService.markSeen('user123');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error marking message as seen:',
        expect.any(Error)
      );
      consoleErrorSpy.mockRestore();
    });
  });

  describe('getUserProfile', () => {
    it('should fetch user profile successfully', async () => {
      const profileData = {
        first_name: 'John',
        last_name: 'Doe',
        profile_pic: 'https://example.com/pic.jpg',
        locale: 'en_US',
        timezone: -5,
        gender: 'male'
      };

      mockAxios.get.mockResolvedValueOnce({ data: profileData });

      const result = await facebookService.getUserProfile('user123');

      expect(mockAxios.get).toHaveBeenCalledWith(
        `${config.facebook.graphApiUrl}/user123`,
        {
          params: {
            fields: 'first_name,last_name,profile_pic,locale,timezone,gender',
            access_token: config.facebook.accessToken
          }
        }
      );
      expect(result).toEqual(profileData);
    });

    it('should return null on error', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      mockAxios.get.mockRejectedValueOnce(new Error('API Error'));

      const result = await facebookService.getUserProfile('user123');

      expect(result).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error getting user profile:',
        expect.any(Error)
      );
      consoleErrorSpy.mockRestore();
    });

    it('should handle partial profile data', async () => {
      const partialProfile = {
        first_name: 'John',
        last_name: 'Doe'
        // Missing other fields
      };

      mockAxios.get.mockResolvedValueOnce({ data: partialProfile });

      const result = await facebookService.getUserProfile('user123');

      expect(result).toEqual(partialProfile);
    });
  });

  describe('setPersistentMenu', () => {
    it('should set persistent menu successfully', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      mockAxios.post.mockResolvedValueOnce({ data: { success: true } });

      await facebookService.setPersistentMenu();

      expect(mockAxios.post).toHaveBeenCalledWith(
        `${config.facebook.graphApiUrl}/me/messenger_profile`,
        expect.objectContaining({
          persistent_menu: expect.arrayContaining([
            expect.objectContaining({
              locale: 'default',
              composer_input_disabled: false,
              call_to_actions: expect.arrayContaining([
                expect.objectContaining({
                  title: '🏠 Main Menu',
                  type: 'postback',
                  payload: 'MAIN_MENU'
                })
              ])
            })
          ])
        }),
        {
          params: { access_token: config.facebook.accessToken }
        }
      );

      expect(consoleLogSpy).toHaveBeenCalledWith('Persistent menu set successfully');
      consoleLogSpy.mockRestore();
    });

    it('should handle error when setting persistent menu', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      mockAxios.post.mockRejectedValueOnce(new Error('API Error'));

      await facebookService.setPersistentMenu();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error setting persistent menu:',
        expect.any(Error)
      );
      consoleErrorSpy.mockRestore();
    });
  });

  describe('setGreeting', () => {
    it('should set greeting message successfully', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      mockAxios.post.mockResolvedValueOnce({ data: { success: true } });

      await facebookService.setGreeting();

      expect(mockAxios.post).toHaveBeenCalledWith(
        `${config.facebook.graphApiUrl}/me/messenger_profile`,
        expect.objectContaining({
          greeting: expect.arrayContaining([
            expect.objectContaining({
              locale: 'default',
              text: expect.stringContaining('Welcome to InventiBot')
            })
          ])
        }),
        {
          params: { access_token: config.facebook.accessToken }
        }
      );

      expect(consoleLogSpy).toHaveBeenCalledWith('Greeting set successfully');
      consoleLogSpy.mockRestore();
    });

    it('should handle error when setting greeting', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      mockAxios.post.mockRejectedValueOnce(new Error('API Error'));

      await facebookService.setGreeting();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error setting greeting:',
        expect.any(Error)
      );
      consoleErrorSpy.mockRestore();
    });
  });

  describe('sendButtonTemplate', () => {
    it('should send button template message', async () => {
      mockAxios.post.mockResolvedValueOnce({ data: { success: true } });

      const buttons = [
        {
          type: 'postback',
          title: 'Button 1',
          payload: 'BUTTON_1'
        },
        {
          type: 'web_url',
          title: 'Visit Website',
          url: 'https://example.com'
        }
      ];

      await facebookService.sendButtonTemplate('user123', 'Choose an action:', buttons);

      expect(mockAxios.post).toHaveBeenCalledWith(
        `${config.facebook.graphApiUrl}/me/messages`,
        {
          messaging_type: 'RESPONSE',
          recipient: { id: 'user123' },
          message: {
            attachment: {
              type: 'template',
              payload: {
                template_type: 'button',
                text: 'Choose an action:',
                buttons: buttons
              }
            }
          }
        },
        {
          params: { access_token: config.facebook.accessToken }
        }
      );
    });
  });

  describe('sendGenericTemplate', () => {
    it('should send generic template with cards', async () => {
      mockAxios.post.mockResolvedValueOnce({ data: { success: true } });

      const elements = [
        {
          title: 'Card 1',
          subtitle: 'Description 1',
          image_url: 'https://example.com/image1.jpg',
          buttons: [
            {
              type: 'postback',
              title: 'Select',
              payload: 'CARD_1'
            }
          ]
        },
        {
          title: 'Card 2',
          subtitle: 'Description 2',
          image_url: 'https://example.com/image2.jpg',
          buttons: [
            {
              type: 'postback',
              title: 'Select',
              payload: 'CARD_2'
            }
          ]
        }
      ];

      await facebookService.sendGenericTemplate('user123', elements);

      expect(mockAxios.post).toHaveBeenCalledWith(
        `${config.facebook.graphApiUrl}/me/messages`,
        {
          messaging_type: 'RESPONSE',
          recipient: { id: 'user123' },
          message: {
            attachment: {
              type: 'template',
              payload: {
                template_type: 'generic',
                elements: elements
              }
            }
          }
        },
        {
          params: { access_token: config.facebook.accessToken }
        }
      );
    });
  });

  describe('getStarted', () => {
    it('should set get started button', async () => {
      mockAxios.post.mockResolvedValueOnce({ data: { success: true } });

      await facebookService.setGetStarted();

      expect(mockAxios.post).toHaveBeenCalledWith(
        `${config.facebook.graphApiUrl}/me/messenger_profile`,
        {
          get_started: {
            payload: 'GET_STARTED'
          }
        },
        {
          params: { access_token: config.facebook.accessToken }
        }
      );
    });
  });
});
