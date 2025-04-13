// Ticketmaster API service for fetching public events
// API docs: https://developer.ticketmaster.com/products-and-docs/apis/discovery-api/v2/

// Import environment variable for the API key
import { TICKETMASTER_API_KEY } from '@env';

// Fallback API key in case environment variable is not available
const API_KEY = TICKETMASTER_API_KEY || 'GLGWMJroypcoT37LO63Ox09HKAOJlLJ3';

/**
 * Search for events using Ticketmaster API
 * @param {string} keyword - Search term
 * @param {number} latitude - Location latitude
 * @param {number} longitude - Location longitude
 * @param {number} radius - Search radius in miles
 * @param {number} size - Number of results to return
 * @returns {Promise<Array>} - Array of event objects
 */
export const searchEvents = async (keyword, latitude, longitude, radius = 25, size = 20) => {
  try {
    // Base URL for Ticketmaster API
    const baseUrl = 'https://app.ticketmaster.com/discovery/v2/events.json';
    
    // Build URL with query parameters
    const url = new URL(baseUrl);
    url.searchParams.append('apikey', API_KEY);
    
    if (keyword) {
      url.searchParams.append('keyword', keyword);
    }
    
    // Add location parameters if provided
    if (latitude && longitude) {
      url.searchParams.append('latlong', `${latitude},${longitude}`);
      url.searchParams.append('radius', radius);
      url.searchParams.append('unit', 'miles');
    }
    
    url.searchParams.append('size', size);
    url.searchParams.append('sort', 'date,asc');
    
    console.log('Fetching events from:', url.toString());
    
    // Make API request
    const response = await fetch(url.toString());
    
    if (!response.ok) {
      throw new Error(`API request failed with status: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Process response
    if (data._embedded && data._embedded.events) {
      // Map Ticketmaster events to our app's event format
      return data._embedded.events.map(event => ({
        id: `tm-${event.id}`, // Prepend 'tm-' to distinguish from our app's events
        title: event.name,
        description: event.info || event.description || 'No description available',
        location: event._embedded?.venues?.[0]?.name || 'Location not specified',
        event_date: event.dates?.start?.dateTime || new Date().toISOString(),
        latitude: parseFloat(event._embedded?.venues?.[0]?.location?.latitude) || null,
        longitude: parseFloat(event._embedded?.venues?.[0]?.location?.longitude) || null,
        image_url: event.images?.[0]?.url || null,
        is_open: true,
        is_external: true, // Flag to identify external events
        external_url: event.url, // Link to ticketmaster page
        source: 'Ticketmaster',
        // Add any other fields required by your app
      }));
    }
    
    return [];
  } catch (error) {
    console.error('Error fetching events from Ticketmaster:', error);
    return []; // Return empty array instead of throwing to prevent app crashes
  }
};

/**
 * Invite a user to an event
 * @param {string} eventId - The ID of the event
 * @param {string} inviteeId - The ID of the user to invite
 * @returns {Promise<object>} - The created invitation
 */
export const inviteUserToEvent = async (eventId, inviteeId) => {
  try {
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError) throw userError;
    if (!user) throw new Error('You must be logged in to send invitations');
    
    // Check if the user has permission to invite to this event
    const { data: eventData, error: eventError } = await supabase
      .from('events')
      .select('host_id, title')
      .eq('id', eventId)
      .single();
      
    if (eventError) throw eventError;
    if (!eventData) throw new Error('Event not found');
    
    // Only the event host can send invitations
    if (eventData.host_id !== user.id) {
      throw new Error('Only the event host can send invitations');
    }
    
    // Check if invitation already exists
    const { data: existingInvitation, error: checkError } = await supabase
      .from('event_invitations')
      .select('id, status')
      .eq('event_id', eventId)
      .eq('invitee_id', inviteeId)
      .single();
      
    if (checkError && checkError.code !== 'PGRST116') throw checkError;
    
    // If invitation exists, return it
    if (existingInvitation) {
      return {
        ...existingInvitation,
        already_invited: true
      };
    }
    
    // Create the invitation
    const { data: invitation, error: inviteError } = await supabase
      .from('event_invitations')
      .insert({
        event_id: eventId,
        inviter_id: user.id,
        invitee_id: inviteeId,
        status: 'pending'
      })
      .select()
      .single();
      
    if (inviteError) throw inviteError;
    
    return {
      ...invitation,
      already_invited: false,
      event_title: eventData.title
    };
  } catch (error) {
    console.error('Error inviting user to event:', error);
    throw error;
  }
};

/**
 * Respond to an event invitation
 * @param {string} invitationId - The ID of the invitation
 * @param {string} status - The response status ('accepted' or 'declined')
 * @returns {Promise<object>} - The updated invitation
 */
export const respondToEventInvitation = async (invitationId, status) => {
  try {
    if (!['accepted', 'declined'].includes(status)) {
      throw new Error('Invalid status. Must be "accepted" or "declined"');
    }
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError) throw userError;
    if (!user) throw new Error('You must be logged in to respond to invitations');
    
    // Get the invitation
    const { data: invitation, error: invitationError } = await supabase
      .from('event_invitations')
      .select('id, event_id, invitee_id, status')
      .eq('id', invitationId)
      .single();
      
    if (invitationError) throw invitationError;
    if (!invitation) throw new Error('Invitation not found');
    
    // Check if the current user is the invitee
    if (invitation.invitee_id !== user.id) {
      throw new Error('You can only respond to your own invitations');
    }
    
    // Update the invitation status
    const { data: updatedInvitation, error: updateError } = await supabase
      .from('event_invitations')
      .update({ status })
      .eq('id', invitationId)
      .select()
      .single();
      
    if (updateError) throw updateError;
    
    // If accepted, also add to event_attendees
    if (status === 'accepted') {
      const { error: attendeeError } = await supabase
        .from('event_attendees')
        .upsert({
          event_id: invitation.event_id,
          user_id: user.id
        });
        
      if (attendeeError) {
        console.error('Error adding to event attendees:', attendeeError);
        // Continue anyway, as the invitation was updated successfully
      }
    }
    
    return updatedInvitation;
  } catch (error) {
    console.error('Error responding to event invitation:', error);
    throw error;
  }
};

/**
 * Get event invitations for the current user
 * @param {string} status - Optional status filter ('pending', 'accepted', 'declined')
 * @returns {Promise<array>} - The invitations
 */
export const getEventInvitations = async (status = null) => {
  try {
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError) throw userError;
    if (!user) throw new Error('You must be logged in to view invitations');
    
    // Build the query
    let query = supabase
      .from('event_invitations')
      .select(`
        id, status, created_at, updated_at,
        events:event_id(id, title, description, location, event_date, image_url),
        inviters:inviter_id(id, name, email)
      `)
      .eq('invitee_id', user.id);
      
    // Apply status filter if provided
    if (status) {
      query = query.eq('status', status);
    }
    
    // Order by most recent first
    query = query.order('created_at', { ascending: false });
    
    const { data, error } = await query;
    
    if (error) throw error;
    
    return data;
  } catch (error) {
    console.error('Error getting event invitations:', error);
    throw error;
  }
}; 