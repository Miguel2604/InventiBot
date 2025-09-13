import { facebookService } from '../services/facebook.service';
import { supabaseAdmin } from '../config/supabase';
import { authService } from '../services/auth.service';

interface BookingSession {
  step: 'amenity' | 'date' | 'time' | 'confirmation';
  amenityId?: string;
  amenityName?: string;
  date?: string;
  startTime?: string;
  endTime?: string;
}

// Store booking sessions in memory
const sessions = new Map<string, BookingSession>();

export class BookingHandler {
  /**
   * Start amenity booking flow
   */
  async startBooking(senderId: string): Promise<void> {
    // Initialize session
    sessions.set(senderId, { step: 'amenity' });
    
    // Get user profile
    const profile = await authService.getUserProfile(senderId);
    if (!profile || !profile.unit_id) {
      await facebookService.sendTextMessage(
        senderId,
        '❌ Unable to book amenities. Please contact your property manager.'
      );
      return;
    }

    // Get amenities for the building (simplified - just show bookable ones)
    const { data: amenities, error } = await supabaseAdmin
      .from('amenities')
      .select('*')
      .eq('building_id', profile.units?.buildings?.id)
      .eq('is_bookable', true)
      .eq('is_active', true)
      .order('name');

    if (error || !amenities || amenities.length === 0) {
      await facebookService.sendTextMessage(
        senderId,
        '❌ No bookable amenities available at your building.'
      );
      sessions.delete(senderId);
      return;
    }

    // For demo, show simplified list
    const quickReplies = amenities.slice(0, 5).map(amenity => ({
      title: amenity.name,
      payload: `BOOK_SELECT_${amenity.id}`
    }));

    quickReplies.push({
      title: '❌ Cancel',
      payload: 'MAIN_MENU'
    });

    await facebookService.sendQuickReply(
      senderId,
      '📅 Which amenity would you like to book?',
      quickReplies
    );
  }

  /**
   * Handle amenity selection
   */
  async handleAmenitySelection(senderId: string, amenityId: string): Promise<void> {
    const session = sessions.get(senderId);
    if (!session || session.step !== 'amenity') {
      await this.startBooking(senderId);
      return;
    }

    // Get amenity details
    const { data: amenity } = await supabaseAdmin
      .from('amenities')
      .select('*')
      .eq('id', amenityId)
      .single();

    if (!amenity) {
      await facebookService.sendTextMessage(senderId, '❌ Invalid amenity selected.');
      await this.startBooking(senderId);
      return;
    }

    // Update session
    session.amenityId = amenityId;
    session.amenityName = amenity.name;
    session.step = 'date';
    sessions.set(senderId, session);

    // Show next 7 days as options
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      const dayName = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : 
        date.toLocaleDateString('en-US', { weekday: 'short' });
      const dateStr = date.toISOString().split('T')[0];
      
      dates.push({
        title: `${dayName} ${date.getMonth() + 1}/${date.getDate()}`,
        payload: `BOOK_DATE_${dateStr}`
      });
    }

    await facebookService.sendQuickReply(
      senderId,
      `📅 When would you like to book the ${amenity.name}?`,
      dates.slice(0, 11) // Facebook limit
    );
  }

  /**
   * Handle date selection
   */
  async handleDateSelection(senderId: string, date: string): Promise<void> {
    const session = sessions.get(senderId);
    if (!session || session.step !== 'date') {
      await this.startBooking(senderId);
      return;
    }

    session.date = date;
    session.step = 'time';
    sessions.set(senderId, session);

    // For demo, show simplified time slots
    const timeSlots = [
      { title: '🌅 Morning (9-11 AM)', payload: 'BOOK_TIME_09:00-11:00' },
      { title: '☀️ Noon (11 AM-1 PM)', payload: 'BOOK_TIME_11:00-13:00' },
      { title: '🌤️ Afternoon (2-4 PM)', payload: 'BOOK_TIME_14:00-16:00' },
      { title: '🌆 Evening (5-7 PM)', payload: 'BOOK_TIME_17:00-19:00' },
      { title: '🌙 Night (7-9 PM)', payload: 'BOOK_TIME_19:00-21:00' }
    ];

    await facebookService.sendQuickReply(
      senderId,
      '⏰ What time works best for you?',
      timeSlots
    );
  }

  /**
   * Handle time selection
   */
  async handleTimeSelection(senderId: string, timeRange: string): Promise<void> {
    const session = sessions.get(senderId);
    if (!session || session.step !== 'time') {
      await this.startBooking(senderId);
      return;
    }

    const [startTime, endTime] = timeRange.split('-');
    session.startTime = startTime;
    session.endTime = endTime;
    session.step = 'confirmation';
    sessions.set(senderId, session);

    // Format date for display
    const dateObj = new Date(session.date!);
    const dateDisplay = dateObj.toLocaleDateString('en-US', { 
      weekday: 'long', 
      month: 'long', 
      day: 'numeric' 
    });

    // Show confirmation
    const confirmMessage = `
📋 **Booking Summary**
Amenity: ${session.amenityName}
Date: ${dateDisplay}
Time: ${startTime} - ${endTime}

Ready to confirm your booking?`;

    await facebookService.sendQuickReply(
      senderId,
      confirmMessage,
      [
        { title: '✅ Confirm', payload: 'BOOK_CONFIRM_YES' },
        { title: '❌ Cancel', payload: 'BOOK_CONFIRM_NO' }
      ]
    );
  }

  /**
   * Submit the booking
   */
  async submitBooking(senderId: string): Promise<void> {
    const session = sessions.get(senderId);
    if (!session || session.step !== 'confirmation') {
      await facebookService.sendTextMessage(senderId, '❌ Session expired. Please start over.');
      await this.startBooking(senderId);
      return;
    }

    // Get user profile
    const profile = await authService.getUserProfile(senderId);
    if (!profile) {
      await facebookService.sendTextMessage(senderId, '❌ Unable to submit booking. Please try again.');
      sessions.delete(senderId);
      return;
    }

    // Create full datetime strings
    const startDateTime = `${session.date}T${session.startTime}:00`;
    const endDateTime = `${session.date}T${session.endTime}:00`;

    // For demo, we'll skip real conflict checking and just book it
    const { data: booking, error } = await supabaseAdmin
      .from('bookings')
      .insert({
        building_id: profile.units?.buildings?.id,
        amenity_id: session.amenityId,
        tenant_id: profile.id,
        start_time: startDateTime,
        end_time: endDateTime,
        status: 'confirmed'
      })
      .select()
      .single();

    if (error || !booking) {
      console.error('Error creating booking:', error);
      
      // For demo, show a nice error message
      if (error?.message?.includes('conflict')) {
        await facebookService.sendTextMessage(
          senderId,
          '❌ That time slot is already booked. Please try a different time.'
        );
      } else {
        await facebookService.sendTextMessage(
          senderId,
          '❌ Failed to create booking. Please try again or contact the office.'
        );
      }
    } else {
      // Success!
      const bookingRef = booking.id.substring(0, 6).toUpperCase();
      const dateObj = new Date(session.date!);
      const dateDisplay = dateObj.toLocaleDateString('en-US', { 
        weekday: 'long', 
        month: 'long', 
        day: 'numeric' 
      });
      
      await facebookService.sendTextMessage(
        senderId,
        `✅ Booking confirmed!

📅 ${session.amenityName}
📆 ${dateDisplay}
⏰ ${session.startTime} - ${session.endTime}
🎫 Confirmation: #${bookingRef}

You'll receive a reminder 1 hour before your booking. Enjoy!`
      );

      // Show next actions
      await facebookService.sendQuickReply(
        senderId,
        'What would you like to do next?',
        [
          { title: '🏠 Main Menu', payload: 'MAIN_MENU' },
          { title: '📅 Another Booking', payload: 'BOOK_AMENITY' },
          { title: '🔧 Report Issue', payload: 'MAINTENANCE_REQUEST' }
        ]
      );
    }

    // Clear session
    sessions.delete(senderId);
  }

  /**
   * Cancel booking flow
   */
  async cancelBooking(senderId: string): Promise<void> {
    sessions.delete(senderId);
    
    await facebookService.sendQuickReply(
      senderId,
      'Booking cancelled. How can I help you?',
      [
        { title: '🏠 Main Menu', payload: 'MAIN_MENU' },
        { title: '🔧 Report Issue', payload: 'MAINTENANCE_REQUEST' },
        { title: 'ℹ️ Building Info', payload: 'FAQ_MAIN' }
      ]
    );
  }

  /**
   * Handle booking-related payloads
   */
  async handlePayload(senderId: string, payload: string): Promise<void> {
    // Check for amenity selection
    if (payload.startsWith('BOOK_SELECT_')) {
      const amenityId = payload.replace('BOOK_SELECT_', '');
      await this.handleAmenitySelection(senderId, amenityId);
      return;
    }

    // Check for date selection
    if (payload.startsWith('BOOK_DATE_')) {
      const date = payload.replace('BOOK_DATE_', '');
      await this.handleDateSelection(senderId, date);
      return;
    }

    // Check for time selection
    if (payload.startsWith('BOOK_TIME_')) {
      const timeRange = payload.replace('BOOK_TIME_', '');
      await this.handleTimeSelection(senderId, timeRange);
      return;
    }

    // Check for confirmation
    if (payload === 'BOOK_CONFIRM_YES') {
      await this.submitBooking(senderId);
      return;
    }

    if (payload === 'BOOK_CONFIRM_NO') {
      await this.cancelBooking(senderId);
      return;
    }
  }

  /**
   * Show user's bookings (bonus feature for demo)
   */
  async showMyBookings(senderId: string): Promise<void> {
    const profile = await authService.getUserProfile(senderId);
    if (!profile) {
      await facebookService.sendTextMessage(senderId, '❌ Unable to fetch bookings.');
      return;
    }

    // Get upcoming bookings
    const { data: bookings } = await supabaseAdmin
      .from('bookings')
      .select(`
        *,
        amenities (name)
      `)
      .eq('tenant_id', profile.id)
      .eq('status', 'confirmed')
      .gte('start_time', new Date().toISOString())
      .order('start_time')
      .limit(3);

    if (!bookings || bookings.length === 0) {
      await facebookService.sendTextMessage(
        senderId,
        'You have no upcoming bookings. Would you like to book an amenity?'
      );
      await this.startBooking(senderId);
      return;
    }

    let message = '📅 Your Upcoming Bookings:\n\n';
    bookings.forEach(booking => {
      const date = new Date(booking.start_time);
      const dateStr = date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric' 
      });
      const timeStr = date.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit' 
      });
      message += `• ${booking.amenities.name} - ${dateStr} at ${timeStr}\n`;
    });

    await facebookService.sendTextMessage(senderId, message);
  }
}

export const bookingHandler = new BookingHandler();
