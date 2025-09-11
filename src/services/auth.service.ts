import { supabase, Tenant } from '../config/supabase';
import crypto from 'crypto';

class AuthService {
  /**
   * Check if a user is authenticated
   */
  async isAuthenticated(facebookId: string): Promise<{ authenticated: boolean; tenant?: Tenant }> {
    try {
      const { data: tenant, error } = await supabase
        .from('tenants')
        .select('*')
        .eq('facebook_id', facebookId)
        .eq('status', 'active')
        .single();

      if (error || !tenant) {
        return { authenticated: false };
      }

      return { authenticated: true, tenant };
    } catch (error) {
      console.error('Error checking authentication:', error);
      return { authenticated: false };
    }
  }

  /**
   * Validate an access code and register the tenant
   */
  async validateAccessCode(code: string, facebookId: string): Promise<{
    success: boolean;
    message: string;
    tenant?: Tenant;
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

      // Check if tenant already exists with this Facebook ID
      const { data: existingTenant } = await supabase
        .from('tenants')
        .select('*')
        .eq('facebook_id', facebookId)
        .single();

      let tenant: Tenant;

      if (existingTenant) {
        // Update existing tenant
        const { data: updatedTenant, error: updateError } = await supabase
          .from('tenants')
          .update({
            name: invite.full_name || existingTenant.name,
            unit_number: invite.units?.unit_number,
            building: invite.units?.buildings?.name,
            status: 'active',
            updated_at: new Date().toISOString()
          })
          .eq('id', existingTenant.id)
          .select()
          .single();

        if (updateError) {
          throw updateError;
        }

        tenant = updatedTenant;
      } else {
        // Create new tenant
        const { data: newTenant, error: createError } = await supabase
          .from('tenants')
          .insert({
            facebook_id: facebookId,
            name: invite.full_name,
            unit_number: invite.units?.unit_number,
            building: invite.units?.buildings?.name,
            status: 'active'
          })
          .select()
          .single();

        if (createError) {
          throw createError;
        }

        tenant = newTenant;
      }

      // Mark invite as accepted
      await supabase
        .from('invites')
        .update({ status: 'accepted' })
        .eq('id', invite.id);

      return {
        success: true,
        message: `✅ Welcome ${tenant.name || 'Resident'}! You're now registered for Unit ${tenant.unit_number} at ${tenant.building}.`,
        tenant,
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
   */
  async createSession(tenantId: number, facebookId: string): Promise<string> {
    try {
      const sessionToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24); // 24 hour session

      await supabase
        .from('tenant_sessions')
        .insert({
          tenant_id: tenantId,
          facebook_id: facebookId,
          session_token: sessionToken,
          expires_at: expiresAt.toISOString(),
          is_active: true
        });

      return sessionToken;
    } catch (error) {
      console.error('Error creating session:', error);
      throw error;
    }
  }

  /**
   * Get tenant information
   */
  async getTenantInfo(facebookId: string): Promise<Tenant | null> {
    try {
      const { data: tenant, error } = await supabase
        .from('tenants')
        .select('*')
        .eq('facebook_id', facebookId)
        .eq('status', 'active')
        .single();

      if (error) {
        console.error('Error fetching tenant info:', error);
        return null;
      }

      return tenant;
    } catch (error) {
      console.error('Error in getTenantInfo:', error);
      return null;
    }
  }

  /**
   * Suspend a tenant account
   */
  async suspendTenant(facebookId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('tenants')
        .update({ 
          status: 'suspended',
          updated_at: new Date().toISOString()
        })
        .eq('facebook_id', facebookId);

      return !error;
    } catch (error) {
      console.error('Error suspending tenant:', error);
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
