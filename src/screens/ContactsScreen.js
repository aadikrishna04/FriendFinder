import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  FlatList,
  ActivityIndicator,
  SafeAreaView
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { supabase } from '../services/supabaseClient';
import { COLORS, SPACING, FONT_SIZES } from '../constants';

const ContactsScreen = ({ navigation, route }) => {
  // Check if we're in selection mode for inviting contacts
  const selectionMode = route.params?.onContactsSelected !== undefined;
  const onContactsSelected = route.params?.onContactsSelected;
  const eventId = route.params?.eventId;
  const isTicketmasterEvent = route.params?.isTicketmasterEvent || false;
  const eventData = route.params?.eventData;
  
  const [showAddContactModal, setShowAddContactModal] = useState(false);
  const [user, setUser] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedContacts, setSelectedContacts] = useState([]);
  const [newContact, setNewContact] = useState({
    name: '',
    email: '',
    phoneNumber: ''
  });
  const [errors, setErrors] = useState({});

  // Get current user and contacts on component mount
  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (!error && user) {
        setUser(user);
        fetchContacts(user.id);
      }
    };
    getCurrentUser();
  }, []);

  const fetchContacts = async (userId) => {
    try {
      setLoading(true);
      
      // Fetch contacts with joined user data
      const { data, error } = await supabase
        .from('contacts')
        .select(`
          id, 
          name, 
          email, 
          phone_number,
          contact_id,
          contacts_users:contact_id(name, email, phone_number, id)
        `)
        .eq('owner_id', userId)
        .order('name');
        
      if (error) throw error;
      
      setContacts(data || []);
    } catch (error) {
      console.error('Error fetching contacts:', error);
      Alert.alert('Error', 'Failed to load contacts');
    } finally {
      setLoading(false);
    }
  };

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
      
      // Add contact to current user's contacts list
      const { error: insertError } = await supabase
        .from('contacts')
        .insert({
          owner_id: user.id,
          contact_id: registeredUser.id,
          name: newContact.name,
          email: registeredUser.email,
          phone_number: registeredUser.phone_number
        });
      
      if (insertError) throw insertError;
      
      // Add current user to the other user's contacts (bidirectional)
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
        const { error: reverseInsertError } = await supabase
          .from('contacts')
          .insert({
            owner_id: registeredUser.id,
            contact_id: user.id,
            name: currentUserData.name || user.email.split('@')[0],
            email: currentUserData.email || user.email,
            phone_number: currentUserData.phone_number || null
          });
          
        if (reverseInsertError) {
          console.error('Error adding reverse contact:', reverseInsertError);
          // Don't throw so we can continue - the primary contact was still added
        }
      }
      
      Alert.alert('Success', 'Contact added successfully');
      setNewContact({ name: '', email: '', phoneNumber: '' });
      setShowAddContactModal(false);
      
      // Refresh contacts list
      fetchContacts(user.id);
      
    } catch (error) {
      console.error('Error adding contact:', error);
      Alert.alert('Error', 'Failed to add contact');
    }
  };

  const renderContactItem = ({ item }) => {
    const contactUser = item.contacts_users;
    const isSelected = selectedContacts.some(contact => contact.id === item.contact_id);
    
    const onContactPress = () => {
      if (selectionMode) {
        // Toggle selection
        if (isSelected) {
          setSelectedContacts(selectedContacts.filter(c => c.id !== item.contact_id));
        } else {
          setSelectedContacts([...selectedContacts, {
            id: item.contact_id,
            name: item.name,
            email: item.email,
            phone_number: item.phone_number
          }]);
        }
      } else {
        // Normal navigation to profile
        navigation.navigate('UserProfile', { userId: item.contact_id });
      }
    };
    
    return (
      <TouchableOpacity 
        style={[styles.contactItem, isSelected && styles.selectedContactItem]}
        onPress={onContactPress}
      >
        <View style={styles.contactAvatar}>
          <Text style={styles.contactInitial}>
            {item.name ? item.name.charAt(0).toUpperCase() : '?'}
          </Text>
        </View>
        <View style={styles.contactInfo}>
          <Text style={styles.contactName}>{item.name}</Text>
          <Text style={styles.contactDetails}>{item.email}</Text>
          {item.phone_number && (
            <Text style={styles.contactDetails}>{item.phone_number}</Text>
          )}
        </View>
        {selectionMode ? (
          <View style={styles.selectionIndicator}>
            {isSelected ? (
              <MaterialIcons name="check-circle" size={24} color={COLORS.primary} />
            ) : (
              <View style={styles.unselectedCircle} />
            )}
          </View>
        ) : (
          <MaterialIcons name="chevron-right" size={24} color={COLORS.textSecondary} />
        )}
      </TouchableOpacity>
    );
  };

  const EmptyContactsList = () => (
    <View style={styles.emptyContainer}>
      <MaterialIcons name="people" size={64} color={COLORS.textLight} />
      <Text style={styles.emptyTitle}>No Contacts Yet</Text>
      <Text style={styles.emptySubtitle}>
        Add your first contact by tapping the + button
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <MaterialIcons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        
        <Text style={styles.headerTitle}>
          {selectionMode ? 'Select Contacts to Invite' : 'My Contacts'}
        </Text>
        
        {selectionMode ? (
          <TouchableOpacity 
            style={styles.doneButton}
            onPress={() => {
              if (selectedContacts.length === 0) {
                Alert.alert('No Contacts Selected', 'Please select at least one contact to invite.');
                return;
              }
              // Call the callback function with selected contacts
              if (onContactsSelected) {
                onContactsSelected(selectedContacts);
              }
              navigation.goBack();
            }}
          >
            <Text style={styles.doneButtonText}>Done</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity 
            style={styles.addIconButton}
            onPress={() => setShowAddContactModal(true)}
          >
            <MaterialIcons name="add" size={24} color={COLORS.primary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Contacts List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading contacts...</Text>
        </View>
      ) : (
        <FlatList
          data={contacts}
          renderItem={renderContactItem}
          keyExtractor={item => item.id.toString()}
          ListEmptyComponent={EmptyContactsList}
          contentContainerStyle={styles.contactsList}
        />
      )}

      {/* Floating Add Button - only shown in normal mode */}
      {!selectionMode && (
        <TouchableOpacity
          style={styles.floatingAddButton}
          onPress={() => setShowAddContactModal(true)}
        >
          <MaterialIcons name="add" size={24} color="white" />
        </TouchableOpacity>
      )}

      {/* Add Contact Modal */}
      <Modal
        visible={showAddContactModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddContactModal(false)}
      >
        <View style={styles.modalOverlay}>
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
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    padding: SPACING.xs,
  },
  headerTitle: {
    flex: 1,
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    textAlign: 'center',
    color: COLORS.text,
  },
  addIconButton: {
    padding: SPACING.xs,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: SPACING.md,
    fontSize: FONT_SIZES.md,
    color: COLORS.secondaryText,
  },
  contactsList: {
    paddingVertical: SPACING.md,
    flexGrow: 1,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  contactAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  contactInitial: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    color: 'white',
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 4,
  },
  contactDetails: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.secondaryText,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  emptyTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.text,
    marginTop: SPACING.md,
  },
  emptySubtitle: {
    fontSize: FONT_SIZES.md,
    color: COLORS.secondaryText,
    textAlign: 'center',
    marginTop: SPACING.sm,
  },
  floatingAddButton: {
    position: 'absolute',
    bottom: 30,
    right: 30,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: SPACING.lg,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
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
    marginTop: SPACING.md,
  },
  modalNote: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.secondaryText,
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
    fontSize: FONT_SIZES.sm,
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
    borderColor: COLORS.danger,
  },
  errorText: {
    color: COLORS.danger,
    fontSize: FONT_SIZES.xs,
    marginTop: 4,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: SPACING.lg,
  },
  button: {
    flex: 1,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    marginHorizontal: SPACING.xs,
  },
  cancelButton: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  addContactButton: {
    backgroundColor: COLORS.primary,
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
  selectedContactItem: {
    backgroundColor: '#F0F0F0',
  },
  selectionIndicator: {
    marginLeft: 'auto',
  },
  unselectedCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.textSecondary,
  },
  doneButton: {
    padding: SPACING.xs,
  },
  doneButtonText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.primary,
  },
});

export default ContactsScreen; 