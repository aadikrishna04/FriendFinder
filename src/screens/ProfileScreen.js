import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  SafeAreaView, 
  TouchableOpacity,
  TouchableWithoutFeedback,
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

const ProfileScreen = ({ navigation, route }) => {
  // Check if in group selection mode
  const isGroupSelection = route?.params?.isGroupSelection || false;
  const groupId = route?.params?.groupId;
  const onContactsSelected = route?.params?.onContactsSelected;
  
  const [user, setUser] = useState(null);
  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showContacts, setShowContacts] = useState(isGroupSelection); // Auto-show contacts in group selection mode
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [contacts, setContacts] = useState([]);
  const [registeredContacts, setRegisteredContacts] = useState([]);
  const [unregisteredContacts, setUnregisteredContacts] = useState([]);
  const [invitedContacts, setInvitedContacts] = useState([]);
  const [showAddContactModal, setShowAddContactModal] = useState(false);
  const [newContact, setNewContact] = useState({
    name: '',
    email: '',
    phoneNumber: ''
  });
  const [errors, setErrors] = useState({});
  const [stats, setStats] = useState({
    eventsHosted: 0,
    eventsAttended: 0
  });
  
  // For group selection mode
  const [selectedContacts, setSelectedContacts] = useState([]);

  useEffect(() => {
    fetchUserProfileData();
    
    // If in group selection mode, fetch contacts right away
    if (isGroupSelection) {
      fetchContacts();
    }
  }, [isGroupSelection]);

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
      
      // 1. Get registered contacts from the database
      const { data: contactsData, error: contactsError } = await supabase
        .from('contacts')
        .select(`
          id, 
          name, 
          email, 
          phone_number,
          contact_id,
          users:contact_id(name, email, phone_number)
        `)
        .eq('owner_id', user?.id)
        .order('name');
      
      if (contactsError) throw contactsError;
      
      // Set the registered contacts
      setRegisteredContacts(contactsData || []);
      
      // 2. Get device contacts
      try {
        // Request permissions first
        const { status } = await Contacts.requestPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Denied', 'Cannot access device contacts');
          setLoadingContacts(false);
          return;
        }
        
        // Get device contacts
        const { data } = await Contacts.getContactsAsync({
          fields: [
            Contacts.Fields.PhoneNumbers,
            Contacts.Fields.Emails,
            Contacts.Fields.Name,
            Contacts.Fields.Image
          ],
          sort: Contacts.SortTypes.FirstName
        });
        
        // Filter device contacts with phone numbers or emails
        const validContacts = data.filter(
          contact => (contact.phoneNumbers && contact.phoneNumbers.length > 0) || 
                    (contact.emails && contact.emails.length > 0)
        );
        
        // Get invitations to check already invited contacts
        const { data: invitations } = await supabase
          .from('invitations')
          .select('invited_phone, invited_email, status, created_at')
          .eq('inviter_id', user.id);
        
        // Create maps for phone numbers and emails in invitations
        const invitedPhones = new Map();
        const invitedEmails = new Map();
        
        if (invitations) {
          invitations.forEach(inv => {
            if (inv.invited_phone) {
              invitedPhones.set(inv.invited_phone, {
                status: inv.status,
                invitedAt: inv.created_at
              });
            }
            if (inv.invited_email) {
              invitedEmails.set(inv.invited_email.toLowerCase(), {
                status: inv.status,
                invitedAt: inv.created_at
              });
            }
          });
        }
        
        // Prepare unregistered contacts with invitation status
        const deviceContactsWithInviteStatus = validContacts.map(contact => {
          // Check if any phone number is in invited list
          let isInvited = false;
          let invitationData = null;
          
          if (contact.phoneNumbers && contact.phoneNumbers.length > 0) {
            for (const phone of contact.phoneNumbers) {
              const formattedPhone = phone.number.replace(/\D/g, '');
              if (invitedPhones.has(formattedPhone)) {
                isInvited = true;
                invitationData = invitedPhones.get(formattedPhone);
                break;
              }
            }
          }
          
          // If not found by phone, check emails
          if (!isInvited && contact.emails && contact.emails.length > 0) {
            for (const email of contact.emails) {
              const lowercaseEmail = email.email.toLowerCase();
              if (invitedEmails.has(lowercaseEmail)) {
                isInvited = true;
                invitationData = invitedEmails.get(lowercaseEmail);
                break;
              }
            }
          }
          
          return {
            ...contact,
            isInvited,
            invitationStatus: invitationData?.status || null,
            invitedAt: invitationData?.invitedAt || null
          };
        });
        
        setUnregisteredContacts(deviceContactsWithInviteStatus);
      } catch (contactsError) {
        console.error('Error fetching device contacts:', contactsError);
        // Don't throw - we can still show database contacts
        setUnregisteredContacts([]);
      }
      
    } catch (error) {
      console.error('Error fetching contacts:', error);
      Alert.alert('Error', 'Failed to load contacts');
    } finally {
      setLoadingContacts(false);
    }
  };

  const handleInvite = async (contact) => {
    try {
      // Check if contact has a phone number
      if (!contact.phoneNumbers || contact.phoneNumbers.length === 0) {
        Alert.alert('Cannot Invite', 'This contact does not have a phone number.');
        return;
      }
      
      const phoneNumber = contact.phoneNumbers[0].number;
      
      // Check if already invited
      if (contact.isInvited) {
        Alert.alert(
          'Already Invited',
          `${contact.name} has already been invited to join FriendFinder.`
        );
        return;
      }
      
      // Show alert to confirm invitation
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
            onPress: async () => {
              try {
                // Format phone number
                const formattedPhone = phoneNumber.replace(/\D/g, '');
                
                // Record invitation in database
                const { error } = await supabase
                  .from('invitations')
                  .insert({
                    inviter_id: user.id,
                    invited_phone: formattedPhone,
                    invited_email: contact.emails?.[0]?.email || null,
                    status: 'sent',
                    name: contact.name
                  });
                
                if (error) throw error;
                
                Alert.alert(
                  'Invitation Sent',
                  `An invitation has been sent to ${contact.name || 'your contact'}`,
                  [{ text: 'OK' }]
                );
                
                // Refresh contacts to update invitation status
                fetchContacts();
              } catch (error) {
                console.error('Error sending invitation:', error);
                Alert.alert('Error', 'Failed to send invitation');
              }
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error inviting contact:', error);
      Alert.alert('Error', 'Failed to process invitation');
    }
  };

  const renderContactItem = ({ item }) => {
    const contactName = item.name || 'No Name';
    const phoneNumber = item.phone_number || 'No Phone';
    const email = item.email || 'No Email';
    const isSelected = isGroupSelection && selectedContacts.some(c => c.id === item.id);
    
    return (
      <TouchableOpacity 
        style={[styles.contactItem, isSelected && styles.selectedContactItem]}
        onPress={() => {
          if (isGroupSelection) {
            toggleContactSelection(item);
          } else {
            navigation.navigate('UserProfile', { userId: item.contact_id });
          }
        }}
      >
        <View style={styles.contactInfo}>
          <Text style={styles.contactName}>{contactName}</Text>
          <Text style={styles.contactDetails}>{phoneNumber}</Text>
          {email !== 'No Email' && <Text style={styles.contactDetails}>{email}</Text>}
        </View>
        
        {isGroupSelection ? (
          <View style={styles.checkboxContainer}>
            {isSelected && (
              <MaterialIcons name="check-circle" size={24} color={COLORS.primary} />
            )}
            {!isSelected && (
              <View style={styles.emptyCheckbox} />
            )}
          </View>
        ) : (
          <TouchableOpacity
            style={styles.viewProfileButton}
            onPress={() => navigation.navigate('UserProfile', { userId: item.contact_id })}
          >
            <Text style={styles.viewProfileButtonText}>View Profile</Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  const toggleContactSelection = (contact) => {
    setSelectedContacts(prevSelected => {
      const alreadySelected = prevSelected.some(c => c.id === contact.id);
      
      if (alreadySelected) {
        return prevSelected.filter(c => c.id !== contact.id);
      } else {
        return [...prevSelected, contact];
      }
    });
  };

  const renderDeviceContactItem = ({ item }) => {
    const contactName = item.name || 'No Name';
    const phoneNumber = item.phoneNumbers && item.phoneNumbers.length > 0
      ? item.phoneNumbers[0].number
      : 'No Phone';
    const email = item.emails && item.emails.length > 0
      ? item.emails[0].email
      : null;
    
    return (
      <View style={styles.contactItem}>
        <View style={styles.contactInfo}>
          <Text style={styles.contactName}>{contactName}</Text>
          <Text style={styles.contactPhone}>{phoneNumber}</Text>
          {email && <Text style={styles.contactPhone}>{email}</Text>}
          {item.isInvited && (
            <Text style={styles.invitedBadge}>
              Invited • {new Date(item.invitedAt).toLocaleDateString()}
            </Text>
          )}
        </View>
        
        {item.isInvited ? (
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
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => {
            if (isGroupSelection) {
              navigation.goBack();
            } else {
              setShowContacts(false);
            }
          }}
        >
          <MaterialIcons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.contactsTitle}>
          {isGroupSelection ? 'Select Contacts' : 'My Contacts'}
        </Text>
        
        {isGroupSelection && (
          <TouchableOpacity 
            style={[
              styles.doneButton, 
              selectedContacts.length === 0 && styles.disabledButton
            ]}
            disabled={selectedContacts.length === 0}
            onPress={() => {
              if (onContactsSelected) {
                onContactsSelected(selectedContacts);
              }
              navigation.goBack();
            }}
          >
            <Text style={styles.doneButtonText}>
              Done ({selectedContacts.length})
            </Text>
          </TouchableOpacity>
        )}
      </View>
      
      {loadingContacts ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading contacts...</Text>
        </View>
      ) : (
        isGroupSelection ? (
          // In group selection mode, only show app contacts
          <FlatList
            data={registeredContacts}
            renderItem={renderContactItem}
            keyExtractor={item => item.id.toString()}
            contentContainerStyle={{ paddingBottom: 100 }}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyListText}>No app contacts found. Add contacts using the + button.</Text>
              </View>
            }
          />
        ) : (
          // In normal mode, show both types of contacts
          <SectionList
            sections={[
              { title: 'App Contacts', data: registeredContacts },
              { title: 'Device Contacts', data: unregisteredContacts }
            ]}
            keyExtractor={(item, index) => `contact-${index}`}
            renderItem={({ item, section }) => 
              section.title === 'App Contacts' 
                ? renderContactItem({ item }) 
                : renderDeviceContactItem({ item })
            }
            renderSectionHeader={({ section }) => (
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{section.title} ({section.data.length})</Text>
              </View>
            )}
            contentContainerStyle={{ paddingBottom: 100 }}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyListText}>No contacts found. Add contacts using the + button.</Text>
              </View>
            }
          />
        )
      )}
      
      {/* Only show floating button in normal mode, not group selection */}
      {!isGroupSelection && (
        <TouchableOpacity
          style={styles.floatingAddButton}
          onPress={() => setShowAddContactModal(true)}
          activeOpacity={0.8}
        >
          <MaterialIcons name="person-add" size={22} color="white" />
          <Text style={styles.floatingAddButtonText}>Add Contact</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const validateContactInputs = () => {
    const newErrors = {};
    
    if (!newContact.name.trim()) {
      newErrors.name = 'Name is required';
    }
    
    if (!newContact.email && !newContact.phoneNumber) {
      newErrors.email = 'Either email or phone number is required';
      newErrors.phoneNumber = 'Either email or phone number is required';
    }
    
    if (newContact.email && !/^\S+@\S+\.\S+$/.test(newContact.email)) {
      newErrors.email = 'Invalid email format';
    }
    
    if (newContact.phoneNumber) {
      const digits = newContact.phoneNumber.replace(/\D/g, '');
      if (digits.length < 10) {
        newErrors.phoneNumber = 'Invalid phone number';
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const addContact = async () => {
    if (!validateContactInputs() || !user) return;
    
    try {
      // Format phone number
      let formattedPhone = null;
      if (newContact.phoneNumber) {
        formattedPhone = newContact.phoneNumber.replace(/\D/g, '');
        if (formattedPhone.length === 10) {
          formattedPhone = `+1${formattedPhone}`;
        } else if (formattedPhone.length > 10 && !formattedPhone.startsWith('+')) {
          formattedPhone = `+${formattedPhone}`;
        }
      }
      
      // Check if user exists with this email or phone
      let registeredUser = null;
      
      if (newContact.email) {
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('id, email, phone_number, name')
          .eq('email', newContact.email.toLowerCase())
          .single();
          
        if (!userError && userData) {
          registeredUser = userData;
        }
      } 
      
      if (!registeredUser && formattedPhone) {
        const { data: phoneUserData, error: phoneUserError } = await supabase
          .from('users')
          .select('id, email, phone_number, name')
          .eq('phone_number', formattedPhone)
          .single();
          
        if (!phoneUserError && phoneUserData) {
          registeredUser = phoneUserData;
        }
      }
      
      // If no registered user is found, show an error
      if (!registeredUser) {
        Alert.alert('No Registered User Found', 'You can only add contacts who are registered for the app. Please check the email or phone number.');
        return;
      }
      
      // Ensure both email and phone number are populated by using the registered user data
      const contactEmail = registeredUser.email || newContact.email;
      const contactPhoneNumber = registeredUser.phone_number || formattedPhone;
      
      // Check if already a contact
      const { data: existingContact } = await supabase
        .from('contacts')
        .select('id')
        .eq('owner_id', user.id)
        .eq('contact_id', registeredUser.id)
        .single();
        
      if (existingContact) {
        Alert.alert('Contact Exists', 'This person is already in your contacts.');
        return;
      }
      
      // Add contact to current user's contacts list with all available information
      const { error: insertError } = await supabase
        .from('contacts')
        .insert({
          owner_id: user.id,
          contact_id: registeredUser.id,
          name: newContact.name,
          email: contactEmail,
          phone_number: contactPhoneNumber
        });
      
      if (insertError) throw insertError;
      
      // Now also add the reverse contact (with the updated RLS policies this should work)
      // Get current user details
      const { data: currentUserData } = await supabase
        .from('users')
        .select('name, email, phone_number')
        .eq('id', user.id)
        .single();
      
      // Check if current user is already in the other user's contacts
      const { data: reverseExistingContact } = await supabase
        .from('contacts')
        .select('id')
        .eq('owner_id', registeredUser.id)
        .eq('contact_id', user.id)
        .single();
        
      if (!reverseExistingContact) {
        // Ensure we have the most complete user data for the reverse contact
        const userName = currentUserData?.name || user.email?.split('@')[0] || 'User';
        const userEmail = currentUserData?.email || user.email;
        const userPhone = currentUserData?.phone_number || null;
        
        const { error: reverseInsertError } = await supabase
          .from('contacts')
          .insert({
            owner_id: registeredUser.id,
            contact_id: user.id,
            name: userName,
            email: userEmail,
            phone_number: userPhone
          });
          
        if (reverseInsertError) {
          console.error('Error adding reverse contact:', reverseInsertError);
          // We can continue even if the reverse contact insertion fails
        }
      }
      
      Alert.alert('Success', 'Contact added successfully');
      setNewContact({ name: '', email: '', phoneNumber: '' });
      setShowAddContactModal(false);
      
      // Refresh user profile data to update stats
      fetchUserProfileData();
      
      // Also refresh contacts if we're showing them
      if (showContacts) {
        fetchContacts();
      }
      
    } catch (error) {
      console.error('Error adding contact:', error);
      Alert.alert('Error', 'Failed to add contact');
    }
  };

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

      {/* Add Contact Modal */}
      <Modal
        visible={showAddContactModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddContactModal(false)}
      >
        <TouchableOpacity 
          activeOpacity={1}
          style={styles.modalOverlay}
          onPress={() => setShowAddContactModal(false)}
        >
          <View style={styles.modalContainerWrapper}>
            <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
              <View style={styles.modalContainer}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Add New Contact</Text>
                  <TouchableOpacity 
                    onPress={() => setShowAddContactModal(false)}
                    style={styles.closeButton}
                  >
                    <MaterialIcons name="close" size={24} color={COLORS.text} />
                  </TouchableOpacity>
                </View>
                
                <View style={styles.formContainer}>
                  <Text style={styles.modalNote}>
                    Note: You can only add contacts who are registered for the app using their email or phone number.
                  </Text>
                  
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Name*</Text>
                    <TextInput
                      style={[styles.input, errors.name && styles.inputError]}
                      value={newContact.name}
                      onChangeText={(text) => setNewContact({...newContact, name: text})}
                      placeholder="Contact name"
                    />
                    {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}
                  </View>
                  
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Email</Text>
                    <TextInput
                      style={[styles.input, errors.email && styles.inputError]}
                      value={newContact.email}
                      onChangeText={(text) => setNewContact({...newContact, email: text})}
                      placeholder="Email address of registered user"
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />
                    {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
                  </View>
                  
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Phone Number</Text>
                    <TextInput
                      style={[styles.input, errors.phoneNumber && styles.inputError]}
                      value={newContact.phoneNumber}
                      onChangeText={(text) => setNewContact({...newContact, phoneNumber: text})}
                      placeholder="Phone number of registered user"
                      keyboardType="phone-pad"
                    />
                    {errors.phoneNumber && <Text style={styles.errorText}>{errors.phoneNumber}</Text>}
                  </View>
                  
                  <View style={styles.buttonContainer}>
                    <TouchableOpacity
                      style={[styles.button, styles.cancelButton]}
                      onPress={() => setShowAddContactModal(false)}
                    >
                      <Text style={styles.cancelButtonText}>Cancel</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      style={[styles.button, styles.addContactButton]}
                      onPress={addContact}
                    >
                      <Text style={styles.modalButtonText}>Add Contact</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableOpacity>
      </Modal>
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
  sectionHeader: {
    backgroundColor: COLORS.lightBackground || '#F3F4F6',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: 'bold',
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
    color: 'white',
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
  // Floating Add Contact Button
  floatingAddButton: {
    position: 'absolute',
    bottom: 56,
    left: 0,
    right: 0,
    backgroundColor: COLORS.primary, // App's purple color
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.2)',
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    zIndex: 10000,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 4,
  },
  floatingAddButtonText: {
    color: 'white',
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    marginLeft: 8,
    letterSpacing: 0.3,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainerWrapper: {
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    // Don't handle touches on the wrapper, let them pass through to the overlay
  },
  modalContainer: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: SPACING.lg,
    paddingBottom: SPACING.xs,
    width: '95%',
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  modalTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  closeButton: {
    padding: SPACING.xs,
  },
  formContainer: {
    marginTop: 0,
    paddingBottom: SPACING.sm,
  },
  modalNote: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.secondaryText || '#666',
    marginBottom: SPACING.md,
    backgroundColor: '#F7F9FA',
    padding: SPACING.sm,
    borderRadius: 6,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
  },
  inputGroup: {
    marginBottom: SPACING.md,
  },
  label: {
    fontWeight: '500',
    marginBottom: SPACING.xs,
    color: COLORS.text,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontSize: FONT_SIZES.md,
  },
  inputError: {
    borderColor: COLORS.danger || '#DC2626',
  },
  errorText: {
    color: COLORS.danger || '#DC2626',
    fontSize: FONT_SIZES.xs,
    marginTop: 4,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: SPACING.lg,
    marginBottom: SPACING.lg,
    paddingHorizontal: SPACING.xs,
  },
  button: {
    flex: 1,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
    marginHorizontal: SPACING.xs,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  cancelButton: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  addContactButton: {
    backgroundColor: COLORS.primary,
    borderWidth: 0,
  },
  modalButtonText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: 'white',
  },
  cancelButtonText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text,
  },
  // Group selection styles
  selectedContactItem: {
    backgroundColor: `${COLORS.primary}20`, // 20% opacity of primary color
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
  doneButton: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    backgroundColor: COLORS.primary,
    borderRadius: 16,
  },
  doneButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: FONT_SIZES.sm,
  },
  disabledButton: {
    opacity: 0.5,
  },
});

export default ProfileScreen;