import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  SafeAreaView, 
  FlatList, 
  Alert,
  ActivityIndicator
} from 'react-native';
import * as Contacts from 'expo-contacts';
import { signOut } from '../services/authService';
import { supabase } from '../services/supabaseClient';
import { COLORS, SPACING, FONT_SIZES } from '../constants';

const HomeScreen = ({ navigation }) => {
  const [hasContactsPermission, setHasContactsPermission] = useState(false);
  const [contacts, setContacts] = useState([]);
  const [enrolledContacts, setEnrolledContacts] = useState([]);
  const [notEnrolledContacts, setNotEnrolledContacts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showContacts, setShowContacts] = useState(false);

  useEffect(() => {
    // Check if we already have contacts permission
    (async () => {
      const { status } = await Contacts.getPermissionsAsync();
      setHasContactsPermission(status === 'granted');
    })();
  }, []);

  const requestContactsPermission = async () => {
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      setHasContactsPermission(status === 'granted');
      
      if (status === 'granted') {
        // Proceed directly to loading contacts without showing an alert
        loadContacts();
      } else {
        // Only show an alert if permission was denied
        Alert.alert(
          'Contacts Access Denied',
          'FriendFinder needs access to your contacts to show you which friends are using the app.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Error requesting contacts permission:', error);
      Alert.alert('Error', 'Failed to request contacts permission');
    }
  };

  const loadContacts = async () => {
    if (!hasContactsPermission) {
      await requestContactsPermission();
      return;
    }

    setLoading(true);
    try {
      // Get contacts from device
      const { data } = await Contacts.getContactsAsync({
        fields: [
          Contacts.Fields.PhoneNumbers,
          Contacts.Fields.Name,
          Contacts.Fields.Image
        ],
        sort: Contacts.SortTypes.FirstName
      });
      
      setContacts(data);
      
      // Filter out contacts without phone numbers
      const contactsWithPhones = data.filter(
        contact => contact.phoneNumbers && contact.phoneNumbers.length > 0
      );
      
      // Prepare phone numbers for checking against database
      const phoneNumbersToCheck = contactsWithPhones.flatMap(contact => 
        contact.phoneNumbers.map(phone => {
          // Standardize phone number to just digits
          const standardizedNumber = phone.number.replace(/\D/g, '');
          return {
            contactId: contact.id,
            phoneNumber: standardizedNumber,
            originalPhone: phone.number,
            contact: contact
          };
        })
      );
      
      // Check which phone numbers exist in database
      const { data: matchedUsers, error } = await supabase
        .from('users')
        .select('phone_number, name, id')
        .in('phone_number', phoneNumbersToCheck.map(p => p.phoneNumber));
      
      if (error) {
        console.error('Error checking phone numbers:', error);
        throw error;
      }
      
      // Create sets of enrolled phone numbers for faster lookup
      const enrolledPhoneNumbers = new Set(
        matchedUsers.map(user => user.phone_number)
      );
      
      // Divide contacts into enrolled and not enrolled
      const enrolled = [];
      const notEnrolled = [];
      
      // Track processed contacts to avoid duplicates
      const processedContactIds = new Set();
      
      phoneNumbersToCheck.forEach(({ contactId, phoneNumber, contact }) => {
        // Skip if we've already processed this contact
        if (processedContactIds.has(contactId)) return;
        
        if (enrolledPhoneNumbers.has(phoneNumber)) {
          // Find the matched user data
          const matchedUser = matchedUsers.find(user => user.phone_number === phoneNumber);
          enrolled.push({
            ...contact,
            isEnrolled: true,
            appUserId: matchedUser.id,
            appUserName: matchedUser.name
          });
          processedContactIds.add(contactId);
        } else if (!processedContactIds.has(contactId)) {
          notEnrolled.push({
            ...contact,
            isEnrolled: false
          });
          processedContactIds.add(contactId);
        }
      });
      
      setEnrolledContacts(enrolled);
      setNotEnrolledContacts(notEnrolled);
    } catch (error) {
      console.error('Error loading contacts:', error);
      Alert.alert('Error', 'Failed to load contacts');
    } finally {
      setLoading(false);
      setShowContacts(true);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      // No need to navigate - the auth state listener in App.tsx will handle this
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };
  
  const handleViewContacts = async () => {
    // Check current permission status first
    if (!hasContactsPermission) {
      // Check if we need to request or if we already have permissions
      const { status } = await Contacts.getPermissionsAsync();
      
      if (status === 'granted') {
        // We already have permissions, just set the state
        setHasContactsPermission(true);
        if (contacts.length === 0) {
          loadContacts();
        } else {
          setShowContacts(true);
        }
      } else {
        // We need to request permissions
        requestContactsPermission();
      }
    } else {
      // We already know we have permissions
      if (contacts.length === 0) {
        loadContacts();
      } else {
        setShowContacts(true);
      }
    }
  };
  
  const handleBackToHome = () => {
    setShowContacts(false);
  };

  const renderContactItem = ({ item }) => {
    const contactName = item.name || 'No Name';
    const phoneNumber = item.phoneNumbers && item.phoneNumbers.length > 0
      ? item.phoneNumbers[0].number
      : 'No Phone';
      
    return (
      <View style={styles.contactItem}>
        <View style={styles.contactInfo}>
          <Text style={styles.contactName}>{contactName}</Text>
          <Text style={styles.contactPhone}>{phoneNumber}</Text>
          {item.isEnrolled && (
            <Text style={styles.enrolledBadge}>FriendFinder User</Text>
          )}
        </View>
        
        {item.isEnrolled ? (
          <TouchableOpacity
            style={styles.viewButton}
            onPress={() => navigation.navigate('UserProfile', { userId: item.appUserId })}
          >
            <Text style={styles.viewButtonText}>View Profile</Text>
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

  const handleInvite = (contact) => {
    // Here you would implement the invite functionality
    // This could be sending an SMS or email invitation
    Alert.alert(
      'Invite Sent',
      `An invitation has been sent to ${contact.name || 'your contact'}`,
      [{ text: 'OK' }]
    );
  };

  // Render the main home screen
  const renderHomeScreen = () => (
    <>
      <View style={styles.welcomeContainer}>
        <Text style={styles.welcomeTitle}>Welcome to FriendFinder</Text>
        <Text style={styles.welcomeText}>
          Find your friends and connect with them easily.
        </Text>
        
        <TouchableOpacity 
          style={styles.contactsButton}
          onPress={handleViewContacts}
        >
          <Text style={styles.contactsButtonText}>View My Contacts</Text>
        </TouchableOpacity>
      </View>
    </>
  );

  // Render the contacts screen
  const renderContactsScreen = () => (
    <>
      <View style={styles.headerWithBack}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={handleBackToHome}
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.contactsTitle}>My Contacts</Text>
      </View>
      
      <View style={styles.contactsContent}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>Loading contacts...</Text>
          </View>
        ) : (
          <View style={styles.contactsContainer}>
            <Text style={styles.sectionTitle}>
              Your Contacts ({enrolledContacts.length + notEnrolledContacts.length})
            </Text>
            
            {enrolledContacts.length > 0 && (
              <>
                <Text style={styles.sectionSubtitle}>
                  FriendFinder Users ({enrolledContacts.length})
                </Text>
                <FlatList
                  data={enrolledContacts}
                  renderItem={renderContactItem}
                  keyExtractor={item => `enrolled-${item.id}`}
                  style={styles.list}
                />
              </>
            )}
            
            {notEnrolledContacts.length > 0 && (
              <>
                <Text style={styles.sectionSubtitle}>
                  Invite to FriendFinder ({notEnrolledContacts.length})
                </Text>
                <FlatList
                  data={notEnrolledContacts}
                  renderItem={renderContactItem}
                  keyExtractor={item => `not-enrolled-${item.id}`}
                  style={styles.list}
                />
              </>
            )}
          </View>
        )}
      </View>
    </>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>FriendFinder</Text>
      </View>
      
      <View style={styles.content}>
        {showContacts ? renderContactsScreen() : renderHomeScreen()}
      </View>
      
      <View style={styles.footer}>
        <TouchableOpacity 
          style={styles.signOutButton}
          onPress={handleSignOut}
        >
          <Text style={styles.signOutButtonText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background || '#FFFFFF',
  },
  header: {
    padding: SPACING.md || 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border || '#E5E5E5',
  },
  headerWithBack: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md || 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border || '#E5E5E5',
  },
  backButton: {
    marginRight: SPACING.md || 20,
  },
  backButtonText: {
    fontSize: FONT_SIZES.md || 16,
    color: COLORS.primary || '#8B5CF6',
  },
  title: {
    fontSize: FONT_SIZES.xl || 24,
    fontWeight: 'bold',
    color: COLORS.text || '#000000',
  },
  contactsTitle: {
    fontSize: FONT_SIZES.lg || 18,
    fontWeight: 'bold',
    color: COLORS.text || '#000000',
  },
  content: {
    flex: 1,
  },
  contactsContent: {
    flex: 1,
    padding: SPACING.md || 20,
  },
  welcomeContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg || 24,
  },
  welcomeTitle: {
    fontSize: FONT_SIZES.xxl || 28,
    fontWeight: 'bold',
    color: COLORS.text || '#000000',
    marginBottom: SPACING.md || 20,
    textAlign: 'center',
  },
  welcomeText: {
    fontSize: FONT_SIZES.md || 16,
    color: COLORS.secondaryText || '#666666',
    textAlign: 'center',
    marginBottom: SPACING.xl || 32,
  },
  contactsButton: {
    backgroundColor: COLORS.primary || '#8B5CF6',
    paddingVertical: SPACING.md || 20,
    paddingHorizontal: SPACING.xl || 32,
    borderRadius: 10,
    marginTop: SPACING.md || 20,
  },
  contactsButtonText: {
    color: '#FFFFFF',
    fontSize: FONT_SIZES.md || 16,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: SPACING.md || 20,
    fontSize: FONT_SIZES.md || 16,
    color: COLORS.text || '#000000',
  },
  contactsContainer: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.lg || 18,
    fontWeight: 'bold',
    marginBottom: SPACING.md || 20,
    color: COLORS.text || '#000000',
  },
  sectionSubtitle: {
    fontSize: FONT_SIZES.md || 16,
    fontWeight: '600',
    marginVertical: SPACING.sm || 12,
    color: COLORS.text || '#000000',
  },
  list: {
    maxHeight: 300,
    marginBottom: SPACING.md || 20,
  },
  contactItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.sm || 12,
    paddingHorizontal: SPACING.sm || 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border || '#E5E5E5',
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: FONT_SIZES.md || 16,
    fontWeight: '500',
    color: COLORS.text || '#000000',
  },
  contactPhone: {
    fontSize: FONT_SIZES.sm || 14,
    color: COLORS.secondaryText || '#666666',
  },
  enrolledBadge: {
    fontSize: FONT_SIZES.xs || 12,
    color: COLORS.primary || '#8B5CF6',
    marginTop: SPACING.xs || 4,
  },
  viewButton: {
    backgroundColor: COLORS.primary || '#8B5CF6',
    paddingVertical: SPACING.xs || 8,
    paddingHorizontal: SPACING.sm || 12,
    borderRadius: 6,
  },
  viewButtonText: {
    color: '#FFFFFF',
    fontSize: FONT_SIZES.sm || 14,
    fontWeight: '600',
  },
  inviteButton: {
    backgroundColor: COLORS.secondary || '#F59E0B',
    paddingVertical: SPACING.xs || 8,
    paddingHorizontal: SPACING.sm || 12,
    borderRadius: 6,
  },
  inviteButtonText: {
    color: '#FFFFFF',
    fontSize: FONT_SIZES.sm || 14,
    fontWeight: '600',
  },
  footer: {
    padding: SPACING.md || 20,
  },
  signOutButton: {
    backgroundColor: COLORS.primary || '#8B5CF6',
    height: 54,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  signOutButtonText: {
    color: '#FFFFFF',
    fontSize: FONT_SIZES.md || 18,
    fontWeight: '600',
  },
});

export default HomeScreen; 