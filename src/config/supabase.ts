import { createClient } from '@supabase/supabase-js';
import { config } from './env';

// Initialize Supabase client
export const supabase = createClient(
  config.supabase.url,
  config.supabase.anonKey
);

// Initialize admin client for operations that need elevated permissions
export const supabaseAdmin = createClient(
  config.supabase.url,
  config.supabase.serviceRoleKey
);

// Database types based on the schema
export interface Building {
  id: string;
  name: string;
  address?: string;
  created_at: string;
}

export interface Unit {
  id: string;
  building_id: string;
  unit_number: string;
  created_at: string;
}

export interface Invite {
  id: string;
  unit_id: string;
  full_name?: string;
  login_code: string;
  status: 'pending' | 'completed';
  created_at: string;
  expires_at: string;
}

export interface Profile {
  id: string;
  unit_id?: string;
  full_name?: string;
  phone_number?: string;
  is_manager: boolean;
  chat_platform_id?: string; // Facebook ID
  updated_at: string;
}

export interface Conversation {
  id: number;
  user_id: string;
  manager_id?: string;
  status: 'active' | 'handoff' | 'closed';
  created_at: string;
  updated_at: string;
}

export interface MaintenanceRequest {
  id: string;
  user_id: string;
  unit_id: string;
  ticket_number: number;
  category: 'Plumbing' | 'Electrical' | 'Appliance' | 'General';
  specific_issue: string;
  urgency: 'Low' | 'Medium' | 'High';
  status: 'Submitted' | 'Technician Assigned' | 'Completed' | 'Cancelled';
  created_at: string;
  updated_at: string;
}

export interface MaintenanceRequestMedia {
  id: string;
  request_id: string;
  file_path: string;
  created_at: string;
}

export interface Amenity {
  id: string;
  building_id: string;
  name: string;
  description?: string;
  image_url?: string;
  booking_duration_hours: number;
}

export interface Booking {
  id: string;
  user_id: string;
  amenity_id: string;
  start_time: string;
  end_time: string;
  status: 'Confirmed' | 'Cancelled';
  created_at: string;
}
