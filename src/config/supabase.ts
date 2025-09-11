import { createClient } from '@supabase/supabase-js';
import { config } from './env';

// Initialize Supabase client
export const supabase = createClient(
  config.supabase.url,
  config.supabase.anonKey
);

// Database types based on the schema
export interface Building {
  id: string;
  name: string;
  address?: string;
  created_at: string;
}

export interface User {
  id: string;
  facebook_id?: string;
  full_name?: string;
  unit_id?: string;
  email?: string;
  phone?: string;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface FAQ {
  id: string;
  building_id: string;
  category: string;
  question: string;
  answer: string;
  order_index?: number;
  is_active: boolean;
  created_at: string;
}

export interface Conversation {
  id: number;
  user_id: string;
  manager_id?: string;
  status: 'active' | 'resolved' | 'handoff';
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: number;
  conversation_id: number;
  sender_type: 'user' | 'bot' | 'manager';
  sender_id?: string;
  message: string;
  metadata?: any;
  created_at: string;
}
