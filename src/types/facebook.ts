// Facebook Webhook Event Types
export interface WebhookEvent {
  object: string;
  entry: Entry[];
}

export interface Entry {
  id: string;
  time: number;
  messaging?: MessagingEvent[];
}

export interface MessagingEvent {
  sender: { id: string };
  recipient: { id: string };
  timestamp: number;
  message?: IncomingMessage;
  postback?: Postback;
  delivery?: Delivery;
  read?: Read;
}

export interface IncomingMessage {
  mid: string;
  text?: string;
  quick_reply?: QuickReplyPayload;
  attachments?: Attachment[];
}

export interface QuickReplyPayload {
  payload: string;
}

export interface Postback {
  title?: string;
  payload: string;
  mid?: string;
}

export interface Delivery {
  mids: string[];
  watermark: number;
  seq: number;
}

export interface Read {
  watermark: number;
  seq: number;
}

export interface Attachment {
  type: 'image' | 'video' | 'audio' | 'file' | 'template' | 'fallback';
  payload: {
    url?: string;
    title?: string;
    sticker_id?: number;
    template_type?: string;
  };
}

// Outgoing Message Types
export interface OutgoingMessage {
  messaging_type?: 'RESPONSE' | 'UPDATE' | 'MESSAGE_TAG';
  recipient: {
    id: string;
  };
  message: MessageContent;
  tag?: string;
}

export interface MessageContent {
  text?: string;
  quick_replies?: QuickReply[];
  attachment?: MessageAttachment;
}

export interface QuickReply {
  content_type: 'text' | 'user_phone_number' | 'user_email';
  title?: string;
  payload?: string;
  image_url?: string;
}

export interface MessageAttachment {
  type: 'template' | 'image' | 'video' | 'audio' | 'file';
  payload: AttachmentPayload;
}

export interface AttachmentPayload {
  template_type?: 'generic' | 'button' | 'list';
  elements?: TemplateElement[];
  buttons?: Button[];
  image_url?: string;
  url?: string;
  is_reusable?: boolean;
}

export interface TemplateElement {
  title: string;
  subtitle?: string;
  image_url?: string;
  default_action?: DefaultAction;
  buttons?: Button[];
}

export interface DefaultAction {
  type: 'web_url';
  url: string;
  webview_height_ratio?: 'compact' | 'tall' | 'full';
  messenger_extensions?: boolean;
  fallback_url?: string;
}

export interface Button {
  type: 'postback' | 'web_url' | 'phone_number';
  title: string;
  payload?: string;
  url?: string;
  phone_number?: string;
  webview_height_ratio?: 'compact' | 'tall' | 'full';
  messenger_extensions?: boolean;
  fallback_url?: string;
}

// User Profile
export interface UserProfile {
  id: string;
  first_name?: string;
  last_name?: string;
  profile_pic?: string;
  locale?: string;
  timezone?: number;
  gender?: string;
}
