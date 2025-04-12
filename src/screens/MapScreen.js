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

  const handleEventPress = (event) => {
    setSelectedEvent(event);
    fetchEventDetails(event);
    setShowDrawer(true);
    
    // Animate to the marker
    if (mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: event.latitude,
        longitude: event.longitude,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      }, 500);
    }
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
        initialRegion={{
          latitude: 38.9869,
          longitude: -76.9426,
          latitudeDelta: 0.0922,
          longitudeDelta: 0.0421,
        }}
      >
        {events.map(event => {
          // Only show events with valid coordinates
          if (event.latitude && event.longitude) {
            return (
              <Marker
                key={event.id}
                coordinate={{ 
                  latitude: event.latitude, 
                  longitude: event.longitude 
                }}
                onPress={() => handleEventPress(event)}
              >
                <View style={styles.markerContainer}>
                  <View style={styles.markerIcon}>
                    <View style={styles.markerInner} />
                  </View>
                </View>
              </Marker>
            );
          }
          return null;
        })}
      </MapView>
      
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
});

export default MapScreen;
