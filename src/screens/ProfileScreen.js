import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  SafeAreaView, 
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  FlatList,
  ScrollView,
  SectionList,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Keyboard
} from 'react-native';
import * as Contacts from 'expo-contacts';
import { supabase } from '../services/supabaseClient';
import { COLORS, SPACING, FONT_SIZES } from '../constants';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { checkInvitationStatus } from '../services/authService';

const ProfileScreen = ({ navigation }) => {
  const [user, setUser] = useState(null);
  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showContacts, setShowContacts] = useState(false);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [contacts, setContacts] = useState([]);
  const [registeredContacts, setRegisteredContacts] = useState([]);
  const [unregisteredContacts, setUnregisteredContacts] = useState([]);
  const [invitedContacts, setInvitedContacts] = useState([]);
  const [stats, setStats] = useState({
    eventsHosted: 0,
    eventsAttended: 0
  });

  useEffect(() => {
    fetchUserProfileData();
  }, []);

  const fetchUserProfileData = async () => {
    try {
      setLoading(true);
      
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError) throw userError;
      if (!user) {
        // Not authenticated, redirect to signin
        navigation.replace('SignIn');
        return;
      }
      
      setUser(user);
      
      // Get profile data
      const { data: profileData, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();
        
      if (profileError) throw profileError;
      setProfileData(profileData);

      // Get events hosted count
      const { data: hostedEvents, error: hostedError } = await supabase
        .from('events')
        .select('id', { count: 'exact' })
        .eq('host_id', user.id);
        
      if (hostedError) throw hostedError;
      
      // Get events attended count
      const { data: attendedEvents, error: attendedError } = await supabase
        .from('event_attendees')
        .select('event_id', { count: 'exact' })
        .eq('user_id', user.id);
        
      if (attendedError) throw attendedError;
      
      setStats({
        eventsHosted: hostedEvents?.length || 0,
        eventsAttended: attendedEvents?.length || 0
      });

      // Get invited contacts
      const { data: invitations, error: invitationsError } = await supabase
        .from('invitations')
        .select('*')
        .eq('inviter_id', user.id);

      if (!invitationsError && invitations) {
        setInvitedContacts(invitations);
      }
      
    } catch (error) {
      console.error('Error fetching profile data:', error);
      Alert.alert('Error', 'Failed to load profile data');
    } finally {
      setLoading(false);
    }
  };

  const fetchContacts = async () => {
    try {
      setLoadingContacts(true);
      setShowContacts(true);
      
      // Request permissions first
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Cannot access contacts');
        setLoadingContacts(false);
        return;
      }
      
      // Get contacts
      const { data } = await Contacts.getContactsAsync({
        fields: [
          Contacts.Fields.PhoneNumbers,
          Contacts.Fields.Name,
          Contacts.Fields.Image
        ],
        sort: Contacts.SortTypes.FirstName
      });
      
      setContacts(data);
      
      // Filter contacts with phone numbers
      const contactsWithPhones = data.filter(
        contact => contact.phoneNumbers && contact.phoneNumbers.length > 0
      );
      
      // Standardize phone numbers
      const phoneNumbers = contactsWithPhones.flatMap(contact => 
        contact.phoneNumbers.map(phone => ({
          contactId: contact.id,
          standardizedNumber: phone.number.replace(/\D/g, ''),
          contact
        }))
      );
      
      // Check which contacts are registered
      const standardizedNumbers = phoneNumbers.map(p => p.standardizedNumber);
      const { data: registeredUsers, error } = await supabase
        .from('users')
        .select('phone_number, name, id, email')
        .in('phone_number', standardizedNumbers);
      
      if (error) throw error;

      // Get invitations to check already invited contacts
      const { data: invitations } = await supabase
        .from('invitations')
        .select('invited_phone, status, created_at')
        .eq('inviter_id', user.id);
      
      const invitedPhones = new Map();
      if (invitations) {
        invitations.forEach(inv => {
          invitedPhones.set(inv.invited_phone, {
            status: inv.status,
            invitedAt: inv.created_at
          });
        });
      }
      
      // Create lookup map of registered numbers
      const registeredNumbersMap = new Map();
      registeredUsers.forEach(user => {
        registeredNumbersMap.set(user.phone_number, user);
      });
      
      // Divide contacts into registered and unregistered
      const registered = [];
      const unregistered = [];
      const processedIds = new Set();
      
      phoneNumbers.forEach(({ contactId, standardizedNumber, contact }) => {
        if (processedIds.has(contactId)) return;
        
        if (registeredNumbersMap.has(standardizedNumber)) {
          const appUser = registeredNumbersMap.get(standardizedNumber);
          registered.push({
            ...contact,
            appUserId: appUser.id,
            appUserName: appUser.name,
            appUserEmail: appUser.email
          });
          processedIds.add(contactId);
        } else {
          // Check if this contact was already invited
          const isInvited = invitedPhones.has(standardizedNumber);
          const invitationData = isInvited ? invitedPhones.get(standardizedNumber) : null;
          
          unregistered.push({
            ...contact,
            isInvited,
            invitationStatus: invitationData?.status || null,
            invitedAt: invitationData?.invitedAt || null
          });
          processedIds.add(contactId);
        }
      });
      
      setRegisteredContacts(registered);
      setUnregisteredContacts(unregistered);
      
    } catch (error) {
      console.error('Error fetching contacts:', error);
      Alert.alert('Error', 'Failed to load contacts');
    } finally {
      setLoadingContacts(false);
    }
  };

  const handleInvite = async (contact) => {
    try {
      // Check if contact is already invited
      const phoneNumber = contact.phoneNumbers[0]?.number;
      if (!phoneNumber) {
        Alert.alert('Error', 'This contact does not have a phone number');
        return;
      }
      
      const isInvited = await checkInvitationStatus(phoneNumber);
      
      if (isInvited) {
        Alert.alert(
          'Already Invited',
          `${contact.name} has already been invited to join FriendFinder.`
        );
        return;
      }
      
      // Show alert instead of navigating to InviteContactScreen
      Alert.alert(
        'Invite Contact',
        `Would you like to invite ${contact.name} to join FriendFinder?`,
        [
          {
            text: 'Cancel',
            style: 'cancel'
          },
          {
            text: 'Invite',
            onPress: () => {
              Alert.alert(
                'Invitation Sent',
                `An invitation has been sent to ${contact.name || 'your contact'}`,
                [{ text: 'OK' }]
              );
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error checking invitation status:', error);
      Alert.alert('Error', 'Failed to check invitation status');
    }
  };

  const renderContactItem = ({ item }) => {
    const contactName = item.name || 'No Name';
    const phoneNumber = item.phoneNumbers && item.phoneNumbers.length > 0
      ? item.phoneNumbers[0].number
      : 'No Phone';
    
    // Check if this is a registered contact
    const isRegistered = 'appUserId' in item;
    
    return (
      <View style={styles.contactItem}>
        <View style={styles.contactInfo}>
          <Text style={styles.contactName}>{contactName}</Text>
          <Text style={styles.contactPhone}>{phoneNumber}</Text>
          {isRegistered && (
            <Text style={styles.registeredBadge}>FriendFinder User</Text>
          )}
          {!isRegistered && item.isInvited && (
            <Text style={styles.invitedBadge}>
              Invited • {new Date(item.invitedAt).toLocaleDateString()}
            </Text>
          )}
        </View>
        
        {isRegistered ? (
          <TouchableOpacity
            style={styles.viewProfileButton}
            onPress={() => navigation.navigate('UserProfile', { userId: item.appUserId })}
          >
            <Text style={styles.viewProfileButtonText}>View Profile</Text>
          </TouchableOpacity>
        ) : item.isInvited ? (
          <TouchableOpacity
            style={[styles.inviteButton, styles.invitedButton]}
            disabled={true}
          >
            <Text style={styles.inviteButtonText}>Invited</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.inviteButton}
            onPress={() => handleInvite(item)}
          >
            <Text style={styles.inviteButtonText}>Invite</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderContactsList = () => (
    <View style={styles.contactsContainer}>
      <View style={styles.contactsHeader}>
        <TouchableOpacity style={styles.backButton} onPress={() => setShowContacts(false)}>
          <MaterialIcons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.contactsTitle}>My Contacts</Text>
      </View>
      
      {loadingContacts ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading contacts...</Text>
        </View>
      ) : (
        <FlatList
          data={[
            { title: 'FriendFinder Users', data: registeredContacts, emptyText: 'No registered contacts found' },
            { title: 'Other Contacts', data: unregisteredContacts, emptyText: 'No contacts to invite' }
          ]}
          keyExtractor={(item, index) => `section-${index}`}
          renderItem={({ item, index }) => (
            <View style={styles.sectionContainer}>
              <Text style={styles.sectionTitle}>{item.title} ({item.data.length})</Text>
              {item.data.length > 0 ? (
                item.data.map((contact, idx) => (
                  <View key={`contact-${index}-${idx}`}>
                    {renderContactItem({ item: contact })}
                  </View>
                ))
              ) : (
                <Text style={styles.emptyListText}>{item.emptyText}</Text>
              )}
            </View>
          )}
        />
      )}
    </View>
  );

  const renderProfile = () => (
    <ScrollView style={styles.profileContainer}>
      {/* Profile Image */}
      <View style={styles.profileImageContainer}>
        {profileData?.avatar_url ? (
          <Image 
            source={{ uri: profileData.avatar_url }} 
            style={styles.profileImage} 
          />
        ) : (
          <View style={styles.profileImagePlaceholder}>
            <Text style={styles.profileInitial}>
              {profileData?.name ? profileData.name.charAt(0).toUpperCase() : 
               user?.email ? user.email.charAt(0).toUpperCase() : '?'}
            </Text>
          </View>
        )}
      </View>
      
      {/* User Info */}
      <View style={styles.userInfoContainer}>
        <Text style={styles.userName}>
          {profileData?.name || user?.email?.split('@')[0] || 'User'}
        </Text>
        <Text style={styles.userEmail}>{user?.email || 'No email'}</Text>
        <Text style={styles.userPhone}>
          {profileData?.phone_number || 'No phone number'}
        </Text>
      </View>
      
      {/* Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{stats.eventsHosted}</Text>
          <Text style={styles.statLabel}>Events Hosted</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{stats.eventsAttended}</Text>
          <Text style={styles.statLabel}>Events Attended</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{invitedContacts.length}</Text>
          <Text style={styles.statLabel}>Friends Invited</Text>
        </View>
      </View>
      
      {/* Actions */}
      <View style={styles.actionsContainer}>
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={fetchContacts}
        >
          <MaterialIcons name="people" size={24} color="white" />
          <Text style={styles.actionButtonText}>View My Contacts</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.actionButton, styles.secondaryButton]}
          onPress={() => navigation.navigate('EditEvent')}
        >
          <MaterialIcons name="edit" size={24} color="white" />
          <Text style={styles.actionButtonText}>Edit Profile</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.actionButton, styles.dangerButton]}
          onPress={async () => {
            try {
              await supabase.auth.signOut();
            } catch (error) {
              console.error('Error signing out:', error);
            }
          }}
        >
          <MaterialIcons name="logout" size={24} color="white" />
          <Text style={styles.actionButtonText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.container}>
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      ) : showContacts ? (
        renderContactsList()
      ) : (
        renderProfile()
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background || '#FFFFFF',
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
  profileContainer: {
    flex: 1,
    padding: SPACING.md,
  },
  profileImageContainer: {
    alignItems: 'center',
    marginTop: SPACING.xl,
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  profileImagePlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInitial: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: 'bold',
    color: 'white',
  },
  userInfoContainer: {
    alignItems: 'center',
    marginTop: SPACING.lg,
  },
  userName: {
    fontSize: FONT_SIZES.xl,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  userEmail: {
    fontSize: FONT_SIZES.md,
    color: COLORS.secondaryText || '#666',
    marginBottom: SPACING.xs,
  },
  userPhone: {
    fontSize: FONT_SIZES.md,
    color: COLORS.secondaryText || '#666',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    marginTop: SPACING.xl,
    padding: SPACING.md,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: FONT_SIZES.xl,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  statLabel: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.secondaryText || '#666',
    marginTop: SPACING.xs,
  },
  statDivider: {
    width: 1,
    backgroundColor: COLORS.border,
    marginHorizontal: SPACING.md,
  },
  actionsContainer: {
    marginTop: SPACING.xl,
    gap: SPACING.md,
  },
  actionButton: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    borderRadius: 10,
  },
  secondaryButton: {
    backgroundColor: COLORS.secondary || '#0EA5E9',
  },
  dangerButton: {
    backgroundColor: COLORS.danger || '#DC2626',
  },
  actionButtonText: {
    color: 'white',
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    marginLeft: SPACING.sm,
  },
  contactsContainer: {
    flex: 1,
  },
  contactsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    marginRight: SPACING.md,
  },
  contactsTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.text,
    flex: 1,
  },
  sectionContainer: {
    marginBottom: SPACING.lg,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: 'bold',
    backgroundColor: COLORS.lightBackground || '#F3F4F6',
    padding: SPACING.sm,
    color: COLORS.text,
  },
  contactItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: FONT_SIZES.md,
    fontWeight: '500',
    color: COLORS.text,
    marginBottom: 2,
  },
  contactPhone: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.secondaryText || '#666',
  },
  registeredBadge: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.primary,
    marginTop: 2,
    fontWeight: '500',
  },
  invitedBadge: {
    fontSize: FONT_SIZES.xs,
    color: '#F59E0B', // Amber color for invited status
    marginTop: 2,
    fontWeight: '500',
  },
  viewProfileButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: 5,
  },
  viewProfileButtonText: {
    color: 'white',
    fontSize: FONT_SIZES.sm,
    fontWeight: '500',
  },
  inviteButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  invitedButton: {
    backgroundColor: '#D1D5DB', // Gray color for already invited
  },
  inviteButtonText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.xs,
    fontWeight: 'bold',
  },
  inviteIcon: {
    marginLeft: 4,
  },
  emptyListText: {
    padding: SPACING.md,
    fontSize: FONT_SIZES.md,
    color: COLORS.secondaryText || '#666',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  sectionHeader: {
    backgroundColor: COLORS.backgroundLight,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
  },
  emptyTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: 'bold',
    color: COLORS.textLight,
    marginTop: SPACING.md,
  },
  emptySubtitle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textLight,
    textAlign: 'center',
    marginTop: SPACING.xs,
  },
  emptyText: {
    textAlign: 'center',
    padding: SPACING.md,
    color: COLORS.textLight,
    fontSize: FONT_SIZES.sm,
  },
  contactsList: {
    flex: 1,
  },
});

export default ProfileScreen; 