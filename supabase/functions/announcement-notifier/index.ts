// Supabase Edge Function for sending announcement notifications
// Deploy with: supabase functions deploy announcement-notifier

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface AnnouncementPayload {
  type: 'INSERT' | 'UPDATE'
  table: string
  record: {
    id: string
    building_id: string
    title: string
    content: string
    category: string | null
    priority: 'urgent' | 'high' | 'normal' | 'low'
    target_units: string[] | null
    is_published: boolean
    published_at: string
    expires_at: string | null
    created_by: string
  }
  old_record?: {
    is_published: boolean
  }
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const payload: AnnouncementPayload = await req.json()
    
    // Only process if announcement is being published
    const isNewlyPublished = 
      (payload.type === 'INSERT' && payload.record.is_published) ||
      (payload.type === 'UPDATE' && 
       payload.old_record?.is_published === false && 
       payload.record.is_published === true)
    
    if (!isNewlyPublished) {
      return new Response(
        JSON.stringify({ message: 'Announcement not newly published, skipping' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get webhook URL from environment
    const webhookUrl = Deno.env.get('CHATBOT_WEBHOOK_URL')
    const webhookSecret = Deno.env.get('WEBHOOK_SECRET') || 'default-secret'

    if (!webhookUrl) {
      console.error('CHATBOT_WEBHOOK_URL not configured')
      return new Response(
        JSON.stringify({ error: 'Webhook URL not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch affected tenants
    let query = supabase
      .from('profiles')
      .select('id, chat_platform_id, unit_id')
      .eq('building_id', payload.record.building_id)
      .eq('is_manager', false)
      .not('chat_platform_id', 'is', null)

    // Filter by target units if specified
    if (payload.record.target_units && payload.record.target_units.length > 0) {
      query = query.in('unit_id', payload.record.target_units)
    }

    const { data: tenants, error: tenantsError } = await query

    if (tenantsError) {
      console.error('Error fetching tenants:', tenantsError)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch tenants' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Found ${tenants?.length || 0} tenants to notify`)

    // Send webhook to chatbot
    const webhookPayload = {
      type: 'announcement.published',
      announcement: payload.record,
      building_id: payload.record.building_id,
      target_units: payload.record.target_units,
      timestamp: new Date().toISOString()
    }

    const webhookResponse = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-webhook-secret': webhookSecret
      },
      body: JSON.stringify(webhookPayload)
    })

    if (!webhookResponse.ok) {
      console.error('Webhook failed:', await webhookResponse.text())
      return new Response(
        JSON.stringify({ error: 'Webhook delivery failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const result = await webhookResponse.json()

    // Log the webhook attempt
    const { error: logError } = await supabase
      .from('announcement_webhook_logs')
      .insert({
        announcement_id: payload.record.id,
        webhook_type: 'published',
        response_status: webhookResponse.status,
        response_body: JSON.stringify(result)
      })

    if (logError) {
      console.error('Failed to log webhook:', logError)
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        tenants_notified: tenants?.length || 0,
        webhook_result: result 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Edge function error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})