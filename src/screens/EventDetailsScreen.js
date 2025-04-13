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
  ActivityIndicator,
  FlatList,
  Modal,
  Linking
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { supabase, ensureTicketmasterTables } from '../services/supabaseClient';
import { COLORS, SPACING, FONT_SIZES, LAYOUT } from '../constants';
import { MaterialIcons } from '@expo/vector-icons';
import MapView, { Marker } from 'react-native-maps';

const EventDetailsScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  // Get either the full event object or just the eventId
  const eventParam = route.params?.event;
  const isTicketmasterEvent = route.params?.isTicketmasterEvent || false;
  
  // Ensure eventId is a string - route params might give us different types
  let eventId = route.params?.eventId;
  if (!eventId && eventParam) {
    eventId = eventParam.id;
  }
  
  if (eventId && typeof eventId !== 'string') {
    eventId = String(eventId); // Convert to string if it's not already
  }
  
  const [eventDetails, setEventDetails] = useState(eventParam);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(!eventParam);
  const [hostInfo, setHostInfo] = useState(null);
  const [attending, setAttending] = useState(false);
  const [attendees, setAttendees] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [loadingAttendees, setLoadingAttendees] = useState(true);
  const [invitation, setInvitation] = useState(null);
  const [loadingInvitation, setLoadingInvitation] = useState(false);
  const [invitedGroups, setInvitedGroups] = useState([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [showInviteGroupModal, setShowInviteGroupModal] = useState(false);
  const [userGroups, setUserGroups] = useState([]);
  const [loadingUserGroups, setLoadingUserGroups] = useState(false);
  const [selectedGroups, setSelectedGroups] = useState([]);
  const [error, setError] = useState(null);
  // State for invite contacts modal
  const [showInviteContactsModal, setShowInviteContactsModal] = useState(false);

  // First, fetch the event if we only have the ID
  useEffect(() => {
    const fetchEvent = async () => {
      if (eventParam) return; // Skip if we already have the event object
      if (!eventId) {
        Alert.alert('Error', 'No event ID provided');
        navigation.goBack();
        return;
      }
      
      setInitialLoading(true);
      console.log(`Attempting to fetch event with ID: ${eventId}`);
      
      try {
        // Log the type of the eventId to ensure it's correct
        console.log(`Event ID type: ${typeof eventId}`);
        
        // Fetch the event by ID
        const { data, error } = await supabase
          .from('events')
          .select('*')
          .eq('id', eventId)
          .single();
        
        console.log('Query response:', { data, error });
          
        if (error) throw error;
        
        if (!data) {
          console.log('No event found with ID:', eventId);
          Alert.alert('Error', 'Event not found');
          navigation.goBack();
          return;
        }
        
        console.log('Event found:', data.title);
        setEventDetails(data);
      } catch (error) {
        console.error('Error fetching event by ID:', error);
        Alert.alert('Error', 'Failed to load event details');
        navigation.goBack();
      } finally {
        setInitialLoading(false);
      }
    };
    
    fetchEvent();
  }, [eventId, eventParam, navigation]);

  useEffect(() => {
    // Skip if we don't have event details yet
    if (!eventDetails) return;
    
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);
      return user;
    };

    const fetchEventDetails = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const user = await getUser();
        
        // Get host details
        const { data: hostData, error: hostError } = await supabase
          .from('users')
          .select('name, phone_number')
          .eq('id', eventDetails.host_id)
          .single();
          
        if (hostError) throw hostError;
        setHostInfo(hostData);
        
        // Check if user is attending
        const { data: attendingData, error: attendingError } = await supabase
          .from('event_attendees')
          .select('*')
          .eq('event_id', eventDetails.id)
          .eq('user_id', user.id);
          
        if (attendingError) throw attendingError;
        setAttending(attendingData && attendingData.length > 0);
        
        // Get invitations
        const { data: invitations, error: invitationsError } = await supabase
          .from("event_invitations")
          .select("*, invitee_users:invitee_id (name, id, phone_number)")
          .eq("event_id", eventDetails.id);

        if (invitationsError) {
          throw invitationsError;
        }

        setInvitation(invitations?.find(
          (inv) => inv.invitee_id === user.id
        ));
        
        // Use fetchAttendees instead of fetching attendees here
        await fetchAttendees();

        // Check current user's invitation status
        if (currentUser) {
          const userInvitation = invitations?.find(
            (inv) => inv.invitee_id === currentUser.id
          );
          if (userInvitation) {
            setInvitation(userInvitation);
          }
        }
      } catch (error) {
        console.error("Error loading event details:", error);
        setError(error.message);
      } finally {
        setLoading(false);
        setLoadingAttendees(false);
      }
    };
    
    fetchEventDetails();
  }, [eventDetails]); // Only depend on eventDetails object, not specific fields

  useEffect(() => {
    fetchEventGroups();
  }, [eventId]);

  // Fetch user's groups when invite group modal is opened
  useEffect(() => {
    if (showInviteGroupModal) {
      fetchUserGroups();
    }
  }, [showInviteGroupModal]);

  const fetchUserGroups = async () => {
    if (!currentUser) return;
    
    try {
      setLoadingUserGroups(true);
      
      // Fetch groups where user is a member
      const { data: membershipData, error: membershipError } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('user_id', currentUser.id);
        
      if (membershipError) throw membershipError;
      
      // Extract group IDs
      const groupIds = membershipData.map(m => m.group_id);
      
      if (groupIds.length > 0) {
        // Fetch group details
        const { data: groupsData, error: groupsError } = await supabase
          .from('groups')
          .select('id, name, host_id')
          .in('id', groupIds);
          
        if (groupsError) throw groupsError;
        
        // Filter out groups that are already invited
        const alreadyInvitedGroupIds = invitedGroups.map(g => g.id);
        const filteredGroups = groupsData.filter(g => !alreadyInvitedGroupIds.includes(g.id));
        
        // Get member counts for each group
        const groupsWithCounts = await Promise.all(filteredGroups.map(async (group) => {
          const { count, error: countError } = await supabase
            .from('group_members')
            .select('*', { count: 'exact', head: true })
            .eq('group_id', group.id);
            
          if (countError) throw countError;
          
          return {
            ...group,
            isHost: group.host_id === currentUser.id,
            memberCount: count || 0
          };
        }));
        
        setUserGroups(groupsWithCounts);
      } else {
        setUserGroups([]);
      }
    } catch (error) {
      console.error('Error fetching user groups:', error);
      Alert.alert('Error', 'Failed to load your groups');
    } finally {
      setLoadingUserGroups(false);
    }
  };

  const fetchEventGroups = async () => {
    try {
      setLoadingGroups(true);
      
      // Table name depends on event type
      const eventGroupsTable = isTicketmasterEvent ? 'ticketmaster_event_groups' : 'event_groups';
      
      // For Ticketmaster events, ensure the table exists
      if (isTicketmasterEvent) {
        await ensureTicketmasterTables();
      }
      
      // Fetch groups invited to this event
      const { data: eventGroupData, error: eventGroupError } = await supabase
        .from(eventGroupsTable)
        .select('group_id, invited_by')
        .eq('event_id', eventId);
      
      // If we have a table error for Ticketmaster events, it might be because the table doesn't exist yet
      if (eventGroupError) {
        console.error('Error fetching event groups:', eventGroupError);
        
        // Check if the error is specifically about the table not existing
        if (isTicketmasterEvent && eventGroupError.code === '42P01') {
          console.log('Ticketmaster event groups table does not exist yet, returning empty array');
          setInvitedGroups([]);
          return;
        }
        
        throw eventGroupError;
      }
      
      if (eventGroupData && eventGroupData.length > 0) {
        // Extract group IDs
        const groupIds = eventGroupData.map(eg => eg.group_id);
        
        // Fetch group details
        const { data: groupsData, error: groupsError } = await supabase
          .from('groups')
          .select('id, name, host_id')
          .in('id', groupIds);
          
        if (groupsError) throw groupsError;
        
        // Get member counts for each group
        const groupsWithCounts = await Promise.all(groupsData.map(async (group) => {
          const { count, error: countError } = await supabase
            .from('group_members')
            .select('*', { count: 'exact', head: true })
            .eq('group_id', group.id);
            
          if (countError) throw countError;
          
          return {
            ...group,
            memberCount: count || 0
          };
        }));
        
        setInvitedGroups(groupsWithCounts);
      } else {
        setInvitedGroups([]);
      }
    } catch (error) {
      console.error('Error fetching event groups:', error);
      // Set empty array in case of error
      setInvitedGroups([]);
    } finally {
      setLoadingGroups(false);
    }
  };

  const toggleAttendance = async () => {
    if (!currentUser) {
      Alert.alert('Authentication Error', 'You must be logged in to RSVP to events');
      return;
    }
    
    setLoading(true);
    
    try {
      // Just update UI state for the prototype
      if (attending) {
        setAttending(false);
        setAttendees(attendees.filter(a => a.id !== currentUser.id));
        
        Alert.alert(
          'Attendance Canceled', 
          'You are no longer attending this event'
        );
      } else {
        // Add user to local attendees list
        const userData = {
          id: currentUser.id,
          name: currentUser.email?.split('@')[0] || 'You',
          phone_number: null
        };
        
        setAttending(true);
        setAttendees([...attendees, userData]);
        
        // Prompt user to invite others
        setTimeout(() => {
          Alert.alert(
            'Successfully Registered',
            'Would you like to invite friends or groups to join you?',
            [
              {
                text: 'Not now',
                style: 'cancel'
              },
              {
                text: 'Invite Friends',
                onPress: () => setShowInviteContactsModal(true)
              },
              {
                text: 'Invite Groups',
                onPress: () => setShowInviteGroupModal(true)
              }
            ]
          );
        }, 300);
      }
    } catch (error) {
      console.error('Error updating attendance state:', error);
      Alert.alert('Error', 'Failed to update attendance status');
    } finally {
      setLoading(false);
    }
  };

  const handleInvitationResponse = async (status) => {
    if (!invitation || !currentUser || !eventDetails) {
      return;
    }
    
    setLoading(true);
    
    try {
      if (status === 'accepted') {
        // For prototype, just update UI state
        setAttending(true);
        
        // Create user data for current user
        const userData = {
          id: currentUser.id,
          name: currentUser.email?.split('@')[0] || 'You',
          phone_number: currentUser.phone_number
        };
        
        // Add user to attendees if not already there
        if (!attendees.some(a => a.id === currentUser.id)) {
          setAttendees([...attendees, userData]);
        }
        
        // Update invitation status in UI only
        setInvitation({...invitation, status: 'accepted'});
        
        // Prompt user to invite others
        setTimeout(() => {
          Alert.alert(
            'Thanks for accepting!',
            'Would you like to invite others to join you?',
            [
              {
                text: 'Not now',
                style: 'cancel'
              },
              {
                text: 'Invite Friends',
                onPress: () => setShowInviteContactsModal(true)
              },
              {
                text: 'Invite Groups',
                onPress: () => setShowInviteGroupModal(true)
              }
            ]
          );
        }, 300);
      } else if (status === 'declined') {
        // Just update UI for prototype
        setInvitation({...invitation, status: 'declined'});
        Alert.alert('Invitation Declined', 'You have declined this invitation');
      }
    } catch (error) {
      console.error('Error updating invitation response:', error);
      Alert.alert('Error', 'Failed to respond to invitation');
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

  const toggleGroupSelection = (group) => {
    setSelectedGroups(prevSelected => {
      const isSelected = prevSelected.some(g => g.id === group.id);
      
      if (isSelected) {
        return prevSelected.filter(g => g.id !== group.id);
      } else {
        return [...prevSelected, group];
      }
    });
  };

  const inviteGroupsToEvent = async () => {
    if (selectedGroups.length === 0) {
      setShowInviteGroupModal(false);
      return;
    }
    
    try {
      setLoading(true);
      
      // For prototype, just show success message without database interactions
      setTimeout(() => {
        // Calculate total would-be members
        const totalMembers = selectedGroups.reduce((total, group) => total + (group.memberCount || 0), 0);
        
        Alert.alert(
          'Success', 
          `Invitations would be sent to ${totalMembers} group members across ${selectedGroups.length} groups.`
        );
        
        // Reset selection and close modal
        setSelectedGroups([]);
        setShowInviteGroupModal(false);
      }, 500);
    } catch (error) {
      console.error('Error simulating group invites:', error);
      Alert.alert('Error', 'Failed to invite groups to event. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const renderGroupItem = ({ item }) => (
    <View style={styles.groupItem}>
      <View style={styles.groupInfo}>
        <Text style={styles.groupName}>{item.name}</Text>
        <Text style={styles.groupMeta}>
          {item.memberCount} {item.memberCount === 1 ? 'member' : 'members'}
        </Text>
      </View>
    </View>
  );

  const renderInviteGroupItem = ({ item }) => {
    const isSelected = selectedGroups.some(g => g.id === item.id);
    
    return (
      <TouchableOpacity 
        style={[styles.groupItem, isSelected && styles.selectedGroupItem]}
        onPress={() => toggleGroupSelection(item)}
      >
        <View style={styles.groupInfo}>
          <Text style={styles.groupName}>{item.name}</Text>
          <Text style={styles.groupMeta}>
            {item.memberCount} {item.memberCount === 1 ? 'member' : 'members'} • 
            {item.isHost ? ' You are host' : ' Member'}
          </Text>
        </View>
        
        <View style={styles.checkboxContainer}>
          {isSelected ? (
            <MaterialIcons name="check-circle" size={24} color={COLORS.primary} />
          ) : (
            <View style={styles.emptyCheckbox} />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  // Add real-time subscription to attendees changes - works for both custom and Ticketmaster events
  useEffect(() => {
    if (!eventDetails?.id) return;
    
    // Table name depends on event type
    const tableName = isTicketmasterEvent ? 'ticketmaster_event_attendees' : 'event_attendees';
    
    // Set up real-time subscription for event attendees
    const attendeesSubscription = supabase
      .channel(`event-attendees-${eventDetails.id}`)
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: tableName,
          filter: `event_id=eq.${eventDetails.id}`
        }, 
        (payload) => {
          console.log('Attendees changed:', payload);
          // Refresh the attendees list
          fetchAttendees();
        }
      )
      .subscribe();
      
    // Cleanup subscription on unmount
    return () => {
      supabase.removeChannel(attendeesSubscription);
    };
  }, [eventDetails?.id, isTicketmasterEvent]);
  
  // Add a separate function to fetch attendees for both custom and Ticketmaster events
  const fetchAttendees = async () => {
    if (!eventDetails?.id) return;
    
    setLoadingAttendees(true);
    try {
      // Table name depends on event type
      const tableName = isTicketmasterEvent ? 'ticketmaster_event_attendees' : 'event_attendees';
      
      // For Ticketmaster events, ensure the table exists
      if (isTicketmasterEvent) {
        await ensureTicketmasterTables();
      }
      
      // Get attendees
      // First, get the list of user IDs who are attending
      const { data: attendeeRecords, error: attendeeError } = await supabase
        .from(tableName)
        .select('user_id')
        .eq('event_id', eventDetails.id);
      
      // If we have a table error for Ticketmaster events, it might be because the table doesn't exist yet
      // In this case, just set empty attendees and return
      if (attendeeError) {
        console.error('Error fetching attendee records:', attendeeError);
        
        // Check if the error is specifically about the table not existing
        if (isTicketmasterEvent && attendeeError.code === '42P01') {
          console.log('Ticketmaster attendees table does not exist yet, returning empty array');
          setAttendees([]);
          return;
        }
        
        throw attendeeError;
      }
      
      if (!attendeeRecords || attendeeRecords.length === 0) {
        // No attendees, set empty array
        setAttendees([]);
      } else {
        // Extract user IDs
        const userIds = attendeeRecords.map(record => record.user_id);
        
        // Then fetch the user details for those IDs
        const { data: attendeeData, error: userError } = await supabase
          .from('users')
          .select('id, name, phone_number')
          .in('id', userIds);
          
        if (userError) {
          console.error('Error fetching attendee user data:', userError);
          throw userError;
        }
        
        setAttendees(attendeeData || []);
        
        // Update attending status for current user
        if (currentUser) {
          const isAttending = userIds.includes(currentUser.id);
          setAttending(isAttending);
        }
      }
    } catch (error) {
      console.error('Error fetching attendees:', error);
      // Set empty array in case of error to avoid showing stale data
      setAttendees([]);
    } finally {
      setLoadingAttendees(false);
    }
  };

  // Function to invite individual contacts - prototype mode
  const inviteContacts = async (selectedContacts) => {
    if (!selectedContacts || selectedContacts.length === 0) {
      return;
    }
    
    setLoading(true);
    try {
      // For prototype, just show success without database interactions
      setTimeout(() => {
        Alert.alert(
          'Success', 
          `Invitations sent to ${selectedContacts.length} contacts.`
        );
        
        setShowInviteContactsModal(false);
      }, 500);
    } catch (error) {
      console.error('Error simulating invites:', error);
      Alert.alert('Error', 'Failed to invite contacts to this event.');
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading || (loading && !eventDetails)) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading event details...</Text>
      </View>
    );
  }
  
  // If we somehow got here without event details, show an error
  if (!eventDetails) {
    return (
      <View style={styles.loadingContainer}>
        <MaterialIcons name="error" size={48} color={COLORS.danger} />
        <Text style={styles.errorText}>Could not load event details</Text>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
        alwaysBounceVertical={true}
      >
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
          
          {/* Attendance/Invitation Response Buttons */}
          {currentUser && eventDetails.host_id !== currentUser.id && (
            <View>
              {/* Show invitation response buttons if user is invited */}
              {invitation && invitation.status === 'pending' ? (
                <View style={styles.invitationButtons}>
                  <TouchableOpacity
                    style={[styles.invitationButton, styles.acceptButton]}
                    onPress={() => handleInvitationResponse('accepted')}
                    disabled={loading || loadingInvitation}
                  >
                    {loading ? (
                      <ActivityIndicator color="white" size="small" />
                    ) : (
                      <Text style={styles.invitationButtonText}>Accept</Text>
                    )}
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[styles.invitationButton, styles.declineButton]}
                    onPress={() => handleInvitationResponse('declined')}
                    disabled={loading || loadingInvitation}
                  >
                    <Text style={styles.invitationButtonText}>Decline</Text>
                  </TouchableOpacity>
                </View>
              ) : invitation && invitation.status === 'accepted' ? (
                <View style={styles.responseStatusContainer}>
                  <Text style={styles.responseStatusText}>
                    You accepted this invitation
                  </Text>
                  <TouchableOpacity
                    style={[styles.rsvpButton, styles.cancelButton]}
                    onPress={toggleAttendance}
                    disabled={loading}
                  >
                    {loading ? (
                      <ActivityIndicator color="white" size="small" />
                    ) : (
                      <Text style={styles.rsvpButtonText}>
                        Cancel Attendance
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              ) : invitation && invitation.status === 'declined' ? (
                <View style={styles.responseStatusContainer}>
                  <Text style={styles.responseStatusText}>
                    You declined this invitation
                  </Text>
                  <TouchableOpacity
                    style={[styles.rsvpButton, styles.attendButton]}
                    onPress={() => handleInvitationResponse('accepted')}
                    disabled={loading}
                  >
                    {loading ? (
                      <ActivityIndicator color="white" size="small" />
                    ) : (
                      <Text style={styles.rsvpButtonText}>
                        Attend Event
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              ) : (
                /* Regular RSVP button for non-invited users */
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
              
              {/* Show Invite buttons if user is attending */}
              {attending && (
                <View style={styles.inviteOptionsContainer}>
                  <Text style={styles.invitePromptText}>Invite others to join you:</Text>
                  <View style={styles.inviteButtonsRow}>
                    <TouchableOpacity
                      style={[styles.inviteOptionButton, styles.friendsButton]}
                      onPress={() => setShowInviteContactsModal(true)}
                    >
                      <MaterialIcons name="person-add" size={20} color="white" />
                      <Text style={styles.inviteOptionButtonText}>Friends</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      style={[styles.inviteOptionButton, styles.groupsButton]}
                      onPress={() => setShowInviteGroupModal(true)}
                    >
                      <MaterialIcons name="group-add" size={20} color="white" />
                      <Text style={styles.inviteOptionButtonText}>Groups</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
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
          
          {/* Invited Groups Section */}
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Invited Groups</Text>
              
              {/* Only show invite groups button for the event host */}
              {eventDetails.host_id === currentUser?.id && (
                <TouchableOpacity 
                  style={styles.inviteGroupButton}
                  onPress={() => setShowInviteGroupModal(true)}
                >
                  <MaterialIcons name="add" size={18} color="white" />
                  <Text style={styles.inviteGroupButtonText}>Invite Groups</Text>
                </TouchableOpacity>
              )}
            </View>
            
            {loadingGroups ? (
              <ActivityIndicator size="small" color={COLORS.primary} />
            ) : invitedGroups.length > 0 ? (
              <FlatList
                data={invitedGroups}
                keyExtractor={item => item.id}
                renderItem={renderGroupItem}
                scrollEnabled={false}
                contentContainerStyle={styles.groupsList}
              />
            ) : (
              <Text style={styles.emptyText}>No groups invited to this event</Text>
            )}
          </View>
          
          {/* For Ticketmaster events, show source info instead of external link */}
          {isTicketmasterEvent && (
            <View style={styles.ticketmasterSourceContainer}>
              <MaterialIcons name="event" size={20} color={COLORS.primary} />
              <Text style={styles.ticketmasterSourceText}>
                This event information is from Ticketmaster
              </Text>
            </View>
          )}
          
          {/* Invite Friends Button shown only at the bottom if user is event host or not attending */}
          {currentUser && (eventDetails.host_id === currentUser.id || !attending) && (
            <TouchableOpacity
              style={[styles.rsvpButton, styles.inviteButton]}
              onPress={() => setShowInviteContactsModal(true)}
            >
              <Text style={styles.rsvpButtonText}>Invite Friends</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* Invite Groups Modal */}
      <Modal
        visible={showInviteGroupModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowInviteGroupModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Invite Groups</Text>
              <TouchableOpacity onPress={() => setShowInviteGroupModal(false)}>
                <MaterialIcons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            
            {loadingUserGroups ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={COLORS.primary} />
                <Text style={styles.loadingText}>Loading groups...</Text>
              </View>
            ) : (
              <>
                <FlatList
                  data={userGroups}
                  keyExtractor={(item) => item.id.toString()}
                  renderItem={renderInviteGroupItem}
                  contentContainerStyle={styles.groupsList}
                  scrollEnabled={true}
                  nestedScrollEnabled={true}
                  style={{ maxHeight: '60%', flexGrow: 0 }}
                  ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                      <Text style={styles.emptyText}>
                        {invitedGroups.length > 0 
                          ? 'All your groups are already invited to this event' 
                          : 'You don\'t have any groups yet. Create a group first to invite.'}
                      </Text>
                    </View>
                  }
                />
                
                <View style={styles.modalFooter}>
                  <TouchableOpacity 
                    style={[
                      styles.inviteButton,
                      selectedGroups.length === 0 && styles.disabledButton
                    ]}
                    disabled={selectedGroups.length === 0}
                    onPress={inviteGroupsToEvent}
                  >
                    <Text style={styles.inviteButtonText}>
                      Invite Groups ({selectedGroups.length})
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Invite Contacts Modal */}
      <Modal
        visible={showInviteContactsModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowInviteContactsModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Invite Friends</Text>
              <TouchableOpacity onPress={() => setShowInviteContactsModal(false)}>
                <MaterialIcons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            
            <ScrollView contentContainerStyle={{ padding: SPACING.md }} style={{ maxHeight: '80%' }}>
              <Text style={styles.infoText}>Select friends to invite to this event.</Text>
              <TouchableOpacity 
                style={[styles.inviteButton, { marginTop: SPACING.md }]}
                onPress={() => {
                  // This would normally pass selected contacts
                  // For now we're just closing the modal
                  setShowInviteContactsModal(false);
                  navigation.navigate('ContactsScreen', { 
                    onContactsSelected: inviteContacts,
                    eventId: eventDetails.id,
                    isTicketmasterEvent: isTicketmasterEvent,
                    eventData: isTicketmasterEvent ? eventDetails : null
                  });
                }}
              >
                <Text style={styles.inviteButtonText}>Select Contacts</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
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
    paddingBottom: 40, // Add extra bottom padding to ensure scrolling to the end
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
  errorText: {
    marginTop: SPACING.md,
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
  },
  backButtonText: {
    color: COLORS.primary,
    fontSize: FONT_SIZES.md,
    fontWeight: 'bold',
  },
  invitationButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: SPACING.sm,
  },
  invitationButton: {
    flex: 1,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: LAYOUT.borderRadius,
    marginRight: SPACING.sm,
  },
  acceptButton: {
    backgroundColor: '#4CAF50',
  },
  declineButton: {
    backgroundColor: '#F44336',
  },
  invitationButtonText: {
    color: 'white',
    fontSize: FONT_SIZES.md,
    fontWeight: 'bold',
  },
  responseStatusContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.sm,
  },
  responseStatusText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
  },
  sectionContainer: {
    marginTop: SPACING.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  inviteGroupButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  inviteGroupButtonText: {
    color: 'white',
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    marginLeft: 4,
  },
  groupItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 8,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
  },
  selectedGroupItem: {
    backgroundColor: `${COLORS.primary}15`,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  groupInfo: {
    flex: 1,
  },
  groupName: {
    fontSize: FONT_SIZES.md,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 2,
  },
  groupMeta: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  groupsList: {
    paddingTop: SPACING.sm,
  },
  emptyText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.placeholder,
    marginTop: SPACING.sm,
  },
  checkboxContainer: {
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyCheckbox: {
    width: 22,
    height: 22,
    borderWidth: 2,
    borderColor: COLORS.primary,
    borderRadius: 12,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.md,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    width: '90%',
    maxHeight: '80%',
    paddingBottom: SPACING.md,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  modalFooter: {
    padding: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    alignItems: 'center',
  },
  inviteButton: {
    backgroundColor: '#6366F1', // Purple
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    borderRadius: 8,
    alignItems: 'center',
    width: '100%',
  },
  inviteButtonText: {
    color: 'white',
    fontSize: FONT_SIZES.md,
    fontWeight: 'bold',
  },
  disabledButton: {
    backgroundColor: COLORS.border,
    opacity: 0.7,
  },
  emptyContainer: {
    padding: SPACING.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ticketmasterSourceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    marginTop: SPACING.sm,
    backgroundColor: '#f0f9ff',
    borderRadius: LAYOUT.borderRadius,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  ticketmasterSourceText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    marginLeft: SPACING.sm,
  },
  inviteOptionsContainer: {
    marginTop: SPACING.md,
  },
  invitePromptText: {
    fontSize: FONT_SIZES.md,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  inviteButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  inviteOptionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.sm,
    borderRadius: 8,
    flex: 0.48, // Take up almost half the width with a small gap between
    height: 44,
  },
  friendsButton: {
    backgroundColor: '#4CAF50',
  },
  groupsButton: {
    backgroundColor: '#6366F1',
  },
  inviteOptionButtonText: {
    color: 'white',
    fontSize: FONT_SIZES.sm,
    fontWeight: 'bold',
    marginLeft: SPACING.sm,
  },
});

export default EventDetailsScreen; 