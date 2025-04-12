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
  ActivityIndicator
} from "react-native";
import MapView, { Marker } from "react-native-maps";
import { supabase } from "../services/supabaseClient";
import { COLORS, SPACING, FONT_SIZES } from "../constants";
import { MaterialIcons } from '@expo/vector-icons';

const { height, width } = Dimensions.get("window");

const MapScreen = ({ navigation }) => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showDrawer, setShowDrawer] = useState(false);
  const [attending, setAttending] = useState(false);
  const [loadingAttendance, setLoadingAttendance] = useState(false);
  const [hostInfo, setHostInfo] = useState(null);
  const [attendees, setAttendees] = useState([]);
  const [eventsAtLocation, setEventsAtLocation] = useState([]);
  const [showLocationSelector, setShowLocationSelector] = useState(false);
  const [region, setRegion] = useState({
    latitude: 38.9869,
    longitude: -76.9426,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  });
  const mapRef = useRef(null);

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
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

  // Calculate clusters based on current region
  const getClusters = () => {
    // Skip if no events
    if (events.length === 0) return {};
    
    // Calculate the pixel distance threshold for clustering based on zoom
    // The smaller the latitudeDelta (more zoomed in), the smaller the threshold
    const pixelDistanceThreshold = Math.max(30, 100 * region.latitudeDelta); // Adjust these numbers to control clustering sensitivity
    
    // First pass: assign all events to their exact location
    const exactLocations = {};
    events.forEach(event => {
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
  }, [events, region]);
  
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
    fetchEventDetails(event);
    setShowDrawer(true);
    
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
      // Get host details
      const { data: hostData, error: hostError } = await supabase
        .from('users')
        .select('name, phone_number')
        .eq('id', event.host_id)
        .single();
        
      if (hostError) throw hostError;
      setHostInfo(hostData);
      
      // Check if user is attending
      const { data: attendingData, error: attendingError } = await supabase
        .from('event_attendees')
        .select('*')
        .eq('event_id', event.id)
        .eq('user_id', user.id);
        
      if (attendingError) throw attendingError;
      setAttending(attendingData && attendingData.length > 0);
      
      // Get attendees
      const { data: attendeesData, error: attendeesError } = await supabase
        .from('event_attendees')
        .select(`
          user_id,
          users (
            id,
            name,
            phone_number
          )
        `)
        .eq('event_id', event.id);
        
      if (attendeesError) throw attendeesError;
      
      // Extract user info from nested response
      const formattedAttendees = attendeesData.map(item => item.users);
      setAttendees(formattedAttendees);
    } catch (error) {
      console.error('Error fetching event details:', error);
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

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={region}
        onRegionChangeComplete={onRegionChangeComplete}
      >
        {/* Render clusters with uniform style */}
        {Object.entries(clusters).map(([clusterKey, cluster]) => {
          const eventCount = cluster.events.length;
          return (
            <Marker
              key={clusterKey}
              coordinate={cluster.center}
              onPress={() => handleMarkerPress(cluster.events)}
            >
              <View style={styles.markerContainer}>
                <View style={[styles.markerIcon, styles.uniformMarker]}>
                  <Text style={styles.markerCount}>{eventCount}</Text>
                </View>
              </View>
            </Marker>
          );
        })}
      </MapView>
      
      {/* Location Selector Modal */}
      <Modal
        visible={showLocationSelector}
        animationType="slide"
        transparent={true}
        onRequestClose={closeLocationSelector}
      >
        <View style={styles.drawerContainer}>
          <View style={styles.drawerHandle} />
          <TouchableOpacity 
            style={styles.closeButton}
            onPress={closeLocationSelector}
          >
            <MaterialIcons name="close" size={24} color={COLORS.text} />
          </TouchableOpacity>
          
          <View style={styles.locationSelectorContainer}>
            <Text style={styles.locationSelectorTitle}>
              {eventsAtLocation.length} Events at this location
            </Text>
            
            <ScrollView style={styles.locationEventsList}>
              {eventsAtLocation.map((event) => (
                <TouchableOpacity
                  key={event.id}
                  style={styles.locationEventItem}
                  onPress={() => {
                    closeLocationSelector();
                    handleEventPress(event);
                  }}
                >
                  <View style={styles.locationEventImageContainer}>
                    {event.image_url ? (
                      <Image 
                        source={{ uri: event.image_url }} 
                        style={styles.locationEventImage} 
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={styles.locationEventNoImage}>
                        <MaterialIcons name="image" size={24} color={COLORS.placeholder} />
                      </View>
                    )}
                  </View>
                  
                  <View style={styles.locationEventInfo}>
                    <Text style={styles.locationEventTitle} numberOfLines={1}>{event.title}</Text>
                    <Text style={styles.locationEventDate} numberOfLines={1}>
                      {formatDate(event.event_date)}
                    </Text>
                    <View style={styles.eventTypeTag}>
                      <Text style={styles.eventTypeText}>
                        {event.host_id === user?.id ? 'Hosting' : (event.is_open ? 'Open Event' : 'Invitation Only')}
                      </Text>
                    </View>
                  </View>
                  
                  <MaterialIcons name="chevron-right" size={24} color={COLORS.text} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
      
      {/* Event Details Drawer */}
      <Modal
        visible={showDrawer}
        animationType="slide"
        transparent={true}
        onRequestClose={closeDrawer}
      >
        <View style={styles.drawerContainer}>
          <View style={styles.drawerHandle} />
          <TouchableOpacity 
            style={styles.closeButton}
            onPress={closeDrawer}
          >
            <MaterialIcons name="close" size={24} color={COLORS.text} />
          </TouchableOpacity>
          
          {selectedEvent && (
            <ScrollView style={styles.drawerContent}>
              {selectedEvent.image_url ? (
                <Image 
                  source={{ uri: selectedEvent.image_url }} 
                  style={styles.eventImage} 
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.noImageContainer}>
                  <MaterialIcons name="image" size={40} color={COLORS.placeholder} />
                  <Text style={styles.noImageText}>No Image</Text>
                </View>
              )}
              
              <View style={styles.contentPadding}>
                <Text style={styles.eventTitle}>{selectedEvent.title}</Text>
                
                <View style={styles.infoRow}>
                  <MaterialIcons name="person" size={20} color={COLORS.primary} />
                  <Text style={styles.infoText}>
                    Hosted by {hostInfo ? hostInfo.name : 'Loading...'}
                  </Text>
                </View>
                
                <View style={styles.infoRow}>
                  <MaterialIcons name="location-on" size={20} color={COLORS.primary} />
                  <Text style={styles.infoText}>{selectedEvent.location}</Text>
                </View>
                
                <View style={styles.infoRow}>
                  <MaterialIcons name="event" size={20} color={COLORS.primary} />
                  <Text style={styles.infoText}>{formatDate(selectedEvent.event_date)}</Text>
                </View>
                
                {selectedEvent.description && (
                  <View style={styles.descriptionContainer}>
                    <Text style={styles.descriptionText}>{selectedEvent.description}</Text>
                  </View>
                )}
                
                <View style={styles.attendeesContainer}>
                  <Text style={styles.sectionTitle}>
                    Attendees ({attendees.length})
                  </Text>
                  <View style={styles.attendeesList}>
                    {attendees.length > 0 ? (
                      attendees.map((attendee, index) => (
                        <View key={index} style={styles.attendeeItem}>
                          <View style={styles.attendeeAvatar}>
                            <Text style={styles.attendeeInitial}>
                              {attendee.name ? attendee.name.charAt(0).toUpperCase() : '?'}
                            </Text>
                          </View>
                          <Text style={styles.attendeeName} numberOfLines={1}>{attendee.name}</Text>
                        </View>
                      ))
                    ) : (
                      <Text style={styles.noAttendeesText}>No attendees yet</Text>
                    )}
                  </View>
                </View>
                
                <View style={styles.buttonsContainer}>
                  {user && selectedEvent.host_id === user.id ? (
                    <TouchableOpacity
                      style={[styles.button, styles.editButton]}
                      onPress={goToEditEvent}
                    >
                      <Text style={styles.buttonText}>Edit Event</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={[
                        styles.button,
                        attending ? styles.cancelButton : styles.attendButton,
                        loadingAttendance && styles.disabledButton
                      ]}
                      onPress={toggleAttendance}
                      disabled={loadingAttendance}
                    >
                      {loadingAttendance ? (
                        <ActivityIndicator size="small" color="white" />
                      ) : (
                        <Text style={styles.buttonText}>
                          {attending ? 'Cancel Attendance' : 'Attend Event'}
                        </Text>
                      )}
                    </TouchableOpacity>
                  )}
                  
                  <TouchableOpacity
                    style={[styles.button, styles.detailsButton]}
                    onPress={goToEventDetails}
                  >
                    <Text style={styles.buttonText}>View Details</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          )}
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight : 0,
  },
  map: {
    height:
      height + (Platform.OS === "android" ? StatusBar.currentHeight || 0 : 0),
    width: "100%",
  },
  markerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(139, 92, 246, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  markerInner: {
    width: 15,
    height: 15,
    borderRadius: 7.5,
    backgroundColor: COLORS.primary,
  },
  drawerContainer: {
    backgroundColor: COLORS.background,
    height: height * 0.7,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.27,
    shadowRadius: 4.65,
    elevation: 6,
  },
  drawerHandle: {
    width: 40,
    height: 5,
    backgroundColor: COLORS.border,
    borderRadius: 3,
    alignSelf: 'center',
    marginTop: 10,
  },
  drawerContent: {
    flex: 1,
  },
  eventImage: {
    width: '100%',
    height: 200,
  },
  noImageContainer: {
    width: '100%',
    height: 200,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  noImageText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.placeholder,
    marginTop: SPACING.xs,
  },
  contentPadding: {
    padding: SPACING.md,
  },
  eventTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  infoText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    marginLeft: SPACING.xs,
  },
  descriptionContainer: {
    marginVertical: SPACING.md,
    padding: SPACING.sm,
    backgroundColor: '#F0F0F0',
    borderRadius: 10,
  },
  descriptionText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    lineHeight: 22,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  attendeesContainer: {
    marginTop: SPACING.md,
  },
  attendeesList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  attendeeItem: {
    alignItems: 'center',
    marginRight: SPACING.md,
    marginBottom: SPACING.md,
    width: 60,
  },
  attendeeAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  attendeeInitial: {
    color: 'white',
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
  },
  attendeeName: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text,
    textAlign: 'center',
  },
  noAttendeesText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.placeholder,
  },
  buttonsContainer: {
    marginTop: SPACING.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  button: {
    flex: 1,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
    marginHorizontal: SPACING.xs,
  },
  attendButton: {
    backgroundColor: COLORS.primary,
  },
  cancelButton: {
    backgroundColor: '#F87171',
  },
  editButton: {
    backgroundColor: '#60A5FA',
  },
  detailsButton: {
    backgroundColor: COLORS.primary,
  },
  disabledButton: {
    opacity: 0.7,
  },
  buttonText: {
    color: 'white',
    fontSize: FONT_SIZES.md,
    fontWeight: 'bold',
  },
  closeButton: {
    position: 'absolute',
    top: 10,
    right: 15,
    zIndex: 10,
    padding: 5,
  },
  uniformMarker: {
    backgroundColor: 'rgba(139, 92, 246, 0.7)',
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: 'white',
  },
  markerCount: {
    color: 'white',
    fontSize: FONT_SIZES.sm,
    fontWeight: 'bold',
  },
  locationSelectorContainer: {
    flex: 1,
    padding: SPACING.md,
  },
  locationSelectorTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  locationEventsList: {
    flex: 1,
  },
  locationEventItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  locationEventImageContainer: {
    width: 60,
    height: 60,
    borderRadius: 8,
    overflow: 'hidden',
    marginRight: SPACING.md,
  },
  locationEventImage: {
    width: '100%',
    height: '100%',
  },
  locationEventNoImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  locationEventInfo: {
    flex: 1,
    marginRight: SPACING.sm,
  },
  locationEventTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  locationEventDate: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  eventTypeTag: {
    backgroundColor: '#F0F0F0',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs / 2,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  eventTypeText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.primary,
    fontWeight: '500',
  },
});

export default MapScreen;
