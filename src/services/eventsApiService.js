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