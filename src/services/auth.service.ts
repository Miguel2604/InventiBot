import { supabase, supabaseAdmin, Profile } from '../config/supabase';
import crypto from 'crypto';
import { authLogger, dbLogger } from '../utils/logger';

class AuthService {
  /**
   * Check if a user is authenticated
   */
  async isAuthenticated(facebookId: string): Promise<{ authenticated: boolean; profile?: Profile }> {
    try {
      authLogger.debug('Checking authentication', { facebookId });
      
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*, building_id')
        .eq('chat_platform_id', facebookId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No rows found - this is expected for new users
          authLogger.debug('No profile found for user', { facebookId });
        } else {
          // Actual error
          dbLogger.dbLog('SELECT', 'profiles', false, error, { facebookId });
        }
        return { authenticated: false };
      }

      if (!profile) {
        authLogger.debug('No profile found', { facebookId });
        return { authenticated: false };
      }

      authLogger.info('User authenticated', { 
        facebookId, 
        profileId: profile.id,
        hasUnit: !!profile.unit_id 
      });
      return { authenticated: true, profile };
    } catch (error) {
      authLogger.error('Error checking authentication', error, { facebookId });
      return { authenticated: false };
    }
  }

  /**
   * Validate an access code and register the user
   */
  async validateAccessCode(code: string, facebookId: string): Promise<{
    success: boolean;
    message: string;
    profile?: Profile;
    unit?: any;
    building?: any;
  }> {
    authLogger.authLog('validate_code_start', facebookId, code);
    
    try {
      // Check if invite exists and is valid
      authLogger.debug('Querying invites table', { code: code.toUpperCase() });
      const { data: invite, error: inviteError } = await supabaseAdmin
        .from('invites')
        .select(`
          *,
          units (
            id,
            unit_number,
            building_id,
            buildings (
              id,
              name,
              address
            )
          )
        `)
        .eq('login_code', code.toUpperCase())
        .eq('status', 'pending')
        .single();

      if (inviteError) {
        dbLogger.dbLog('SELECT', 'invites', false, inviteError, { 
          code: code.substring(0, 3) + '***'
        });
        
        // Check for specific database errors
        if (inviteError.code === 'PGRST116') {
          authLogger.info('No matching invite found', { code: code.substring(0, 3) + '***' });
        } else if (inviteError.code === '42P17') {
          authLogger.error('RLS policy error - infinite recursion', inviteError);
          return {
            success: false,
            message: '❌ System configuration error. Please contact support.'
          };
        }
      }

      if (!invite) {
        // Let's check if the invite exists but with different status
        const { data: anyInvite } = await supabaseAdmin
          .from('invites')
          .select('id, login_code, status, expires_at')
          .eq('login_code', code.toUpperCase())
          .single();
        
        if (anyInvite) {
          authLogger.info('Invite found but not valid', { 
            status: anyInvite.status,
            expired: new Date(anyInvite.expires_at) < new Date()
          });
          
          if (anyInvite.status === 'claimed') {
            return {
              success: false,
              message: '❌ This access code has already been used. Please contact your property manager.'
            };
          } else if (anyInvite.status === 'expired' || new Date(anyInvite.expires_at) < new Date()) {
            return {
              success: false,
              message: '❌ This access code has expired. Please contact your property manager for a new code.'
            };
          }
        } else {
          authLogger.info('No invite exists with this code');
        }
      }

      if (inviteError || !invite) {
        return {
          success: false,
          message: '❌ Invalid or expired access code. Please contact your property manager.'
        };
      }

      // Check if invite has expired
      if (new Date(invite.expires_at) < new Date()) {
        authLogger.info('Invite has expired', { 
          code: code.substring(0, 3) + '***',
          expiredAt: invite.expires_at 
        });
        
        // Mark invite as expired
        const { error: updateError } = await supabaseAdmin
          .from('invites')
          .update({ status: 'expired' })
          .eq('id', invite.id);
          
        if (updateError) {
          dbLogger.dbLog('UPDATE', 'invites', false, updateError);
        }

        return {
          success: false,
          message: '❌ This access code has expired. Please contact your property manager for a new code.'
        };
      }

      // Check if profile already exists with this Facebook ID
      const { data: existingProfile } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('chat_platform_id', facebookId)
        .single();

      let profile: Profile;

      if (existingProfile) {
        authLogger.info('Updating existing profile', { 
          profileId: existingProfile.id,
          facebookId 
        });
        
        // Update existing profile
        const { data: updatedProfile, error: updateError } = await supabaseAdmin
          .from('profiles')
          .update({
            full_name: invite.full_name || existingProfile.full_name,
            unit_id: invite.unit_id,
            building_id: invite.units?.building_id,
            is_manager: false,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingProfile.id)
          .select()
          .single();

        if (updateError) {
          dbLogger.dbLog('UPDATE', 'profiles', false, updateError);
          throw updateError;
        }

        dbLogger.dbLog('UPDATE', 'profiles', true, null, { profileId: existingProfile.id });
        profile = updatedProfile;
      } else {
        // Create new profile with a generated auth user
        const userId = crypto.randomUUID();
        
        authLogger.info('Creating new profile', { 
          userId,
          facebookId,
          unitId: invite.unit_id 
        });
        
        const { data: newProfile, error: createError } = await supabaseAdmin
          .from('profiles')
          .insert({
            id: userId,
            chat_platform_id: facebookId,
            full_name: invite.full_name,
            unit_id: invite.unit_id,
            building_id: invite.units?.building_id,
            is_manager: false
          })
          .select()
          .single();

        if (createError) {
          dbLogger.dbLog('INSERT', 'profiles', false, createError);
          throw createError;
        }

        dbLogger.dbLog('INSERT', 'profiles', true, null, { profileId: userId });
        profile = newProfile;
      }

      // Mark invite as claimed with timestamp and claimed_by
      const { error: claimError } = await supabaseAdmin
        .from('invites')
        .update({ 
          status: 'claimed',
          claimed_at: new Date().toISOString(),
          claimed_by: profile.id
        })
        .eq('id', invite.id);
        
      if (claimError) {
        dbLogger.dbLog('UPDATE', 'invites', false, claimError);
        // Don't fail the whole process if we can't update the invite status
        authLogger.warn('Failed to mark invite as claimed', { inviteId: invite.id });
      } else {
        dbLogger.dbLog('UPDATE', 'invites', true, null, { inviteId: invite.id, status: 'claimed' });
      }

      // Update unit occupancy status
      if (invite.unit_id) {
        const { error: unitError } = await supabaseAdmin
          .from('units')
          .update({ is_occupied: true })
          .eq('id', invite.unit_id);
        
        if (unitError) {
          dbLogger.dbLog('UPDATE', 'units', false, unitError);
          authLogger.warn('Failed to update unit occupancy status', { unitId: invite.unit_id });
        } else {
          dbLogger.dbLog('UPDATE', 'units', true, null, { unitId: invite.unit_id, is_occupied: true });
          authLogger.info('Unit marked as occupied', { unitId: invite.unit_id });
        }
      }

      authLogger.authLog('validate_code_success', facebookId, code, true, {
        profileId: profile.id,
        unitNumber: invite.units?.unit_number,
        buildingName: invite.units?.buildings?.name
      });

      return {
        success: true,
        message: `✅ Welcome ${profile.full_name || 'Resident'}! You're now registered for Unit ${invite.units?.unit_number} at ${invite.units?.buildings?.name}.`,
        profile,
        unit: invite.units,
        building: invite.units?.buildings
      };
    } catch (error) {
      authLogger.authLog('validate_code_error', facebookId, code, false);
      authLogger.error('Error validating access code', error);
      return {
        success: false,
        message: '❌ An error occurred. Please try again later.'
      };
    }
  }

  /**
   * Create a session for authenticated user
   * Note: Sessions are now handled by the chatbot platform
   */
  async createSession(profileId: string, facebookId: string): Promise<void> {
    // Sessions are managed by the chat platform
    // This method is kept for compatibility but doesn't do anything
    authLogger.debug('Session created (managed by platform)', { profileId, facebookId });
  }

  /**
   * Get user profile information
   */
  async getUserProfile(facebookId: string): Promise<any | null> {
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select(`
          *,
          building_id,
          units (
            id,
            unit_number,
            buildings (
              id,
              name
            )
          )
        `)
        .eq('chat_platform_id', facebookId)
        .single();

      if (error) {
        dbLogger.dbLog('SELECT', 'profiles', false, error, { facebookId });
        return null;
      }

      authLogger.debug('User profile fetched', { 
        facebookId,
        profileId: profile?.id,
        hasUnit: !!profile?.unit_id 
      });
      return profile;
    } catch (error) {
      authLogger.error('Error in getUserProfile', error, { facebookId });
      return null;
    }
  }

  /**
   * Remove user's chat platform ID (effectively logging them out)
   */
  async disconnectUser(facebookId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ 
          chat_platform_id: null,
          updated_at: new Date().toISOString()
        })
        .eq('chat_platform_id', facebookId);

      if (error) {
        dbLogger.dbLog('UPDATE', 'profiles', false, error, { facebookId });
        return false;
      }
      
      authLogger.info('User disconnected', { facebookId });
      return true;
    } catch (error) {
      authLogger.error('Error disconnecting user', error, { facebookId });
      return false;
    }
  }

  /**
   * Log authentication attempt
   */
  async logAuthAttempt(facebookId: string, code: string, success: boolean): Promise<void> {
    try {
      // Log authentication attempt with masked code
      authLogger.authLog('auth_attempt', facebookId, code, success);
      
      // In production, you could also save this to an auth_logs table
      // for security auditing purposes
    } catch (error) {
      authLogger.error('Error logging auth attempt', error);
    }
  }
}

export const authService = new AuthService();
