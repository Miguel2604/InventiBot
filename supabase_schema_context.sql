-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.admin_activity_logs (
  id integer NOT NULL DEFAULT nextval('admin_activity_logs_id_seq'::regclass),
  admin_user_id integer,
  action text NOT NULL,
  resource_type text,
  resource_id text,
  details jsonb DEFAULT '{}'::jsonb,
  ip_address inet,
  user_agent text,
  timestamp timestamp with time zone DEFAULT now(),
  CONSTRAINT admin_activity_logs_pkey PRIMARY KEY (id),
  CONSTRAINT admin_activity_logs_admin_user_id_fkey FOREIGN KEY (admin_user_id) REFERENCES public.admin_users(id)
);
CREATE TABLE public.admin_sessions (
  id integer NOT NULL DEFAULT nextval('admin_sessions_id_seq'::regclass),
  admin_user_id integer,
  session_token text NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  ip_address inet,
  user_agent text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT admin_sessions_pkey PRIMARY KEY (id),
  CONSTRAINT admin_sessions_admin_user_id_fkey FOREIGN KEY (admin_user_id) REFERENCES public.admin_users(id)
);
CREATE TABLE public.admin_users (
  id integer NOT NULL DEFAULT nextval('admin_users_id_seq'::regclass),
  username text NOT NULL UNIQUE,
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  full_name text,
  role text DEFAULT 'admin'::text CHECK (role = ANY (ARRAY['super_admin'::text, 'admin'::text, 'manager'::text, 'viewer'::text])),
  permissions jsonb DEFAULT '{}'::jsonb,
  is_active boolean DEFAULT true,
  last_login timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT admin_users_pkey PRIMARY KEY (id)
);
CREATE TABLE public.alert_rules (
  id integer NOT NULL DEFAULT nextval('alert_rules_id_seq'::regclass),
  name text NOT NULL,
  condition_type text CHECK (condition_type = ANY (ARRAY['low_stock'::text, 'high_stock'::text, 'no_activity'::text, 'custom'::text])),
  conditions jsonb NOT NULL,
  actions jsonb NOT NULL,
  is_active boolean DEFAULT true,
  last_triggered timestamp with time zone,
  created_by integer,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT alert_rules_pkey PRIMARY KEY (id),
  CONSTRAINT alert_rules_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.admin_users(id)
);
CREATE TABLE public.amenities (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  building_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  image_url text,
  booking_duration_hours integer NOT NULL DEFAULT 2,
  CONSTRAINT amenities_pkey PRIMARY KEY (id),
  CONSTRAINT amenities_building_id_fkey FOREIGN KEY (building_id) REFERENCES public.buildings(id)
);
CREATE TABLE public.bookings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  amenity_id uuid NOT NULL,
  start_time timestamp with time zone NOT NULL,
  end_time timestamp with time zone NOT NULL,
  status USER-DEFINED NOT NULL DEFAULT 'Confirmed'::booking_status_type,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT bookings_pkey PRIMARY KEY (id),
  CONSTRAINT bookings_amenity_id_fkey FOREIGN KEY (amenity_id) REFERENCES public.amenities(id)
);
CREATE TABLE public.buildings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT buildings_pkey PRIMARY KEY (id)
);
CREATE TABLE public.categories (
  id integer NOT NULL DEFAULT nextval('categories_id_seq'::regclass),
  name text NOT NULL UNIQUE,
  description text,
  color text DEFAULT '#6366f1'::text,
  icon text DEFAULT 'package'::text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT categories_pkey PRIMARY KEY (id)
);
CREATE TABLE public.command_logs (
  id integer NOT NULL DEFAULT nextval('command_logs_id_seq'::regclass),
  tenant_id integer,
  facebook_id text NOT NULL,
  command text NOT NULL,
  parameters jsonb,
  success boolean DEFAULT true,
  error_message text,
  processing_time integer,
  ip_address inet,
  user_agent text,
  timestamp timestamp with time zone DEFAULT now(),
  CONSTRAINT command_logs_pkey PRIMARY KEY (id),
  CONSTRAINT command_logs_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
);
CREATE TABLE public.conversations (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  user_id uuid NOT NULL,
  manager_id uuid,
  status USER-DEFINED NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT conversations_pkey PRIMARY KEY (id)
);
CREATE TABLE public.inventory_transactions (
  id integer NOT NULL DEFAULT nextval('inventory_transactions_id_seq'::regclass),
  item_id integer,
  tenant_id integer,
  admin_user_id integer,
  transaction_type text NOT NULL CHECK (transaction_type = ANY (ARRAY['add'::text, 'subtract'::text, 'adjustment'::text, 'transfer'::text, 'audit'::text])),
  quantity_change integer NOT NULL,
  quantity_before integer NOT NULL,
  quantity_after integer NOT NULL,
  reason text,
  notes text,
  reference_id text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT inventory_transactions_pkey PRIMARY KEY (id),
  CONSTRAINT inventory_transactions_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.items(id),
  CONSTRAINT inventory_transactions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id),
  CONSTRAINT inventory_transactions_admin_user_id_fkey FOREIGN KEY (admin_user_id) REFERENCES public.admin_users(id)
);
CREATE TABLE public.invites (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  unit_id uuid NOT NULL,
  full_name text,
  login_code text NOT NULL UNIQUE,
  status USER-DEFINED NOT NULL DEFAULT 'pending'::invite_status_type,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + '30 days'::interval),
  CONSTRAINT invites_pkey PRIMARY KEY (id),
  CONSTRAINT invites_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.units(id)
);
CREATE TABLE public.items (
  id integer NOT NULL DEFAULT nextval('items_id_seq'::regclass),
  item_id text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  category_id integer,
  location_id integer,
  count integer DEFAULT 0 CHECK (count >= 0),
  min_threshold integer DEFAULT 0,
  max_threshold integer,
  unit text DEFAULT 'pieces'::text,
  cost_per_unit numeric,
  supplier text,
  barcode text,
  image_url text,
  tags ARRAY,
  metadata jsonb DEFAULT '{}'::jsonb,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT items_pkey PRIMARY KEY (id),
  CONSTRAINT items_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id),
  CONSTRAINT items_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id)
);
CREATE TABLE public.locations (
  id integer NOT NULL DEFAULT nextval('locations_id_seq'::regclass),
  name text NOT NULL,
  type text DEFAULT 'room'::text CHECK (type = ANY (ARRAY['building'::text, 'floor'::text, 'room'::text, 'storage'::text, 'other'::text])),
  parent_location_id integer,
  address text,
  description text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT locations_pkey PRIMARY KEY (id),
  CONSTRAINT locations_parent_location_id_fkey FOREIGN KEY (parent_location_id) REFERENCES public.locations(id)
);
CREATE TABLE public.maintenance_request_media (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL,
  file_path text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT maintenance_request_media_pkey PRIMARY KEY (id),
  CONSTRAINT maintenance_request_media_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.maintenance_requests(id)
);
CREATE TABLE public.maintenance_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  unit_id uuid NOT NULL,
  ticket_number bigint GENERATED ALWAYS AS IDENTITY NOT NULL UNIQUE,
  category USER-DEFINED NOT NULL,
  specific_issue text NOT NULL,
  urgency USER-DEFINED NOT NULL,
  status USER-DEFINED NOT NULL DEFAULT 'Submitted'::request_status_type,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT maintenance_requests_pkey PRIMARY KEY (id),
  CONSTRAINT maintenance_requests_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.units(id)
);
CREATE TABLE public.notifications (
  id integer NOT NULL DEFAULT nextval('notifications_id_seq'::regclass),
  type text NOT NULL CHECK (type = ANY (ARRAY['low_stock'::text, 'system'::text, 'maintenance'::text, 'custom'::text])),
  title text NOT NULL,
  message text NOT NULL,
  recipient_type text CHECK (recipient_type = ANY (ARRAY['tenant'::text, 'admin'::text, 'all'::text])),
  tenant_id integer,
  admin_user_id integer,
  data jsonb DEFAULT '{}'::jsonb,
  is_read boolean DEFAULT false,
  priority text DEFAULT 'normal'::text CHECK (priority = ANY (ARRAY['low'::text, 'normal'::text, 'high'::text, 'urgent'::text])),
  expires_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT notifications_pkey PRIMARY KEY (id),
  CONSTRAINT notifications_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id),
  CONSTRAINT notifications_admin_user_id_fkey FOREIGN KEY (admin_user_id) REFERENCES public.admin_users(id)
);
CREATE TABLE public.system_settings (
  key text NOT NULL,
  value jsonb NOT NULL,
  description text,
  updated_by integer,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT system_settings_pkey PRIMARY KEY (key),
  CONSTRAINT system_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.admin_users(id)
);
CREATE TABLE public.tenant_sessions (
  id integer NOT NULL DEFAULT nextval('tenant_sessions_id_seq'::regclass),
  tenant_id integer,
  facebook_id text NOT NULL,
  session_token text NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT tenant_sessions_pkey PRIMARY KEY (id),
  CONSTRAINT tenant_sessions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
);
CREATE TABLE public.tenants (
  id integer NOT NULL DEFAULT nextval('tenants_id_seq'::regclass),
  facebook_id text NOT NULL UNIQUE,
  name text,
  email text,
  phone text,
  unit_number text,
  building text,
  status text DEFAULT 'active'::text CHECK (status = ANY (ARRAY['active'::text, 'inactive'::text, 'suspended'::text])),
  preferences jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT tenants_pkey PRIMARY KEY (id)
);
CREATE TABLE public.units (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  building_id uuid NOT NULL,
  unit_number text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT units_pkey PRIMARY KEY (id),
  CONSTRAINT units_building_id_fkey FOREIGN KEY (building_id) REFERENCES public.buildings(id)
);