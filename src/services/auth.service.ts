import { supabase, Profile } from '../config/supabase';
import crypto from 'crypto';

class AuthService {
  /**
   * Check if a user is authenticated
   */
  async isAuthenticated(facebookId: string): Promise<{ authenticated: boolean; profile?: Profile }> {
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('chat_platform_id', facebookId)
        .single();

      if (error || !profile) {
        return { authenticated: false };
      }

      return { authenticated: true, profile };
    } catch (error) {
      console.error('Error checking authentication:', error);
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
    try {
      // Check if invite exists and is valid
      const { data: invite, error: inviteError } = await supabase
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

      if (inviteError || !invite) {
        return {
          success: false,
          message: '❌ Invalid or expired access code. Please contact your property manager.'
        };
      }

      // Check if invite has expired
      if (new Date(invite.expires_at) < new Date()) {
        // Mark invite as expired
        await supabase
          .from('invites')
          .update({ status: 'expired' })
          .eq('id', invite.id);

        return {
          success: false,
          message: '❌ This access code has expired. Please contact your property manager for a new code.'
        };
      }

      // Check if profile already exists with this Facebook ID
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('chat_platform_id', facebookId)
        .single();

      let profile: Profile;

      if (existingProfile) {
        // Update existing profile
        const { data: updatedProfile, error: updateError } = await supabase
          .from('profiles')
          .update({
            full_name: invite.full_name || existingProfile.full_name,
            unit_id: invite.unit_id,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingProfile.id)
          .select()
          .single();

        if (updateError) {
          throw updateError;
        }

        profile = updatedProfile;
      } else {
        // Create new profile with a generated auth user
        // Note: In production, you'd create an auth user properly
        const userId = crypto.randomUUID();
        
        const { data: newProfile, error: createError } = await supabase
          .from('profiles')
          .insert({
            id: userId,
            chat_platform_id: facebookId,
            full_name: invite.full_name,
            unit_id: invite.unit_id,
            is_manager: false
          })
          .select()
          .single();

        if (createError) {
          throw createError;
        }

        profile = newProfile;
      }

      // Mark invite as completed
      await supabase
        .from('invites')
        .update({ status: 'completed' })
        .eq('id', invite.id);

      return {
        success: true,
        message: `✅ Welcome ${profile.full_name || 'Resident'}! You're now registered for Unit ${invite.units?.unit_number} at ${invite.units?.buildings?.name}.`,
        profile,
        unit: invite.units,
        building: invite.units?.buildings
      };
    } catch (error) {
      console.error('Error validating access code:', error);
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
    console.log(`Session created for profile ${profileId} with Facebook ID ${facebookId}`);
  }

  /**
   * Get user profile information
   */
  async getUserProfile(facebookId: string): Promise<Profile | null> {
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select(`
          *,
          units (
            unit_number,
            buildings (
              name
            )
          )
        `)
        .eq('chat_platform_id', facebookId)
        .single();

      if (error) {
        console.error('Error fetching user profile:', error);
        return null;
      }

      return profile;
    } catch (error) {
      console.error('Error in getUserProfile:', error);
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

      return !error;
    } catch (error) {
      console.error('Error disconnecting user:', error);
      return false;
    }
  }

  /**
   * Log authentication attempt
   */
  async logAuthAttempt(facebookId: string, code: string, success: boolean): Promise<void> {
    try {
      // You could create an auth_logs table to track login attempts
      console.log(`Auth attempt - Facebook ID: ${facebookId}, Code: ${code.substring(0, 3)}***, Success: ${success}`);
    } catch (error) {
      console.error('Error logging auth attempt:', error);
    }
  }
}

export const authService = new AuthService();
