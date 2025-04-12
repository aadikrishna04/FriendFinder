import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  SafeAreaView,
  ActivityIndicator,
  Alert
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { supabase } from '../services/supabaseClient';
import { COLORS, SPACING, FONT_SIZES, LAYOUT } from '../constants';

const EventsScreen = () => {
  const navigation = useNavigation();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  // Load user and events when the screen is focused
  useEffect(() => 
    navigation.addListener('focus', () => {
      const loadUserAndEvents = async () => {
        setLoading(true);
        try {
          // Check if user is authenticated
          const { data: { user } } = await supabase.auth.getUser();
          
          if (!user) {
            console.log('User not authenticated');
            navigation.replace('Login');
            return;
          }
          
          // Load all events where user is host
          const { data: hostedEvents, error: hostedError } = await supabase
            .from('events')
            .select('*')
            .eq('host_id', user.id);
            
          if (hostedError) throw hostedError;
          
          // Load all events user is attending
          const { data: attendances, error: attendError } = await supabase
            .from('event_attendees')
            .select('event_id')
            .eq('user_id', user.id);
            
          if (attendError) throw attendError;
          
          // Get the detailed event data for events user is attending
          let attendingEvents = [];
          if (attendances && attendances.length > 0) {
            const eventIds = attendances.map(a => a.event_id);
            const { data: eventsData, error: eventsError } = await supabase
              .from('events')
              .select('*')
              .in('id', eventIds);
              
            if (eventsError) throw eventsError;
            attendingEvents = eventsData || [];
          }
          
          // Combine and mark whether user is host or attendee
          const allEvents = [
            ...(hostedEvents || []).map(event => ({
              ...event,
              is_host: true
            })),
            ...attendingEvents.filter(event => event.host_id !== user.id).map(event => ({
              ...event,
              is_host: false
            }))
          ];
          
          // Sort events - hosted events first, then by date
          const sortedEvents = allEvents.sort((a, b) => {
            // First prioritize hosted events
            if (a.is_host && !b.is_host) return -1;
            if (!a.is_host && b.is_host) return 1;
            
            // Then sort by date (ascending)
            return new Date(a.event_date) - new Date(b.event_date);
          });
          
          setEvents(sortedEvents);
        } catch (error) {
          console.error('Error loading events:', error);
          Alert.alert('Error', 'Failed to load your events');
        } finally {
          setLoading(false);
        }
      };

      loadUserAndEvents();
      
      return () => {};
    }, [])
  );

  const handleCreateEvent = () => {
    navigation.navigate('CreateEvent');
  };

  const handleEditEvent = (event) => {
    // Only allow editing if user is the host
    if (event.is_host) {
      navigation.navigate('EditEvent', { event });
    } else {
      // For attendees, just view the event details
      navigation.navigate('EventDetails', { event });
    }
  };

  const renderEventItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.eventCard}
      onPress={() => handleEditEvent(item)}
    >
      {item.image_url ? (
        <Image source={{ uri: item.image_url }} style={styles.eventImage} />
      ) : (
        <View style={styles.eventImagePlaceholder}>
          <Text style={styles.eventImagePlaceholderText}>No Image</Text>
        </View>
      )}
      
      <View style={styles.eventInfo}>
        <Text style={styles.eventTitle}>{item.title}</Text>
        <Text style={styles.eventLocation}>{item.location}</Text>
        <Text style={styles.eventDate}>
          {new Date(item.event_date).toLocaleDateString()}
        </Text>
        
        <View style={styles.eventGuestInfo}>
          <Text style={styles.guestLabel}>
            {item.is_host ? 'Hosting' : (item.is_open ? 'Open Event' : 'Invitation Only')}
          </Text>
          {!item.is_host && (
            <Text style={[styles.guestLabel, styles.attendingLabel]}>
              • Attending
            </Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderEmptyList = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>You haven't created or registered for any events yet</Text>
      <TouchableOpacity 
        style={styles.createButton}
        onPress={handleCreateEvent}
      >
        <Text style={styles.createButtonText}>Create Your First Event</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Events</Text>
        <TouchableOpacity 
          style={styles.createEventButton}
          onPress={handleCreateEvent}
        >
          <Text style={styles.createEventButtonText}>+</Text>
        </TouchableOpacity>
      </View>
      
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading events...</Text>
        </View>
      ) : (
        <FlatList
          data={events}
          renderItem={renderEventItem}
          keyExtractor={item => item.id.toString()}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={renderEmptyList}
          refreshing={loading}
          onRefresh={() => {
            setLoading(true);
            supabase.auth.getUser().then(({ data: { user } }) => {
              if (user) {
                // Load all events where user is host
                supabase
                  .from('events')
                  .select('*')
                  .eq('host_id', user.id)
                  .then(async ({ data: hostedEvents, error: hostedError }) => {
                    if (hostedError) {
                      console.error('Error loading hosted events:', hostedError);
                      setLoading(false);
                      return;
                    }
                    
                    // Load all events user is attending
                    const { data: attendances, error: attendError } = await supabase
                      .from('event_attendees')
                      .select('event_id')
                      .eq('user_id', user.id);
                      
                    if (attendError) {
                      console.error('Error loading attendances:', attendError);
                      setLoading(false);
                      return;
                    }
                    
                    // Get the detailed event data for events user is attending
                    let attendingEvents = [];
                    if (attendances && attendances.length > 0) {
                      const eventIds = attendances.map(a => a.event_id);
                      const { data: eventsData, error: eventsError } = await supabase
                        .from('events')
                        .select('*')
                        .in('id', eventIds);
                        
                      if (eventsError) {
                        console.error('Error loading attending events:', eventsError);
                        setLoading(false);
                        return;
                      }
                      attendingEvents = eventsData || [];
                    }
                    
                    // Combine and mark whether user is host or attendee
                    const allEvents = [
                      ...(hostedEvents || []).map(event => ({
                        ...event,
                        is_host: true
                      })),
                      ...attendingEvents.filter(event => event.host_id !== user.id).map(event => ({
                        ...event,
                        is_host: false
                      }))
                    ];
                    
                    // Sort events - hosted events first, then by date
                    const sortedEvents = allEvents.sort((a, b) => {
                      // First prioritize hosted events
                      if (a.is_host && !b.is_host) return -1;
                      if (!a.is_host && b.is_host) return 1;
                      
                      // Then sort by date (ascending)
                      return new Date(a.event_date) - new Date(b.event_date);
                    });
                    
                    setEvents(sortedEvents);
                    setLoading(false);
                  });
              } else {
                setLoading(false);
              }
            });
          }}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  createEventButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  createEventButtonText: {
    fontSize: FONT_SIZES.xl,
    color: 'white',
    fontWeight: 'bold',
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
  listContent: {
    padding: SPACING.md,
    paddingBottom: SPACING.xl,
    flexGrow: 1,
  },
  eventCard: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: LAYOUT.borderRadius,
    marginBottom: SPACING.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    overflow: 'hidden',
  },
  eventImage: {
    width: 100,
    height: 'auto',
    aspectRatio: 1,
  },
  eventImagePlaceholder: {
    width: 100,
    height: 100,
    backgroundColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  eventImagePlaceholderText: {
    color: COLORS.placeholder,
    fontSize: FONT_SIZES.sm,
  },
  eventInfo: {
    flex: 1,
    padding: SPACING.md,
  },
  eventTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: 'bold',
    marginBottom: SPACING.xs,
  },
  eventLocation: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  eventDate: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  eventGuestInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  guestLabel: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.primary,
    fontWeight: '500',
  },
  attendingLabel: {
    marginLeft: SPACING.xs,
    color: COLORS.secondary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    minHeight: 300,
  },
  emptyText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.placeholder,
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },
  createButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    borderRadius: LAYOUT.borderRadius,
  },
  createButtonText: {
    color: 'white',
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
  },
});

export default EventsScreen; 