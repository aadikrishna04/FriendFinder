import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { supabase } from '../services/supabaseClient';
import { COLORS, SPACING, FONT_SIZES } from '../constants';
import * as Contacts from 'expo-contacts';

const ContactsScreen = ({ navigation }) => {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [user, setUser] = useState(null);
  const [showAddContactModal, setShowAddContactModal] = useState(false);
  const [newContact, setNewContact] = useState({
    name: '',
    email: '',
    phoneNumber: ''
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    fetchUserAndContacts();
    const unsubscribe = navigation.addListener('focus', fetchUserAndContacts);
    return unsubscribe;
  }, [navigation]);

  const fetchUserAndContacts = async () => {
    try {
      setLoading(true);
      
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      setUser(user);
      
      // Fetch contacts from database
      const { data: contactsData, error: contactsError } = await supabase
        .from('contacts')
        .select(`
          id,
          name,
          email,
          phone_number,
          contact_id,
          users:contact_id (
            name,
            email,
            phone_number,
            avatar_url
          )
        `)
        .eq('owner_id', user.id)
        .order('name');
      
      if (contactsError) throw contactsError;
      
      setContacts(contactsData || []);
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
      newErrors.email = 'Either email or phone is required';
      newErrors.phoneNumber = 'Either email or phone is required';
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
    if (!validateContactInputs()) return;
    
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
      
      // First check if user exists with this email or phone
      let userId = null;
      
      if (newContact.email) {
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('id')
          .eq('email', newContact.email.toLowerCase())
          .single();
          
        if (!userError && userData) {
          userId = userData.id;
        }
      } 
      
      if (!userId && formattedPhone) {
        const { data: phoneUserData, error: phoneUserError } = await supabase
          .from('users')
          .select('id')
          .eq('phone_number', formattedPhone)
          .single();
          
        if (!phoneUserError && phoneUserData) {
          userId = phoneUserData.id;
        }
      }
      
      // Add contact to database
      const { data, error } = await supabase
        .from('contacts')
        .insert({
          owner_id: user.id,
          contact_id: userId,
          name: newContact.name,
          email: newContact.email ? newContact.email.toLowerCase() : null,
          phone_number: formattedPhone
        })
        .select();
      
      if (error) throw error;
      
      // Show success message
      Alert.alert('Success', 'Contact added successfully');
      
      // Reset form and refresh contacts
      setNewContact({ name: '', email: '', phoneNumber: '' });
      setShowAddContactModal(false);
      fetchUserAndContacts();
    } catch (error) {
      if (error.code === '23505') {
        Alert.alert('Error', 'This contact already exists in your contacts');
      } else {
        console.error('Error adding contact:', error);
        Alert.alert('Error', 'Failed to add contact');
      }
    }
  };

  const importFromDevice = async () => {
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Cannot access contacts');
        return;
      }
      
      const { data } = await Contacts.getContactsAsync({
        fields: [
          Contacts.Fields.PhoneNumbers,
          Contacts.Fields.Emails,
          Contacts.Fields.Name,
        ],
        sort: Contacts.SortTypes.FirstName
      });
      
      if (data.length === 0) {
        Alert.alert('No Contacts', 'No contacts found on your device');
        return;
      }
      
      navigation.navigate('ImportContacts', { deviceContacts: data });
    } catch (error) {
      console.error('Error importing contacts:', error);
      Alert.alert('Error', 'Failed to import contacts');
    }
  };

  const deleteContact = async (contactId) => {
    try {
      const { error } = await supabase
        .from('contacts')
        .delete()
        .eq('id', contactId);
      
      if (error) throw error;
      
      // Update local state
      setContacts(contacts.filter(contact => contact.id !== contactId));
      
      Alert.alert('Success', 'Contact deleted successfully');
    } catch (error) {
      console.error('Error deleting contact:', error);
      Alert.alert('Error', 'Failed to delete contact');
    }
  };

  const confirmDeleteContact = (contact) => {
    Alert.alert(
      'Delete Contact',
      `Are you sure you want to delete ${contact.name} from your contacts?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteContact(contact.id) }
      ]
    );
  };

  // Filter contacts based on search query
  const filteredContacts = contacts.filter(contact => 
    contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (contact.email && contact.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (contact.phone_number && contact.phone_number.includes(searchQuery))
  );

  const renderContactItem = ({ item }) => {
    const isRegisteredUser = !!item.contact_id;
    const userData = item.users || {};
    
    return (
      <TouchableOpacity
        style={styles.contactItem}
        onPress={() => {
          // Navigate to user profile if registered user
          if (isRegisteredUser) {
            navigation.navigate('UserProfile', { userId: item.contact_id });
          }
        }}
      >
        <View style={styles.contactAvatar}>
          <Text style={styles.contactInitial}>
            {item.name.charAt(0).toUpperCase()}
          </Text>
        </View>
        
        <View style={styles.contactInfo}>
          <Text style={styles.contactName}>{item.name}</Text>
          {isRegisteredUser && (
            <Text style={styles.registeredLabel}>Registered User</Text>
          )}
          {item.email && (
            <Text style={styles.contactDetail}>{item.email}</Text>
          )}
          {item.phone_number && (
            <Text style={styles.contactDetail}>{item.phone_number}</Text>
          )}
        </View>
        
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => confirmDeleteContact(item)}
        >
          <MaterialIcons name="delete" size={24} color={COLORS.danger} />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Contacts</Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity
            style={styles.importButton}
            onPress={importFromDevice}
          >
            <MaterialIcons name="cloud-download" size={24} color={COLORS.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => setShowAddContactModal(true)}
          >
            <MaterialIcons name="person-add" size={24} color={COLORS.primary} />
          </TouchableOpacity>
        </View>
      </View>
      
      <View style={styles.searchContainer}>
        <MaterialIcons name="search" size={24} color={COLORS.textSecondary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search contacts..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          clearButtonMode="while-editing"
        />
      </View>
      
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading contacts...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredContacts}
          renderItem={renderContactItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.contactsList}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialIcons name="person" size={64} color={COLORS.textLight} />
              <Text style={styles.emptyTitle}>No Contacts Found</Text>
              <Text style={styles.emptySubtitle}>
                {searchQuery ? 'Try a different search term' : 'Add contacts to get started'}
              </Text>
            </View>
          }
        />
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
                  placeholder="Email address"
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
                  placeholder="Phone number"
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
                  <Text style={styles.buttonText}>Add Contact</Text>
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
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  headerTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  headerButtons: {
    flexDirection: 'row',
  },
  importButton: {
    marginRight: SPACING.md,
    padding: SPACING.xs,
  },
  addButton: {
    padding: SPACING.xs,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.sm,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingHorizontal: SPACING.md,
  },
  searchInput: {
    flex: 1,
    marginLeft: SPACING.sm,
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
  },
  contactsList: {
    flexGrow: 1,
    padding: SPACING.sm,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 8,
    marginBottom: SPACING.sm,
    padding: SPACING.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1,
    elevation: 2,
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
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 2,
  },
  registeredLabel: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.primary,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  contactDetail: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginBottom: 2,
  },
  deleteButton: {
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
    color: COLORS.textSecondary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
    paddingTop: SPACING.xxl * 2,
  },
  emptyTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.textSecondary,
    marginTop: SPACING.md,
  },
  emptySubtitle: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textLight,
    textAlign: 'center',
    marginTop: SPACING.sm,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: COLORS.white,
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
  buttonText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: 'white',
  },
  cancelButtonText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text,
  },
});

export default ContactsScreen; 