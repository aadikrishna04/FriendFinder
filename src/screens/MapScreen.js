import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Platform,
  StatusBar,
  Alert,
  Image,
  Modal,
  ScrollView,
  ActivityIndicator,
  TextInput,
  SafeAreaView,
  FlatList,
  TouchableWithoutFeedback,
  LogBox
} from "react-native";
import MapView, { Marker } from "react-native-maps";
import { supabase } from "../services/supabaseClient";
import { searchEvents } from "../services/eventsApiService";
import { COLORS, SPACING, FONT_SIZES } from "../constants";
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { Header } from "../components";
import * as Location from 'expo-location';

// Ignore specific warnings
LogBox.ignoreLogs([
  'VirtualizedLists should never be nested inside plain ScrollViews',
  'Animated: `useNativeDriver` was not specified'
]);

const { height, width } = Dimensions.get("window");

const MapScreen = ({ navigation }) => {
  const [events, setEvents] = useState([]);
  const [externalEvents, setExternalEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const [user, setUser] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showDrawer, setShowDrawer] = useState(false);
  const [attending, setAttending] = useState(false);
  const [loadingAttendance, setLoadingAttendance] = useState(false);
  const [hostInfo, setHostInfo] = useState(null);
  const [attendees, setAttendees] = useState([]);
  const [eventsAtLocation, setEventsAtLocation] = useState([]);
  const [showLocationSelector, setShowLocationSelector] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [region, setRegion] = useState({
    latitude: 38.9869,
    longitude: -76.9426,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  });
  const mapRef = useRef(null);
  const searchInputRef = useRef(null);
  const [locationName, setLocationName] = useState("New York");
  const [eventsNearby, setEventsNearby] = useState(0);
  const [profileImage, setProfileImage] = useState(null);
  const [searchRadius, setSearchRadius] = useState(20);
  const [userLocation, setUserLocation] = useState(null);

  // Get user location on component mount
  useEffect(() => {
    const getUserLocation = async () => {
      try {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          console.log('Permission to access location was denied');
          return;
        }

        let location = await Location.getCurrentPositionAsync({});
        setUserLocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude
        });

        // Update the map region to center on user location
        setRegion({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          latitudeDelta: 0.0922,
          longitudeDelta: 0.0421,
        });

        // Get reverse geocoding to display city name
        const geocode = await Location.reverseGeocodeAsync({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude
        });

        if (geocode && geocode.length > 0) {
          const { city, region } = geocode[0];
          setLocationName(city || region || "Current Location");
        }
      } catch (error) {
        console.error('Error getting location:', error);
      }
    };

    getUserLocation();
  }, []);

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      
      if (user) {
        // Get profile image
        const { data: profileData } = await supabase
          .from('profiles')
          .select('avatar_url')
          .eq('id', user.id)
          .single();
          
        if (profileData && profileData.avatar_url) {
          setProfileImage(profileData.avatar_url);
        }
      }
      
      return user;
    };

    const loadEvents = async () => {
      setLoading(true);
      try {
        const currentUser = await getUser();
        
        if (currentUser) {
          // Fetch events
          const { data, error } = await supabase
            .from('events')
            .select('*');
            
          if (error) throw error;
          
          setEvents(data || []);
        }
        
        // Load Ticketmaster events for the initial view
        loadTicketmasterEvents();
      } catch (error) {
        console.error('Error loading events:', error);
        Alert.alert('Error', 'Failed to load events');
      } finally {
        setLoading(false);
      }
    };

    loadEvents();
    
    // Refresh events when the screen comes into focus
    const unsubscribe = navigation.addListener('focus', loadEvents);
    return unsubscribe;
  }, [navigation]);

  // Load Ticketmaster events when user location or radius changes
  useEffect(() => {
    if (userLocation) {
      loadTicketmasterEvents();
    }
  }, [userLocation, searchRadius]);

  // Load Ticketmaster events based on current location and search radius
  const loadTicketmasterEvents = async () => {
    if (!userLocation) return;
    
    setSearchLoading(true);
    try {
      const results = await searchEvents(
        '', // Empty search to get all events
        userLocation.latitude,
        userLocation.longitude,
        searchRadius // Use the current search radius
      );
      
      console.log(`Found ${results.length} Ticketmaster events within ${searchRadius} miles`);
      setExternalEvents(results);
    } catch (error) {
      console.error('Error loading Ticketmaster events:', error);
    } finally {
      setSearchLoading(false);
    }
  };

  // Calculate nearby events
  useEffect(() => {
    // Count all events within the search radius of user location
    const nearby = [...events, ...externalEvents].filter(event => {
      if (!event.latitude || !event.longitude || !userLocation) return false;
      
      // Calculate distance between event and user location
      const distance = calculateDistance(
        userLocation.latitude,
        userLocation.longitude,
        event.latitude,
        event.longitude
      );
      
      return distance <= searchRadius;
    });
    
    setEventsNearby(nearby.length);
  }, [events, externalEvents, userLocation, searchRadius]);

  // Calculate distance in miles between two coordinates
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 3958.8; // Earth's radius in miles
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;
    return distance;
  };

  const toRad = (value) => {
    return value * Math.PI / 180;
  };

  // Handle radius change from the header
  const handleRadiusChange = (newRadius) => {
    setSearchRadius(newRadius);
  };

  // Function to handle searching external events
  const handleSearch = async () => {
    if (!searchQuery.trim() || !userLocation) {
      // If search is empty, just load all events within radius
      loadTicketmasterEvents();
      return;
    }
    
    setSearchLoading(true);
    try {
      const results = await searchEvents(
        searchQuery,
        userLocation.latitude,
        userLocation.longitude,
        searchRadius
      );
      
      console.log(`Found ${results.length} events for "${searchQuery}" within ${searchRadius} miles`);
      setExternalEvents(results);
      
      // Zoom map to fit all events if there are results
      if (results.length > 0 && mapRef.current) {
        // Find events with valid coordinates
        const validLocations = results
          .filter(event => event.latitude && event.longitude)
          .map(event => ({
            latitude: event.latitude,
            longitude: event.longitude
          }));
          
        if (validLocations.length > 0) {
          mapRef.current.fitToCoordinates(validLocations, {
            edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
            animated: true
          });
        }
      }
    } catch (error) {
      console.error('Error searching for events:', error);
      Alert.alert('Search Error', 'Failed to search for events. Please try again.');
    } finally {
      setSearchLoading(false);
    }
  };

  // Calculate clusters based on current region
  const getClusters = () => {
    // Skip if no events
    if (events.length === 0 && externalEvents.length === 0) return {};
    
    // Combine internal and external events
    const allEvents = [...events, ...externalEvents];
    
    // Calculate the pixel distance threshold for clustering based on zoom
    // The smaller the latitudeDelta (more zoomed in), the smaller the threshold
    const pixelDistanceThreshold = Math.max(30, 100 * region.latitudeDelta); // Adjust these numbers to control clustering sensitivity
    
    // First pass: assign all events to their exact location
    const exactLocations = {};
    allEvents.forEach(event => {
      if (!event.latitude || !event.longitude) return;
      
      const locationKey = `${event.latitude.toFixed(6)},${event.longitude.toFixed(6)}`;
      if (!exactLocations[locationKey]) {
        exactLocations[locationKey] = {
          events: [],
          center: {
            latitude: event.latitude,
            longitude: event.longitude
          }
        };
      }
      exactLocations[locationKey].events.push(event);
    });
    
    // Second pass: merge locations that would visually overlap when displayed
    const clusters = {};
    const clusterKeys = Object.keys(exactLocations);
    
    // If zoomed in enough, just use exact locations without merging
    if (region.latitudeDelta < 0.005) {
      return exactLocations;
    }
    
    // Function to calculate rough screen distance between two points
    // This is not exact but gives a good approximation for clustering purposes
    const calculateScreenDistance = (lat1, lon1, lat2, lon2) => {
      // Calculate approximate pixel distance based on latitude difference
      const latDistance = Math.abs(lat1 - lat2) / region.latitudeDelta * height;
      const lonDistance = Math.abs(lon1 - lon2) / region.longitudeDelta * width;
      return Math.sqrt(latDistance * latDistance + lonDistance * lonDistance);
    };
    
    // Perform clustering based on screen distance
    const processedKeys = new Set();
    
    for (let i = 0; i < clusterKeys.length; i++) {
      const key = clusterKeys[i];
      if (processedKeys.has(key)) continue;
      
      const location = exactLocations[key];
      let mergedCluster = { ...location };
      let allPoints = [location.center];
      
      for (let j = 0; j < clusterKeys.length; j++) {
        if (i === j) continue;
        
        const otherKey = clusterKeys[j];
        if (processedKeys.has(otherKey)) continue;
        
        const otherLocation = exactLocations[otherKey];
        const screenDistance = calculateScreenDistance(
          location.center.latitude,
          location.center.longitude,
          otherLocation.center.latitude,
          otherLocation.center.longitude
        );
        
        if (screenDistance < pixelDistanceThreshold) {
          // Merge clusters
          mergedCluster.events = [...mergedCluster.events, ...otherLocation.events];
          allPoints.push(otherLocation.center);
          processedKeys.add(otherKey);
        }
      }
      
      // Calculate the center of the cluster (average of all merged points)
      if (allPoints.length > 1) {
        const sumLat = allPoints.reduce((sum, point) => sum + point.latitude, 0);
        const sumLng = allPoints.reduce((sum, point) => sum + point.longitude, 0);
        mergedCluster.center = {
          latitude: sumLat / allPoints.length,
          longitude: sumLng / allPoints.length
        };
      }
      
      const clusterKey = `cluster-${i}`;
      clusters[clusterKey] = mergedCluster;
      processedKeys.add(key);
    }
    
    return clusters;
  };
  
  // Get clusters to display
  const clusters = React.useMemo(() => {
    return getClusters();
  }, [events, externalEvents, region]);
  
  // Handle region change
  const onRegionChangeComplete = (newRegion) => {
    setRegion(newRegion);
  };

  // Helper function to adjust map position for drawer
  const animateToMarkerWithOffset = (latitude, longitude) => {
    if (!mapRef.current) return;
    
    // Calculate the center point that will position the marker above the drawer
    // The drawer takes up 70% of screen height, so we need to shift the map view up
    const drawerHeight = height * 0.7; // This matches the drawer height in styles
    const visibleMapHeight = height - drawerHeight;
    const topPadding = 50; // Extra padding from the top of the visible area
    
    // The point should be in the upper portion of the visible map area
    const verticalOffset = (drawerHeight - visibleMapHeight / 2) / 2 + topPadding;
    
    // On iOS, we need to work with map points
    if (Platform.OS === 'ios') {
      mapRef.current.animateCamera({
        center: {
          latitude,
          longitude
        },
        pitch: 0,
        heading: 0,
        altitude: 0,
        zoom: 17
      });
    } else {
      // For Android, we offset the center point
      mapRef.current.animateToRegion({
        latitude: latitude - (verticalOffset / 111111), // Rough conversion from meters to degrees
        longitude,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      }, 500);
    }
  };

  const handleMarkerPress = (locationEvents) => {
    // If only one event at this location, show event details directly
    if (locationEvents.length === 1) {
      handleEventPress(locationEvents[0]);
    } else {
      // Multiple events at this location, show the location selector
      setEventsAtLocation(locationEvents);
      setShowLocationSelector(true);
      
      // Animate to the marker with offset
      animateToMarkerWithOffset(
        locationEvents[0].latitude,
        locationEvents[0].longitude
      );
    }
  };

  const closeLocationSelector = () => {
    setShowLocationSelector(false);
    setEventsAtLocation([]);
  };

  const handleEventPress = (event) => {
    setSelectedEvent(event);
    if (event.is_external) {
      // For external events, we just show the drawer with available info
      // No need to fetch attendance or host info
      setShowDrawer(true);
    } else {
      // For internal events, fetch full details
      fetchEventDetails(event);
      setShowDrawer(true);
    }
    
    // Animate to the marker with offset to keep it visible above the drawer
    animateToMarkerWithOffset(event.latitude, event.longitude);
  };
  
  const closeDrawer = () => {
    setShowDrawer(false);
    setSelectedEvent(null);
    setAttendees([]);
    setHostInfo(null);
    setAttending(false);
  };
  
  const fetchEventDetails = async (event) => {
    if (!user) return;
    
    try {
      // Get host details - improved to handle the case where the host info isn't found
      const { data: hostData, error: hostError } = await supabase
        .from('users')
        .select('id, name, email, phone_number')
        .eq('id', event.host_id)
        .single();
      
      console.log('Host data fetch result:', { hostData, hostError });
      
      if (hostError) {
        console.error('Error fetching host data:', hostError);
        // Set default host info instead of throwing error
        setHostInfo({ name: 'Unknown', id: event.host_id });
      } else {
        setHostInfo(hostData || { name: 'Unknown', id: event.host_id });
      }
      
      // Check if user is attending
      const { data: attendingData, error: attendingError } = await supabase
        .from('event_attendees')
        .select('*')
        .eq('event_id', event.id)
        .eq('user_id', user.id);
        
      if (attendingError) throw attendingError;
      setAttending(attendingData && attendingData.length > 0);
      
      // Fix for the foreign key relationship error (PGRST200):
      // Get attendee user IDs first, then fetch user details separately
      
      // Step 1: Get attendee IDs
      const { data: attendeeRecords, error: attendeeError } = await supabase
        .from('event_attendees')
        .select('user_id')
        .eq('event_id', event.id);
        
      if (attendeeError) {
        console.error('Error fetching attendees:', attendeeError);
        setAttendees([]);
        return;
      }
      
      // No attendees case
      if (!attendeeRecords || attendeeRecords.length === 0) {
        setAttendees([]);
        return;
      }
      
      // Step 2: Extract the user IDs from the records
      const userIds = attendeeRecords.map(record => record.user_id);
      
      // Step 3: Get user details for those IDs
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, name, email, phone_number')
        .in('id', userIds);
        
      if (userError) {
        console.error('Error fetching user data:', userError);
        setAttendees([]);
        return;
      }
      
      setAttendees(userData || []);
    } catch (error) {
      console.error('Error fetching event details:', error);
      Alert.alert('Error', 'Failed to load event details');
    }
  };
  
  const toggleAttendance = async () => {
    if (!user || !selectedEvent) return;
    
    setLoadingAttendance(true);
    
    try {
      if (attending) {
        // Remove attendance
        const { error } = await supabase
          .from('event_attendees')
          .delete()
          .eq('event_id', selectedEvent.id)
          .eq('user_id', user.id);
          
        if (error) throw error;
        
        setAttending(false);
        setAttendees(attendees.filter(a => a.id !== user.id));
      } else {
        // Add attendance
        const { error } = await supabase
          .from('event_attendees')
          .insert([
            { event_id: selectedEvent.id, user_id: user.id }
          ]);
          
        if (error) throw error;
        
        // Get user info to add to attendees list
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('id, name, phone_number')
          .eq('id', user.id)
          .single();
          
        if (userError) throw userError;
        
        setAttending(true);
        setAttendees([...attendees, userData]);
      }
    } catch (error) {
      console.error('Error updating attendance:', error);
      Alert.alert('Error', 'Failed to update attendance');
    } finally {
      setLoadingAttendance(false);
    }
  };
  
  const goToEventDetails = () => {
    if (selectedEvent) {
      closeDrawer();
      navigation.navigate('EventDetails', { event: selectedEvent });
    }
  };
  
  const goToEditEvent = () => {
    if (selectedEvent && user && selectedEvent.host_id === user.id) {
      closeDrawer();
      navigation.navigate('EditEventScreen', { event: selectedEvent });
    }
  };
  
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric'
    });
  };

  // Format time for display
  const formatTime = (timeString) => {
    if (!timeString) return "No time specified";
    
    try {
      // Handle different time formats
      let date;
      
      if (typeof timeString === 'string') {
        // Handle HH:MM:SS format
        if (timeString.includes(':')) {
          const [hours, minutes] = timeString.split(':').map(Number);
          date = new Date();
          date.setHours(hours, minutes);
        } else {
          // Handle ISO date string
          date = new Date(timeString);
        }
      } else {
        // Already a Date object
        date = timeString;
      }
      
      // Format the time
      let hours = date.getHours();
      let minutes = date.getMinutes();
      const ampm = hours >= 12 ? "PM" : "AM";

      hours = hours % 12;
      hours = hours ? hours : 12; // the hour '0' should be '12'
      minutes = minutes < 10 ? "0" + minutes : minutes;

      return `${hours}:${minutes} ${ampm}`;
    } catch (error) {
      console.error('Error formatting time:', error);
      return "Time format error";
    }
  };

  const toggleSearchBar = () => {
    setIsSearching(!isSearching);
    if (!isSearching) {
      // Focus the search input when opening
      setTimeout(() => searchInputRef.current?.focus(), 100);
    } else {
      // Clear search when closing
      setSearchQuery('');
      setExternalEvents([]);
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    setExternalEvents([]);
  };

  // Function to open external event link
  const openExternalEvent = () => {
    if (selectedEvent?.external_url) {
      // On a real device, you would use Linking.openURL(selectedEvent.external_url)
      Alert.alert(
        'External Event',
        `This would open ${selectedEvent.external_url} in your browser`
      );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header
        location={locationName}
        eventsCount={eventsNearby}
        onLocationPress={() => setShowLocationSelector(true)}
        profile={profileImage}
        onRadiusChange={handleRadiusChange}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        onSearch={handleSearch}
      />
      
      <View style={styles.mapContainer}>
        {loading || searchLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>
              {searchLoading ? 'Searching events...' : 'Loading map...'}
            </Text>
          </View>
        ) : (
          <MapView
            ref={mapRef}
            style={styles.map}
            initialRegion={region}
            region={region}
            onRegionChangeComplete={onRegionChangeComplete}
            showsUserLocation
            showsMyLocationButton
          >
            {/* Render markers for each cluster */}
            {Object.values(clusters).map((cluster, index) => {
              const eventCount = cluster.events.length;
              
              // Determine marker size based on count (larger for more events)
              const sizeMultiplier = Math.min(1.5, 1 + (eventCount / 20));
              const markerSize = {
                width: 40 * sizeMultiplier,
                height: 40 * sizeMultiplier,
                borderRadius: 20 * sizeMultiplier,
              };
              
              return (
                <Marker
                  key={`cluster-${index}`}
                  coordinate={cluster.center}
                  onPress={() => handleMarkerPress(cluster.events)}
                >
                  <View style={styles.markerContainer}>
                    <View style={[styles.clusterMarker, markerSize]}>
                      <Text style={styles.clusterText}>
                        {eventCount}
                      </Text>
                    </View>
                  </View>
                </Marker>
              );
            })}
          </MapView>
        )}
      </View>
      
      {/* Location selector modal */}
      <Modal
        visible={showLocationSelector}
        transparent={true}
        animationType="slide"
        onRequestClose={closeLocationSelector}
      >
        <TouchableWithoutFeedback onPress={closeLocationSelector}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.locationSelectorContainer}>
                <View style={styles.locationSelectorHeader}>
                  <Text style={styles.locationSelectorTitle}>
                    {eventsAtLocation.length} Events at This Location
                  </Text>
                  <TouchableOpacity
                    style={styles.closeButton}
                    onPress={closeLocationSelector}
                  >
                    <MaterialIcons name="close" size={24} color={COLORS.text} />
                  </TouchableOpacity>
                </View>
                
                <FlatList
                
                  data={eventsAtLocation}
                  keyExtractor={(event) => event.id.toString()}
                  renderItem={({ item: event }) => (
                    <TouchableOpacity
                      style={styles.locationEventItem}
                      onPress={() => {
                        closeLocationSelector();
                        handleEventPress(event);
                      }}
                    >
                      <View style={styles.locationEventInfo}>
                        <Text style={styles.locationEventTitle}>{event.title}</Text>
                        <Text style={styles.locationEventDate}>
                          {formatDate(event.event_date)}
                        </Text>
                      </View>
                      
                      <MaterialIcons
                        name="chevron-right"
                        size={24}
                        color={COLORS.text}
                      />
                    </TouchableOpacity>
                  )}
                />
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
      
      {/* Event Details Drawer */}
      <Modal
        visible={showDrawer}
        transparent={true}
        animationType="slide"
        onRequestClose={closeDrawer}
      >
        <TouchableWithoutFeedback onPress={closeDrawer}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.drawerContainer}>
                <View style={styles.drawerHandle}>
                  <View style={styles.handleBar} />
                </View>
                
                <TouchableOpacity
                  style={styles.closeDrawerButton}
                  onPress={closeDrawer}
                >
                  <MaterialIcons name="close" size={24} color={COLORS.text} />
                </TouchableOpacity>
                
                {selectedEvent && (
                  <FlatList
                    data={[{id: 'event-detail'}]}
                    keyExtractor={item => item.id}
                    showsVerticalScrollIndicator={true}
                    contentContainerStyle={{
                      paddingBottom: 40,
                      paddingHorizontal: SPACING.md
                    }}
                    removeClippedSubviews={false}
                    scrollEnabled={true}
                    bounces={true}
                    renderItem={() => (
                      <>
                        {/* Event Image */}
                        {selectedEvent.image_url ? (
                          <Image
                            source={{ uri: selectedEvent.image_url }}
                            style={styles.eventImage}
                            resizeMode="cover"
                          />
                        ) : (
                          <View style={styles.imagePlaceholder}>
                            <MaterialIcons name="image" size={50} color={COLORS.border} />
                          </View>
                        )}
                        
                        {/* Event Details */}
                        <View style={styles.eventDetails}>
                          <Text style={styles.eventTitle}>
                            {selectedEvent.title || 'Event Title'}
                          </Text>
                          <Text style={styles.eventLocation}>
                            {selectedEvent.location || 'No Location Specified'}
                          </Text>
                          <Text style={styles.eventDate}>{formatDate(selectedEvent.event_date || new Date())}</Text>
                          
                          {/* Add Time Display */}
                          <View style={styles.eventTimeContainer}>
                            <MaterialIcons name="access-time" size={18} color={COLORS.textSecondary || '#666'} />
                            <Text style={styles.eventTime}>
                              {selectedEvent.start_time ? 
                                `${formatTime(selectedEvent.start_time)} - ${formatTime(selectedEvent.end_time || selectedEvent.start_time)}` : 
                                "Time not specified"}
                            </Text>
                          </View>
                          
                          {/* Description */}
                          <Text style={styles.eventDescription}>
                            {selectedEvent.description || "No description available."}
                          </Text>
                          
                          {/* Action Buttons */}
                          <View style={styles.actionButtons}>
                            {selectedEvent.is_external ? (
                              // External event action
                              <TouchableOpacity
                                style={[styles.actionButton, styles.primaryButton]}
                                onPress={openExternalEvent}
                              >
                                <Text style={styles.actionButtonText}>View Event Details</Text>
                              </TouchableOpacity>
                            ) : (
                              // Internal event actions
                              <>
                                {loadingAttendance ? (
                                  <ActivityIndicator color={COLORS.primary} style={styles.attendingIndicator} />
                                ) : selectedEvent.host_id === user?.id ? (
                                  // Host actions
                                  <TouchableOpacity
                                    style={[styles.actionButton, styles.editButton]}
                                    onPress={goToEditEvent}
                                  >
                                    <Text style={styles.actionButtonText}>Edit Event</Text>
                                  </TouchableOpacity>
                                ) : (
                                  // Attendee actions
                                  <TouchableOpacity
                                    style={[
                                      styles.actionButton,
                                      attending ? styles.attendingButton : styles.primaryButton
                                    ]}
                                    onPress={toggleAttendance}
                                  >
                                    <Text style={styles.actionButtonText}>
                                      {attending ? "Cancel Attendance" : "Attend Event"}
                                    </Text>
                                  </TouchableOpacity>
                                )}
                                
                                <TouchableOpacity
                                  style={[styles.actionButton, styles.secondaryButton]}
                                  onPress={goToEventDetails}
                                >
                                  <Text style={styles.actionButtonText}>View Details</Text>
                                </TouchableOpacity>
                              </>
                            )}
                          </View>
                          
                          {/* Attendees section (only for internal events) */}
                          {!selectedEvent.is_external && (
                            <View style={styles.attendeesSection}>
                              <Text style={styles.sectionTitle}>
                                {attendees.length} {attendees.length === 1 ? "Person" : "People"} Attending
                              </Text>
                              
                              {/* Host info */}
                              <View style={styles.hostInfo}>
                                <Text style={styles.hostLabel}>Hosted by:</Text>
                                <Text style={styles.hostName}>
                                  {hostInfo?.name || (selectedEvent.host_id === user?.id ? user?.email?.split('@')[0] : "Unknown")}
                                </Text>
                              </View>
                              
                              {/* Attendees list (only shown to the host) */}
                              {selectedEvent.host_id === user?.id && attendees.length > 0 && (
                                <View style={styles.attendeesList}>
                                  <Text style={styles.attendeesListTitle}>Attendees:</Text>
                                  {attendees.map((attendee, index) => (
                                    <View key={attendee.id} style={styles.attendeeItem}>
                                      <Text style={styles.attendeeName}>
                                        {attendee.name || attendee.email?.split('@')[0] || "Anonymous"}
                                      </Text>
                                      {attendee.phone_number && (
                                        <Text style={styles.attendeePhone}>
                                          {attendee.phone_number}
                                        </Text>
                                      )}
                                    </View>
                                  ))}
                                </View>
                              )}
                            </View>
                          )}
                        </View>
                      </>
                    )}
                  />
                )}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  mapContainer: {
    flex: 1,
    marginTop: 0,
  },
  map: {
    width: '100%',
    height: '100%',
  },
  markerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  clusterMarker: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#8E6FC5',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 4,
  },
  clusterText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: FONT_SIZES.md,
    textAlign: 'center',
  },
  locationSelectorContainer: {
    backgroundColor: 'white',
    height: height * 0.7,
    width: '100%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 10,
  },
  locationSelectorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  locationSelectorTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  closeButton: {
    padding: SPACING.sm,
  },
  locationEventItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  locationEventInfo: {
    flex: 1,
  },
  locationEventTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: 'bold',
    marginBottom: SPACING.xs,
  },
  locationEventDate: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text,
  },
  drawerContainer: {
    backgroundColor: 'white',
    height: height * 0.7,
    width: '100%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 10,
    maxHeight: height * 0.8, // Ensure there's room to scroll
  },
  drawerHandle: {
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  handleBar: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: COLORS.border,
  },
  closeDrawerButton: {
    position: 'absolute',
    top: SPACING.md,
    right: SPACING.md,
    padding: SPACING.sm,
    zIndex: 10,
  },
  drawerContent: {
    flex: 1,
    marginTop: SPACING.sm,
  },
  eventImage: {
    width: '100%',
    height: 200,
    borderRadius: 10,
    marginBottom: SPACING.md,
  },
  imagePlaceholder: {
    width: '100%',
    height: 200,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
    marginBottom: SPACING.md,
  },
  eventDetails: {
    flex: 1,
  },
  eventTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  eventLocation: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary || '#666',
    marginBottom: SPACING.xs,
  },
  eventDate: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary || '#666',
    marginBottom: SPACING.lg,
  },
  eventTimeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  eventTime: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary || '#666',
    marginLeft: SPACING.xs,
  },
  eventDescription: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    lineHeight: 22,
    marginBottom: SPACING.lg,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.lg,
  },
  actionButton: {
    flex: 1,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
    marginHorizontal: SPACING.xs,
  },
  primaryButton: {
    backgroundColor: COLORS.primary,
  },
  secondaryButton: {
    backgroundColor: COLORS.secondary,
  },
  editButton: {
    backgroundColor: COLORS.primary,
  },
  attendingButton: {
    backgroundColor: COLORS.danger,
  },
  attendingIndicator: {
    marginRight: SPACING.md,
  },
  actionButtonText: {
    color: 'white',
    fontSize: FONT_SIZES.md,
    fontWeight: 'bold',
  },
  attendeesSection: {
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: 'bold',
    marginBottom: SPACING.sm,
  },
  hostInfo: {
    marginBottom: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  hostLabel: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary || '#666',
    marginRight: SPACING.xs,
  },
  hostName: {
    fontSize: FONT_SIZES.md,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  attendeesList: {
    marginTop: SPACING.md,
  },
  attendeesListTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: 'bold',
    marginBottom: SPACING.sm,
  },
  attendeeItem: {
    paddingVertical: SPACING.xs,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  attendeeName: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
  },
  attendeePhone: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary || '#666',
    marginTop: 2,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: SPACING.md,
    color: COLORS.text,
  },
  eventDetailsContainer: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 10,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
});

export default MapScreen;

