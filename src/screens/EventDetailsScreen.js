import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  ActivityIndicator
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { supabase } from '../services/supabaseClient';
import { COLORS, SPACING, FONT_SIZES, LAYOUT } from '../constants';
import { MaterialIcons } from '@expo/vector-icons';
import MapView, { Marker } from 'react-native-maps';

const EventDetailsScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { event } = route.params;
  
  const [eventDetails, setEventDetails] = useState(event);
  const [loading, setLoading] = useState(false);
  const [hostInfo, setHostInfo] = useState(null);
  const [attending, setAttending] = useState(false);
  const [attendees, setAttendees] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [loadingAttendees, setLoadingAttendees] = useState(true);

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);
      return user;
    };

    const fetchEventDetails = async () => {
      setLoading(true);
      try {
        const user = await getUser();
        
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
          
        if (attendeesError) {
          console.error('Error fetching event attendees:', attendeesError);
          throw attendeesError;
        }
        
        // Extract user info from nested response
        const formattedAttendees = attendeesData.map(item => item.users);
        setAttendees(formattedAttendees);
      } catch (error) {
        console.error('Error fetching event details:', error);
        Alert.alert('Error', 'Failed to load event details');
      } finally {
        setLoading(false);
        setLoadingAttendees(false);
      }
    };
    
    fetchEventDetails();
  }, [event.id, event.host_id]);

  const toggleAttendance = async () => {
    if (!currentUser) {
      Alert.alert('Authentication Error', 'You must be logged in to RSVP to events');
      return;
    }
    
    setLoading(true);
    
    try {
      if (attending) {
        // Remove attendance
        const { error } = await supabase
          .from('event_attendees')
          .delete()
          .eq('event_id', event.id)
          .eq('user_id', currentUser.id);
          
        if (error) throw error;
        
        setAttending(false);
        setAttendees(attendees.filter(a => a.id !== currentUser.id));
      } else {
        // Add attendance
        const { error } = await supabase
          .from('event_attendees')
          .insert([
            { event_id: event.id, user_id: currentUser.id }
          ]);
          
        if (error) throw error;
        
        // Get user info to add to attendees list
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('id, name, phone_number')
          .eq('id', currentUser.id)
          .single();
          
        if (userError) throw userError;
        
        setAttending(true);
        setAttendees([...attendees, userData]);
      }
      
      Alert.alert(
        attending ? 'Canceled' : 'Confirmed', 
        attending ? 'You are no longer attending this event' : 'You are now attending this event'
      );
    } catch (error) {
      console.error('Error updating attendance:', error);
      Alert.alert('Error', 'Failed to update attendance');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading && !eventDetails) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading event details...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <MaterialIcons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Event Details</Text>
          
          {/* Add edit button for hosts */}
          {currentUser && eventDetails.host_id === currentUser.id && (
            <TouchableOpacity 
              style={styles.editButton}
              onPress={() => navigation.navigate('EditEventScreen', { event: eventDetails })}
            >
              <MaterialIcons name="edit" size={24} color={COLORS.primary} />
            </TouchableOpacity>
          )}
        </View>
        
        {/* Show image at the top */}
        {eventDetails.image_url ? (
          <Image source={{ uri: eventDetails.image_url }} style={styles.eventImage} />
        ) : (
          <View style={styles.noImageContainer}>
            <MaterialIcons name="image" size={40} color={COLORS.placeholder} />
            <Text style={styles.noImageText}>No Image Available</Text>
          </View>
        )}
        
        <View style={styles.contentContainer}>
          {/* Title first */}
          <Text style={styles.eventTitle}>{eventDetails.title}</Text>
          
          {/* Host information */}
          <View style={styles.infoRow}>
            <MaterialIcons name="person" size={20} color={COLORS.primary} />
            <Text style={styles.infoText}>
              Hosted by {hostInfo ? hostInfo.name : 'Loading...'}
            </Text>
          </View>
          
          {/* Location and map */}
          <View style={styles.infoRow}>
            <MaterialIcons name="location-on" size={20} color={COLORS.primary} />
            <Text style={styles.infoText}>{eventDetails.location}</Text>
          </View>
          
          <View style={styles.infoRow}>
            <MaterialIcons name="schedule" size={20} color={COLORS.primary} />
            <Text style={styles.infoText}>{formatDate(eventDetails.event_date)}</Text>
          </View>
          
          <View style={styles.infoRow}>
            <MaterialIcons 
              name={eventDetails.is_open ? "public" : "lock"} 
              size={20} 
              color={COLORS.primary} 
            />
            <Text style={styles.infoText}>
              {eventDetails.is_open ? 'Open to everyone' : 'Invitation only'}
            </Text>
          </View>
          
          {eventDetails.description && (
            <View style={styles.descriptionContainer}>
              <Text style={styles.sectionTitle}>Description</Text>
              <Text style={styles.descriptionText}>{eventDetails.description}</Text>
            </View>
          )}
          
          {eventDetails.latitude && eventDetails.longitude && (
            <View style={styles.mapContainer}>
              <Text style={styles.sectionTitle}>Location</Text>
              <MapView
                style={styles.map}
                initialRegion={{
                  latitude: eventDetails.latitude,
                  longitude: eventDetails.longitude,
                  latitudeDelta: 0.005,
                  longitudeDelta: 0.005,
                }}
                scrollEnabled={false}
                zoomEnabled={false}
              >
                <Marker
                  coordinate={{
                    latitude: eventDetails.latitude,
                    longitude: eventDetails.longitude,
                  }}
                >
                  <View style={styles.mapMarker}>
                    <View style={styles.mapMarkerInner} />
                  </View>
                </Marker>
              </MapView>
            </View>
          )}
          
          {/* Attendees section */}
          <View style={styles.attendeesContainer}>
            <Text style={styles.sectionTitle}>
              Attendees ({attendees.length})
            </Text>
            
            {loadingAttendees ? (
              <ActivityIndicator size="small" color={COLORS.primary} />
            ) : (
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
            )}
          </View>
          
          {/* Show RSVP button at the bottom, but not for hosts */}
          {currentUser && eventDetails.host_id !== currentUser.id && (
            <TouchableOpacity
              style={[
                styles.rsvpButton,
                attending ? styles.cancelButton : styles.attendButton
              ]}
              onPress={toggleAttendance}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <Text style={styles.rsvpButtonText}>
                  {attending ? 'Cancel Attendance' : 'Attend Event'}
                </Text>
              )}
            </TouchableOpacity>
          )}
          
          {/* For hosts, show an edit button at the bottom */}
          {currentUser && eventDetails.host_id === currentUser.id && (
            <TouchableOpacity
              style={[styles.rsvpButton, styles.hostButton]}
              onPress={() => navigation.navigate('EditEventScreen', { event: eventDetails })}
            >
              <Text style={styles.rsvpButtonText}>Edit Event</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    flexGrow: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: SPACING.md,
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    padding: SPACING.xs,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: FONT_SIZES.xl,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  editButton: {
    padding: SPACING.xs,
  },
  eventImage: {
    width: '100%',
    height: 250,
  },
  noImageContainer: {
    width: '100%',
    height: 250,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  noImageText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.placeholder,
    marginTop: SPACING.xs,
  },
  contentContainer: {
    padding: SPACING.md,
  },
  eventTitle: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SPACING.md,
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
    marginTop: SPACING.lg,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  descriptionText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    lineHeight: 22,
  },
  mapContainer: {
    marginTop: SPACING.lg,
  },
  map: {
    height: 150,
    borderRadius: LAYOUT.borderRadius,
    marginTop: SPACING.xs,
  },
  attendeesContainer: {
    marginTop: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  attendeesList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: SPACING.xs,
  },
  attendeeItem: {
    alignItems: 'center',
    marginRight: SPACING.md,
    marginBottom: SPACING.md,
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
    maxWidth: 80,
    textAlign: 'center',
  },
  noAttendeesText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.placeholder,
    marginTop: SPACING.sm,
  },
  rsvpButton: {
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: LAYOUT.borderRadius,
    marginTop: SPACING.md,
  },
  attendButton: {
    backgroundColor: COLORS.primary,
  },
  cancelButton: {
    backgroundColor: '#F87171', // Red color
  },
  rsvpButtonText: {
    color: 'white',
    fontSize: FONT_SIZES.md,
    fontWeight: 'bold',
  },
  mapMarker: {
    width: 20, 
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(139, 92, 246, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapMarkerInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.primary,
  },
  hostButton: {
    backgroundColor: '#60A5FA',
  },
});

export default EventDetailsScreen; 