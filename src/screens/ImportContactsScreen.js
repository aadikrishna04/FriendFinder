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
  Image
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { supabase } from '../services/supabaseClient';
import { COLORS, SPACING, FONT_SIZES } from '../constants';

const ImportContactsScreen = ({ navigation, route }) => {
  const { deviceContacts } = route.params;
  const [contacts, setContacts] = useState([]);
  const [filteredContacts, setFilteredContacts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedContacts, setSelectedContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [importLoading, setImportLoading] = useState(false);
  const [user, setUser] = useState(null);
  const [existingContacts, setExistingContacts] = useState(new Set());

  useEffect(() => {
    fetchUser();
    prepareContacts();
  }, []);

  const fetchUser = async () => {
    try {
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      setUser(user);
      
      // Fetch existing contacts to prevent duplicates
      const { data: contactsData, error: contactsError } = await supabase
        .from('contacts')
        .select('email, phone_number')
        .eq('owner_id', user.id);
      
      if (contactsError) throw contactsError;
      
      // Create a set of existing emails and phone numbers
      const existingSet = new Set();
      contactsData.forEach(contact => {
        if (contact.email) existingSet.add(contact.email.toLowerCase());
        if (contact.phone_number) existingSet.add(contact.phone_number);
      });
      
      setExistingContacts(existingSet);
    } catch (error) {
      console.error('Error fetching user:', error);
      Alert.alert('Error', 'Failed to load user data');
    }
  };

  const prepareContacts = () => {
    // Process device contacts to standardize format
    const processed = deviceContacts
      .filter(contact => {
        // Filter out contacts without a name or any contact info
        return contact.name && (
          (contact.phoneNumbers && contact.phoneNumbers.length > 0) ||
          (contact.emails && contact.emails.length > 0)
        );
      })
      .map(contact => {
        // Extract the first email and phone
        const email = contact.emails && contact.emails.length > 0 
          ? contact.emails[0].email.toLowerCase() 
          : null;
          
        let phoneNumber = null;
        if (contact.phoneNumbers && contact.phoneNumbers.length > 0) {
          // Format phone number
          phoneNumber = contact.phoneNumbers[0].number.replace(/\D/g, '');
          if (phoneNumber.length === 10) {
            phoneNumber = `+1${phoneNumber}`;
          } else if (phoneNumber.length > 10 && !phoneNumber.startsWith('+')) {
            phoneNumber = `+${phoneNumber}`;
          }
        }
        
        // Check if this contact already exists in the database
        const alreadyExists = 
          (email && existingContacts.has(email)) || 
          (phoneNumber && existingContacts.has(phoneNumber));
        
        return {
          id: contact.id,
          name: contact.name,
          email,
          phoneNumber,
          alreadyExists
        };
      });
    
    // Sort by name and filter out existing contacts by default
    const sortedContacts = processed.sort((a, b) => a.name.localeCompare(b.name));
    setContacts(sortedContacts);
    setFilteredContacts(sortedContacts);
    setLoading(false);
  };

  // Handle search
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredContacts(contacts);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = contacts.filter(contact => 
        contact.name.toLowerCase().includes(query) ||
        (contact.email && contact.email.toLowerCase().includes(query)) ||
        (contact.phoneNumber && contact.phoneNumber.includes(query))
      );
      setFilteredContacts(filtered);
    }
  }, [searchQuery, contacts]);

  const toggleContactSelection = (contact) => {
    if (selectedContacts.some(c => c.id === contact.id)) {
      setSelectedContacts(selectedContacts.filter(c => c.id !== contact.id));
    } else {
      setSelectedContacts([...selectedContacts, contact]);
    }
  };

  const importSelectedContacts = async () => {
    if (selectedContacts.length === 0) {
      Alert.alert('No Contacts Selected', 'Please select at least one contact to import.');
      return;
    }

    setImportLoading(true);
    try {
      // Check which selected contacts are registered app users
      const emails = selectedContacts
        .filter(c => c.email)
        .map(c => c.email);
        
      const phones = selectedContacts
        .filter(c => c.phoneNumber)
        .map(c => c.phoneNumber);
      
      // Check by email
      const { data: emailUsers } = await supabase
        .from('users')
        .select('id, email')
        .in('email', emails.length > 0 ? emails : ['']);
      
      // Check by phone
      const { data: phoneUsers } = await supabase
        .from('users')
        .select('id, phone_number')
        .in('phone_number', phones.length > 0 ? phones : ['']);
      
      // Create a map of email/phone to user IDs
      const userMap = new Map();
      
      if (emailUsers) {
        emailUsers.forEach(user => userMap.set(user.email.toLowerCase(), user.id));
      }
      
      if (phoneUsers) {
        phoneUsers.forEach(user => userMap.set(user.phone_number, user.id));
      }
      
      // Prepare contacts for insertion
      const contactsToInsert = selectedContacts.map(contact => {
        let userId = null;
        
        // Check if this contact is a registered user
        if (contact.email && userMap.has(contact.email)) {
          userId = userMap.get(contact.email);
        } else if (contact.phoneNumber && userMap.has(contact.phoneNumber)) {
          userId = userMap.get(contact.phoneNumber);
        }
        
        return {
          owner_id: user.id,
          contact_id: userId,
          name: contact.name,
          email: contact.email,
          phone_number: contact.phoneNumber
        };
      });
      
      // Insert contacts in batches to avoid timeout
      const batchSize = 50;
      let successCount = 0;
      let errorCount = 0;
      
      for (let i = 0; i < contactsToInsert.length; i += batchSize) {
        const batch = contactsToInsert.slice(i, i + batchSize);
        
        const { data, error } = await supabase
          .from('contacts')
          .upsert(batch, { onConflict: 'owner_id,email,phone_number' })
          .select();
        
        if (error) {
          console.error('Error importing batch:', error);
          errorCount += batch.length;
        } else {
          successCount += data.length;
        }
      }
      
      // Show success message
      Alert.alert(
        'Import Complete',
        `Successfully imported ${successCount} contacts.${errorCount > 0 ? `\n${errorCount} contacts failed to import.` : ''}`
      );
      
      // Navigate back to contacts screen
      navigation.goBack();
    } catch (error) {
      console.error('Error importing contacts:', error);
      Alert.alert('Error', 'Failed to import contacts');
    } finally {
      setImportLoading(false);
    }
  };

  const renderContactItem = ({ item }) => {
    const isSelected = selectedContacts.some(c => c.id === item.id);
    
    return (
      <TouchableOpacity
        style={[
          styles.contactItem,
          isSelected && styles.selectedContact,
          item.alreadyExists && styles.existingContact
        ]}
        onPress={() => !item.alreadyExists && toggleContactSelection(item)}
        disabled={item.alreadyExists}
      >
        <View style={styles.checkboxContainer}>
          {isSelected ? (
            <View style={styles.checkbox}>
              <MaterialIcons name="check" size={16} color="#FFFFFF" />
            </View>
          ) : (
            <View style={styles.checkboxEmpty} />
          )}
        </View>
        
        <View style={styles.contactInfo}>
          <Text style={styles.contactName}>{item.name}</Text>
          {item.email && (
            <Text style={styles.contactDetail}>{item.email}</Text>
          )}
          {item.phoneNumber && (
            <Text style={styles.contactDetail}>{item.phoneNumber}</Text>
          )}
          {item.alreadyExists && (
            <Text style={styles.existingLabel}>Already in contacts</Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <MaterialIcons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Import Contacts</Text>
        <View style={{ width: 32 }} />
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
      
      <View style={styles.selectionBar}>
        <Text style={styles.selectionText}>
          {selectedContacts.length} contacts selected
        </Text>
        <TouchableOpacity
          style={styles.selectAllButton}
          onPress={() => {
            // Only select contacts that don't already exist
            const validContacts = contacts.filter(c => !c.alreadyExists);
            if (selectedContacts.length === validContacts.length) {
              setSelectedContacts([]);
            } else {
              setSelectedContacts(validContacts);
            }
          }}
        >
          <Text style={styles.selectAllText}>
            {selectedContacts.length === contacts.filter(c => !c.alreadyExists).length 
              ? 'Unselect All' 
              : 'Select All'}
          </Text>
        </TouchableOpacity>
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
                Try a different search term
              </Text>
            </View>
          }
        />
      )}
      
      <View style={styles.importButtonContainer}>
        <TouchableOpacity
          style={[
            styles.importButton,
            selectedContacts.length === 0 && styles.disabledButton
          ]}
          onPress={importSelectedContacts}
          disabled={selectedContacts.length === 0 || importLoading}
        >
          {importLoading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <MaterialIcons name="add" size={20} color="#FFFFFF" />
              <Text style={styles.importButtonText}>
                Import {selectedContacts.length} Contacts
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
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
  backButton: {
    padding: SPACING.xs,
  },
  headerTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.text,
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
  selectionBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.md,
    backgroundColor: COLORS.lightBackground || '#F5F5F5',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  selectionText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
  },
  selectAllButton: {
    padding: SPACING.xs,
  },
  selectAllText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.primary,
    fontWeight: '500',
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
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
  },
  selectedContact: {
    backgroundColor: '#E8F4FE',
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  existingContact: {
    opacity: 0.6,
  },
  checkboxContainer: {
    marginRight: SPACING.md,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxEmpty: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: COLORS.border,
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
  contactDetail: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginBottom: 2,
  },
  existingLabel: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textLight,
    fontStyle: 'italic',
    marginTop: 2,
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
  importButtonContainer: {
    padding: SPACING.md,
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  importButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    padding: SPACING.md,
    borderRadius: 8,
  },
  disabledButton: {
    backgroundColor: COLORS.border,
  },
  importButtonText: {
    color: '#FFFFFF',
    fontSize: FONT_SIZES.md,
    fontWeight: 'bold',
    marginLeft: SPACING.xs,
  },
});

export default ImportContactsScreen; 