import { AuthService } from '../../../src/services/auth.service';
import { supabase } from '../../../src/config/supabase';
import { 
  mockSupabase, 
  setupSupabaseMock, 
  resetAllMocks, 
  testData,
  mockNodeCache 
} from '../../mocks';

// Mock Supabase
jest.mock('../../../src/config/supabase', () => ({
  supabase: mockSupabase
}));

// Mock crypto
jest.mock('crypto', () => ({
  randomUUID: jest.fn(() => '123e4567-e89b-12d3-a456-426614174000')
}));

// Mock node-cache
jest.mock('node-cache');

describe('AuthService', () => {
  let authService: AuthService;

  beforeEach(() => {
    resetAllMocks();
    authService = new AuthService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('isAuthenticated', () => {
    it('should return true when user is authenticated', async () => {
      setupSupabaseMock(testData.userProfile);

      const result = await authService.isAuthenticated('fb_user_123');

      expect(mockSupabase.from).toHaveBeenCalledWith('profiles');
      expect(mockSupabase.select).toHaveBeenCalledWith('*');
      expect(mockSupabase.eq).toHaveBeenCalledWith('chat_platform_id', 'fb_user_123');
      expect(mockSupabase.single).toHaveBeenCalled();
      
      expect(result).toEqual({
        authenticated: true,
        profile: testData.userProfile
      });
    });

    it('should return false when user is not found', async () => {
      setupSupabaseMock(null, true);

      const result = await authService.isAuthenticated('unknown_user');

      expect(result).toEqual({
        authenticated: false
      });
    });

    it('should handle database errors gracefully', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      mockSupabase.single.mockRejectedValueOnce(new Error('Database error'));

      const result = await authService.isAuthenticated('fb_user_123');

      expect(result).toEqual({
        authenticated: false
      });
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error checking authentication:',
        expect.any(Error)
      );
      consoleErrorSpy.mockRestore();
    });
  });

  describe('validateAccessCode', () => {
    it('should validate correct access code successfully', async () => {
      const inviteWithRelations = {
        ...testData.invite,
        units: {
          ...testData.unit,
          buildings: testData.building
        }
      };

      // Mock invite lookup
      mockSupabase.from.mockReturnThis();
      mockSupabase.select.mockReturnThis();
      mockSupabase.eq.mockReturnThis();
      mockSupabase.single.mockResolvedValueOnce({
        data: inviteWithRelations,
        error: null
      });

      // Mock profile check
      mockSupabase.from.mockReturnThis();
      mockSupabase.select.mockReturnThis();
      mockSupabase.eq.mockReturnThis();
      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116' }
      });

      // Mock profile creation
      mockSupabase.from.mockReturnThis();
      mockSupabase.insert.mockReturnThis();
      mockSupabase.select.mockReturnThis();
      mockSupabase.single.mockResolvedValueOnce({
        data: testData.userProfile,
        error: null
      });

      // Mock invite update
      mockSupabase.from.mockReturnThis();
      mockSupabase.update.mockReturnThis();
      mockSupabase.eq.mockResolvedValueOnce({
        data: null,
        error: null
      });

      const result = await authService.validateAccessCode('TEST123', 'fb_user_123');

      expect(result.success).toBe(true);
      expect(result.message).toContain('Welcome');
      expect(result.profile).toEqual(testData.userProfile);
      expect(result.unit).toEqual(inviteWithRelations.units);
      expect(result.building).toEqual(testData.building);
    });

    it('should reject invalid access code', async () => {
      setupSupabaseMock(null, true);

      const result = await authService.validateAccessCode('INVALID', 'fb_user_123');

      expect(result.success).toBe(false);
      expect(result.message).toContain('Invalid or expired access code');
    });

    it('should reject expired access code', async () => {
      const expiredInvite = {
        ...testData.invite,
        expires_at: '2020-01-01T00:00:00Z'
      };

      setupSupabaseMock(expiredInvite);

      // Mock invite update for marking as expired
      mockSupabase.from.mockReturnThis();
      mockSupabase.update.mockReturnThis();
      mockSupabase.eq.mockResolvedValueOnce({
        data: null,
        error: null
      });

      const result = await authService.validateAccessCode('TEST123', 'fb_user_123');

      expect(result.success).toBe(false);
      expect(result.message).toContain('access code has expired');
    });

    it('should update existing profile when user already exists', async () => {
      const inviteWithRelations = {
        ...testData.invite,
        units: {
          ...testData.unit,
          buildings: testData.building
        }
      };

      // Mock invite lookup
      mockSupabase.from.mockReturnThis();
      mockSupabase.select.mockReturnThis();
      mockSupabase.eq.mockReturnThis();
      mockSupabase.single.mockResolvedValueOnce({
        data: inviteWithRelations,
        error: null
      });

      // Mock existing profile lookup
      mockSupabase.from.mockReturnThis();
      mockSupabase.select.mockReturnThis();
      mockSupabase.eq.mockReturnThis();
      mockSupabase.single.mockResolvedValueOnce({
        data: testData.userProfile,
        error: null
      });

      // Mock profile update
      const updatedProfile = {
        ...testData.userProfile,
        full_name: 'Updated Name'
      };
      mockSupabase.from.mockReturnThis();
      mockSupabase.update.mockReturnThis();
      mockSupabase.eq.mockReturnThis();
      mockSupabase.select.mockReturnThis();
      mockSupabase.single.mockResolvedValueOnce({
        data: updatedProfile,
        error: null
      });

      // Mock invite update
      mockSupabase.from.mockReturnThis();
      mockSupabase.update.mockReturnThis();
      mockSupabase.eq.mockResolvedValueOnce({
        data: null,
        error: null
      });

      const result = await authService.validateAccessCode('TEST123', 'fb_user_123');

      expect(result.success).toBe(true);
      expect(result.profile).toEqual(updatedProfile);
    });

    it('should handle database errors during validation', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      mockSupabase.single.mockRejectedValueOnce(new Error('Database error'));

      const result = await authService.validateAccessCode('TEST123', 'fb_user_123');

      expect(result.success).toBe(false);
      expect(result.message).toContain('An error occurred');
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error validating access code:',
        expect.any(Error)
      );
      consoleErrorSpy.mockRestore();
    });

    it('should convert access code to uppercase', async () => {
      const inviteWithRelations = {
        ...testData.invite,
        units: {
          ...testData.unit,
          buildings: testData.building
        }
      };

      setupSupabaseMock(inviteWithRelations);

      // Mock profile creation flow
      mockSupabase.from.mockReturnThis();
      mockSupabase.select.mockReturnThis();
      mockSupabase.eq.mockReturnThis();
      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116' }
      });

      mockSupabase.from.mockReturnThis();
      mockSupabase.insert.mockReturnThis();
      mockSupabase.select.mockReturnThis();
      mockSupabase.single.mockResolvedValueOnce({
        data: testData.userProfile,
        error: null
      });

      mockSupabase.from.mockReturnThis();
      mockSupabase.update.mockReturnThis();
      mockSupabase.eq.mockResolvedValueOnce({
        data: null,
        error: null
      });

      await authService.validateAccessCode('test123', 'fb_user_123');

      expect(mockSupabase.eq).toHaveBeenCalledWith('login_code', 'TEST123');
    });
  });

  describe('createSession', () => {
    it('should create a session', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      await authService.createSession('profile_123', 'fb_user_123');

      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Session created for profile profile_123 with Facebook ID fb_user_123'
      );
      consoleLogSpy.mockRestore();
    });
  });

  describe('getUserProfile', () => {
    it('should fetch user profile with relations', async () => {
      const profileWithRelations = {
        ...testData.userProfile,
        units: {
          ...testData.unit,
          buildings: testData.building
        }
      };

      setupSupabaseMock(profileWithRelations);

      const result = await authService.getUserProfile('fb_user_123');

      expect(mockSupabase.from).toHaveBeenCalledWith('profiles');
      expect(mockSupabase.select).toHaveBeenCalledWith(expect.stringContaining('units'));
      expect(mockSupabase.eq).toHaveBeenCalledWith('chat_platform_id', 'fb_user_123');
      expect(result).toEqual(profileWithRelations);
    });

    it('should return null when profile not found', async () => {
      setupSupabaseMock(null, true);

      const result = await authService.getUserProfile('unknown_user');

      expect(result).toBeNull();
    });

    it('should handle database errors', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      mockSupabase.single.mockRejectedValueOnce(new Error('Database error'));

      const result = await authService.getUserProfile('fb_user_123');

      expect(result).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error in getUserProfile:',
        expect.any(Error)
      );
      consoleErrorSpy.mockRestore();
    });
  });

  describe('disconnectUser', () => {
    it('should disconnect user successfully', async () => {
      mockSupabase.from.mockReturnThis();
      mockSupabase.update.mockReturnThis();
      mockSupabase.eq.mockResolvedValueOnce({
        data: null,
        error: null
      });

      const result = await authService.disconnectUser('fb_user_123');

      expect(mockSupabase.from).toHaveBeenCalledWith('profiles');
      expect(mockSupabase.update).toHaveBeenCalledWith({ chat_platform_id: null });
      expect(mockSupabase.eq).toHaveBeenCalledWith('chat_platform_id', 'fb_user_123');
      expect(result).toBe(true);
    });

    it('should return false on error', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      mockSupabase.from.mockReturnThis();
      mockSupabase.update.mockReturnThis();
      mockSupabase.eq.mockResolvedValueOnce({
        data: null,
        error: new Error('Database error')
      });

      const result = await authService.disconnectUser('fb_user_123');

      expect(result).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error disconnecting user:',
        expect.any(Error)
      );
      consoleErrorSpy.mockRestore();
    });
  });

  describe('getSession', () => {
    it('should retrieve session from cache', async () => {
      const sessionData = {
        userId: 'user_123',
        buildingId: 'building_123',
        unitId: 'unit_123'
      };

      mockNodeCache.get.mockReturnValue(sessionData);

      const session = await authService.getSession('fb_user_123');

      expect(session).toEqual(sessionData);
    });

    it('should return null when session not found', async () => {
      mockNodeCache.get.mockReturnValue(undefined);

      const session = await authService.getSession('fb_user_123');

      expect(session).toBeNull();
    });

    it('should refresh expired session from database', async () => {
      mockNodeCache.get.mockReturnValue(undefined);

      const profileWithRelations = {
        ...testData.userProfile,
        units: {
          ...testData.unit,
          buildings: testData.building
        }
      };

      setupSupabaseMock(profileWithRelations);

      const session = await authService.getSession('fb_user_123');

      expect(mockSupabase.from).toHaveBeenCalledWith('profiles');
      expect(session).toBeDefined();
    });
  });

  describe('updateSession', () => {
    it('should update session in cache', async () => {
      const sessionData = {
        userId: 'user_123',
        buildingId: 'building_123',
        unitId: 'unit_123'
      };

      mockNodeCache.set.mockReturnValue(true);

      const result = await authService.updateSession('fb_user_123', sessionData);

      expect(mockNodeCache.set).toHaveBeenCalledWith(
        'session_fb_user_123',
        sessionData,
        expect.any(Number)
      );
      expect(result).toBe(true);
    });
  });

  describe('clearSession', () => {
    it('should clear session from cache', async () => {
      mockNodeCache.del.mockReturnValue(1);

      const result = await authService.clearSession('fb_user_123');

      expect(mockNodeCache.del).toHaveBeenCalledWith('session_fb_user_123');
      expect(result).toBe(true);
    });

    it('should return false when session not found', async () => {
      mockNodeCache.del.mockReturnValue(0);

      const result = await authService.clearSession('fb_user_123');

      expect(result).toBe(false);
    });
  });

  describe('validateInviteCode', () => {
    it('should validate invite code format', () => {
      expect(authService.validateInviteCodeFormat('TEST123')).toBe(true);
      expect(authService.validateInviteCodeFormat('ABC456')).toBe(true);
      expect(authService.validateInviteCodeFormat('test')).toBe(false);
      expect(authService.validateInviteCodeFormat('12345678')).toBe(false);
      expect(authService.validateInviteCodeFormat('')).toBe(false);
    });
  });

  describe('generateInviteCode', () => {
    it('should generate valid invite code', () => {
      const code = authService.generateInviteCode();
      
      expect(code).toMatch(/^[A-Z0-9]{6,8}$/);
      expect(code.length).toBeGreaterThanOrEqual(6);
      expect(code.length).toBeLessThanOrEqual(8);
    });

    it('should generate unique codes', () => {
      const codes = new Set();
      for (let i = 0; i < 10; i++) {
        codes.add(authService.generateInviteCode());
      }
      
      expect(codes.size).toBe(10);
    });
  });
});
