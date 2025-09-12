// Mocks for external dependencies

// Mock Supabase client
export const mockSupabase = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  neq: jest.fn().mockReturnThis(),
  gt: jest.fn().mockReturnThis(),
  gte: jest.fn().mockReturnThis(),
  lt: jest.fn().mockReturnThis(),
  lte: jest.fn().mockReturnThis(),
  single: jest.fn().mockReturnThis(),
  or: jest.fn().mockReturnThis(),
  rpc: jest.fn().mockReturnThis(),
  storage: {
    from: jest.fn().mockReturnThis(),
    upload: jest.fn(),
    download: jest.fn(),
    remove: jest.fn(),
    list: jest.fn(),
    getPublicUrl: jest.fn()
  },
  channel: jest.fn().mockReturnThis(),
  on: jest.fn().mockReturnThis(),
  subscribe: jest.fn().mockReturnThis(),
  unsubscribe: jest.fn()
};

// Mock axios
export const mockAxios = {
  post: jest.fn(),
  get: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
  patch: jest.fn()
};

// Mock Facebook service
export const mockFacebookService = {
  sendMessage: jest.fn().mockResolvedValue(undefined),
  sendTextMessage: jest.fn().mockResolvedValue(undefined),
  sendQuickReply: jest.fn().mockResolvedValue(undefined),
  sendTypingOn: jest.fn().mockResolvedValue(undefined),
  markSeen: jest.fn().mockResolvedValue(undefined),
  getUserProfile: jest.fn().mockResolvedValue({
    first_name: 'John',
    last_name: 'Doe',
    profile_pic: 'https://example.com/pic.jpg',
    locale: 'en_US',
    timezone: -5,
    gender: 'male'
  }),
  setPersistentMenu: jest.fn().mockResolvedValue(undefined),
  setGreeting: jest.fn().mockResolvedValue(undefined),
  sendButtonTemplate: jest.fn().mockResolvedValue(undefined),
  sendGenericTemplate: jest.fn().mockResolvedValue(undefined),
  sendMediaAttachment: jest.fn().mockResolvedValue(undefined)
};

// Mock Auth service
export const mockAuthService = {
  isAuthenticated: jest.fn(),
  validateAccessCode: jest.fn(),
  createSession: jest.fn(),
  getUserProfile: jest.fn(),
  disconnectUser: jest.fn(),
  getSession: jest.fn(),
  updateSession: jest.fn()
};

// Mock Node cache
export const mockNodeCache = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  has: jest.fn(),
  flushAll: jest.fn(),
  keys: jest.fn(),
  getTtl: jest.fn()
};

// Sample test data
export const testData = {
  // Sample user profile
  userProfile: {
    id: '123e4567-e89b-12d3-a456-426614174000',
    chat_platform_id: 'fb_user_123',
    full_name: 'John Doe',
    email: 'john@example.com',
    phone: '+1-555-0100',
    unit_id: 'unit_123',
    is_manager: false,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  },

  // Sample building
  building: {
    id: 'building_123',
    name: 'Sunset Towers',
    address: '123 Main St, City, State 12345',
    phone: '+1-555-0200',
    email: 'info@sunsettowers.com',
    manager_id: 'manager_123',
    created_at: '2024-01-01T00:00:00Z'
  },

  // Sample unit
  unit: {
    id: 'unit_123',
    building_id: 'building_123',
    unit_number: '101',
    floor: 1,
    bedrooms: 2,
    bathrooms: 1,
    square_feet: 1000,
    rent_amount: 2000,
    is_occupied: true
  },

  // Sample invite
  invite: {
    id: 'invite_123',
    building_id: 'building_123',
    unit_id: 'unit_123',
    full_name: 'John Doe',
    login_code: 'TEST123',
    status: 'pending',
    expires_at: '2025-01-01T00:00:00Z',
    created_by: 'admin_123',
    created_at: '2024-01-01T00:00:00Z'
  },

  // Sample maintenance request
  maintenanceRequest: {
    id: 'maint_123',
    building_id: 'building_123',
    unit_id: 'unit_123',
    tenant_id: '123e4567-e89b-12d3-a456-426614174000',
    category_id: 'cat_123',
    title: 'Leaking faucet',
    description: 'Kitchen faucet is dripping',
    urgency: 'medium',
    status: 'submitted',
    media_urls: [],
    created_at: '2024-01-01T00:00:00Z'
  },

  // Sample amenity
  amenity: {
    id: 'amenity_123',
    building_id: 'building_123',
    name: 'Swimming Pool',
    description: 'Olympic size swimming pool',
    is_bookable: true,
    is_active: true,
    hourly_rate: 0,
    max_booking_duration: 2,
    min_booking_duration: 1,
    booking_rules: {
      advance_booking_days: 7,
      cancellation_hours: 24
    },
    images: ['https://example.com/pool.jpg']
  },

  // Sample booking
  booking: {
    id: 'booking_123',
    building_id: 'building_123',
    amenity_id: 'amenity_123',
    tenant_id: '123e4567-e89b-12d3-a456-426614174000',
    start_time: '2024-01-15T10:00:00Z',
    end_time: '2024-01-15T12:00:00Z',
    status: 'confirmed',
    total_cost: 0,
    created_at: '2024-01-01T00:00:00Z'
  },

  // Sample FAQ
  faq: {
    id: 'faq_123',
    building_id: 'building_123',
    category: 'policies',
    subcategory: 'pets',
    question: 'What is the pet policy?',
    answer: 'Pets are welcome! Maximum 2 pets per unit.',
    keywords: ['pet', 'dog', 'cat', 'animal'],
    priority: 1,
    is_published: true,
    views_count: 10
  },

  // Sample webhook messages
  webhookMessage: {
    object: 'page',
    entry: [{
      id: 'PAGE_ID',
      time: 1234567890,
      messaging: [{
        sender: { id: 'fb_user_123' },
        recipient: { id: 'PAGE_ID' },
        timestamp: 1234567890,
        message: {
          mid: 'message_id',
          text: 'Hello'
        }
      }]
    }]
  },

  webhookPostback: {
    object: 'page',
    entry: [{
      id: 'PAGE_ID',
      time: 1234567890,
      messaging: [{
        sender: { id: 'fb_user_123' },
        recipient: { id: 'PAGE_ID' },
        timestamp: 1234567890,
        postback: {
          title: 'Main Menu',
          payload: 'MAIN_MENU'
        }
      }]
    }]
  },

  webhookQuickReply: {
    object: 'page',
    entry: [{
      id: 'PAGE_ID',
      time: 1234567890,
      messaging: [{
        sender: { id: 'fb_user_123' },
        recipient: { id: 'PAGE_ID' },
        timestamp: 1234567890,
        message: {
          mid: 'message_id',
          text: 'FAQ',
          quick_reply: {
            payload: 'FAQ_MAIN'
          }
        }
      }]
    }]
  }
};

// Helper function to reset all mocks
export const resetAllMocks = () => {
  jest.clearAllMocks();
  jest.resetAllMocks();
};

// Helper function to create mock data response
export const createMockDataResponse = (data: any, error: any = null) => {
  if (error) {
    return Promise.reject(error);
  }
  return Promise.resolve({ data, error: null });
};

// Helper function to setup Supabase mock chain
export const setupSupabaseMock = (returnData: any, isError: boolean = false) => {
  const response = isError 
    ? { data: null, error: returnData }
    : { data: returnData, error: null };
  
  mockSupabase.from.mockReturnThis();
  mockSupabase.select.mockReturnThis();
  mockSupabase.insert.mockReturnThis();
  mockSupabase.update.mockReturnThis();
  mockSupabase.delete.mockReturnThis();
  mockSupabase.eq.mockReturnThis();
  mockSupabase.single.mockResolvedValue(response);
  
  return mockSupabase;
};

// Mock Express request
export const createMockRequest = (options: any = {}) => ({
  body: options.body || {},
  params: options.params || {},
  query: options.query || {},
  headers: options.headers || {},
  get: jest.fn((header: string) => options.headers?.[header]),
  ...options
});

// Mock Express response
export const createMockExpressResponse = () => {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  res.sendStatus = jest.fn().mockReturnValue(res);
  res.end = jest.fn().mockReturnValue(res);
  return res;
};

// Mock Express next function
export const createMockNext = () => jest.fn();
