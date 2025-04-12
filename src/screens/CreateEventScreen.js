import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Image,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Modal,
  FlatList
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../services/supabaseClient';
import { COLORS, SPACING, FONT_SIZES, LAYOUT } from '../constants';
import * as Location from 'expo-location';
import { MaterialIcons } from '@expo/vector-icons';
import MapView, { Marker } from 'react-native-maps';
import * as Contacts from 'expo-contacts';

const CreateEventScreen = () => {
  const navigation = useNavigation();
  const [title, setTitle] = useState('');
  const [address, setAddress] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date());
  const [image, setImage] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [isOpen, setIsOpen] = useState(true);
  const [inviteOnly, setInviteOnly] = useState(false);
  const [tags, setTags] = useState('');
  const [coordinates, setCoordinates] = useState(null);
  const [user, setUser] = useState(null);
  
  // Address validation
  const [validatingAddress, setValidatingAddress] = useState(false);
  const [addressValidated, setAddressValidated] = useState(false);
  
  // Contact selection
  const [showingContacts, setShowingContacts] = useState(false);
  const [contacts, setContacts] = useState([]);
  const [selectedContacts, setSelectedContacts] = useState([]);
  const [loadingContacts, setLoadingContacts] = useState(false);

  // Add state for address search
  const [addressResults, setAddressResults] = useState([]);
  const [searchingAddress, setSearchingAddress] = useState(false);

  // Add a state for input focus
  const [addressInputFocused, setAddressInputFocused] = useState(false);

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };

    getUser();
    requestLocationPermission();
  }, []);

  const requestLocationPermission = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'We need location permission to validate and pin the event location on the map');
    }
  };

  const validateAddress = async () => {
    if (!address.trim()) {
      Alert.alert('Missing Information', 'Please enter an address');
      return;
    }
    
    setValidatingAddress(true);
    
    try {
      // In a real app, you'd use a geocoding service here
      // For demo purposes, we'll use the device's location
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Cannot validate address without location access');
        setValidatingAddress(false);
        return;
      }
      
      const location = await Location.getCurrentPositionAsync({});
      
      // Add a small random offset to simulate different addresses
      const lat = location.coords.latitude + (Math.random() - 0.5) * 0.01;
      const lng = location.coords.longitude + (Math.random() - 0.5) * 0.01;
      
      setCoordinates({
        latitude: lat,
        longitude: lng
      });
      
      setAddressValidated(true);
      
    } catch (error) {
      console.error('Error validating address:', error);
      Alert.alert('Error', 'Could not validate address');
    } finally {
      setValidatingAddress(false);
    }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert('Permission Needed', 'We need access to your photos to upload an event image');
      return;
    }
    
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    
    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };

  const uploadImage = async () => {
    if (!image) return null;
    
    try {
      setUploading(true);
      console.log('Starting image upload process...');
      
      // Convert URI to blob
      console.log('Image URI:', image);
      const response = await fetch(image);
      const blob = await response.blob();
      console.log('Blob created, size:', blob.size);
      
      // Generate a unique name for the image
      const fileName = `event-image-${Date.now()}.jpg`;
      const filePath = `event-images/${fileName}`;
      console.log('Upload path:', filePath);
      
      // Upload to Supabase Storage
      console.log('Uploading to Supabase...');
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('events')
        .upload(filePath, blob);
        
      if (uploadError) {
        console.error('Upload error details:', uploadError);
        throw uploadError;
      }
      
      console.log('Upload successful:', uploadData);
      
      // Get public URL
      const { data } = supabase.storage
        .from('events')
        .getPublicUrl(filePath);
      
      console.log('Public URL:', data.publicUrl);  
      return data.publicUrl;
    } catch (error) {
      console.error('Error uploading image:', error);
      Alert.alert('Upload Failed', 'Could not upload event image. Error: ' + error.message);
      return null;
    } finally {
      setUploading(false);
    }
  };

  const loadContacts = async () => {
    if (contacts.length > 0) {
      setShowingContacts(true);
      return;
    }
    
    setLoadingContacts(true);
    
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Cannot access contacts without permission');
        setLoadingContacts(false);
        return;
      }
      
      const { data } = await Contacts.getContactsAsync({
        fields: [
          Contacts.Fields.PhoneNumbers,
          Contacts.Fields.Name,
          Contacts.Fields.Image
        ],
        sort: Contacts.SortTypes.FirstName
      });
      
      const contactsWithPhones = data.filter(
        contact => contact.phoneNumbers && contact.phoneNumbers.length > 0
      );
      
      setContacts(contactsWithPhones);
      setShowingContacts(true);
    } catch (error) {
      console.error('Error loading contacts:', error);
      Alert.alert('Error', 'Failed to load contacts');
    } finally {
      setLoadingContacts(false);
    }
  };

  const toggleContactSelection = (contact) => {
    if (selectedContacts.some(c => c.id === contact.id)) {
      setSelectedContacts(selectedContacts.filter(c => c.id !== contact.id));
    } else {
      setSelectedContacts([...selectedContacts, contact]);
    }
  };

  const handleCreateEvent = async () => {
    if (!title || !address) {
      Alert.alert('Missing Information', 'Please provide a title and address for your event');
      return;
    }
    
    if (!addressValidated) {
      Alert.alert('Address Not Validated', 'Please validate the address before creating the event');
      return;
    }
    
    if (!user) {
      Alert.alert('Authentication Error', 'You must be logged in to create an event');
      return;
    }
    
    setUploading(true);
    
    try {
      // Upload image if selected
      const imageUrl = image ? await uploadImage() : null;
      
      // Make sure we have a valid date with time
      const eventDate = new Date(date);
      
      // Parse tags if this is an open event
      const parsedTags = isOpen ? tags.split(',')
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0) : null;
      
      // Create event in database
      const { data, error } = await supabase
        .from('events')
        .insert([
          {
            host_id: user.id,
            title,
            description,
            location: address,
            event_date: eventDate.toISOString(),
            image_url: imageUrl,
            is_open: isOpen,
            tags: parsedTags,
            latitude: coordinates.latitude,
            longitude: coordinates.longitude,
            created_at: new Date().toISOString()
          }
        ])
        .select();
        
      if (error) throw error;
      
      // If invite-only, handle invited contacts
      if (!isOpen && selectedContacts.length > 0) {
        // In a real app, you would store these invitations in a table
        // For now, we'll just show an alert with the invited contacts
        const invitedNames = selectedContacts.map(c => c.name).join(', ');
        Alert.alert('Invitations', `Invitations would be sent to: ${invitedNames}`);
      }
      
      Alert.alert('Success', 'Your event has been created!');
      navigation.goBack();
    } catch (error) {
      console.error('Error creating event:', error);
      Alert.alert('Error', 'Failed to create event. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const renderContactItem = (contact, index) => {
    const isSelected = selectedContacts.some(c => c.id === contact.id);
    const contactName = contact.name || 'No Name';
    
    return (
      <TouchableOpacity 
        key={index} 
        style={[styles.contactItem, isSelected && styles.selectedContact]}
        onPress={() => toggleContactSelection(contact)}
      >
        <Text style={styles.contactName}>{contactName}</Text>
        {isSelected && (
          <MaterialIcons name="check" size={20} color={COLORS.primary} />
        )}
      </TouchableOpacity>
    );
  };

  // Add OpenStreetMap search function
  const searchAddress = async (query) => {
    if (!query.trim() || query.length < 3) {
      setAddressResults([]);
      return;
    }
    
    setSearchingAddress(true);
    
    try {
      // Use OpenStreetMap's Nominatim API for geocoding
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=5`,
        {
          headers: {
            'Accept-Language': 'en', // Request results in English
            'User-Agent': 'FriendFinder App' // Identify your app as required by Nominatim usage policy
          }
        }
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch address suggestions');
      }
      
      const data = await response.json();
      
      // Format the results
      const formattedResults = data.map((item, index) => ({
        id: item.place_id.toString(),
        name: item.display_name,
        latitude: parseFloat(item.lat),
        longitude: parseFloat(item.lon)
      }));
      
      setAddressResults(formattedResults);
    } catch (error) {
      console.error('Error searching address:', error);
      Alert.alert('Error', 'Failed to search for addresses');
    } finally {
      setSearchingAddress(false);
    }
  };

  // Add debouncing for address search
  useEffect(() => {
    const delaySearch = setTimeout(() => {
      if (address && address.length >= 3 && addressInputFocused) {
        searchAddress(address);
      } else {
        setAddressResults([]);
      }
    }, 300); // Reduced debounce time for more responsive feeling
    
    return () => clearTimeout(delaySearch);
  }, [address, addressInputFocused]);

  // Add function to select an address
  const selectAddress = (item) => {
    setAddress(item.name);
    setCoordinates({
      latitude: item.latitude,
      longitude: item.longitude
    });
    setAddressResults([]);
    setAddressValidated(true);
  };

  // Add render function for address result items
  const renderAddressResult = ({ item }) => (
    <TouchableOpacity 
      style={styles.addressResultItem}
      onPress={() => selectAddress(item)}
    >
      <MaterialIcons name="location-on" size={20} color={COLORS.primary} />
      <Text style={styles.addressResultText}>{item.name}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <MaterialIcons name="arrow-back" size={24} color={COLORS.text} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>New Event</Text>
          </View>
          
          {showingContacts ? (
            <View style={styles.contactsContainer}>
              <View style={styles.contactsHeader}>
                <Text style={styles.contactsTitle}>Select Contacts to Invite</Text>
                <TouchableOpacity onPress={() => setShowingContacts(false)}>
                  <Text style={styles.doneButton}>Done</Text>
                </TouchableOpacity>
              </View>
              
              {loadingContacts ? (
                <ActivityIndicator size="large" color={COLORS.primary} style={styles.contactsLoading} />
              ) : (
                <ScrollView style={styles.contactsList}>
                  {contacts.map(renderContactItem)}
                </ScrollView>
              )}
            </View>
          ) : (
            <>
              <TouchableOpacity 
                style={styles.imageUploadContainer}
                onPress={pickImage}
              >
                {image ? (
                  <Image source={{ uri: image }} style={styles.previewImage} />
                ) : (
                  <>
                    <MaterialIcons name="file-upload" size={40} color={COLORS.text} />
                    <Text style={styles.uploadText}>Upload Photo</Text>
                  </>
                )}
              </TouchableOpacity>
              
              <View style={styles.formContainer}>
                <View style={styles.inputContainer}>
                  <Text style={styles.label}>Title</Text>
                  <TextInput
                    style={styles.input}
                    value={title}
                    onChangeText={setTitle}
                    placeholder="Event Title"
                    placeholderTextColor={COLORS.placeholder}
                  />
                </View>
                
                <View style={styles.inputContainer}>
                  <Text style={styles.label}>Address</Text>
                  <TextInput
                    style={styles.input}
                    value={address}
                    onChangeText={(text) => {
                      setAddress(text);
                      setAddressValidated(false);
                    }}
                    placeholder="Search for address..."
                    placeholderTextColor={COLORS.placeholder}
                    onFocus={() => setAddressInputFocused(true)}
                    onBlur={() => {
                      // Small delay to allow selection before hiding results
                      setTimeout(() => setAddressInputFocused(false), 200);
                    }}
                  />
                  
                  {searchingAddress && (
                    <ActivityIndicator 
                      size="small" 
                      color={COLORS.primary} 
                      style={styles.searchIndicator} 
                    />
                  )}
                  
                  {addressResults.length > 0 && addressInputFocused && (
                    <View style={styles.addressResultsDropdown}>
                      <FlatList
                        data={addressResults}
                        renderItem={renderAddressResult}
                        keyExtractor={item => item.id}
                        keyboardShouldPersistTaps="handled"
                      />
                    </View>
                  )}
                  
                  {addressValidated && coordinates && (
                    <View style={styles.mapPreviewContainer}>
                      <MapView
                        style={styles.mapPreview}
                        region={{
                          latitude: coordinates.latitude,
                          longitude: coordinates.longitude,
                          latitudeDelta: 0.005,
                          longitudeDelta: 0.005,
                        }}
                        scrollEnabled={false}
                        zoomEnabled={false}
                      >
                        <Marker
                          coordinate={{
                            latitude: coordinates.latitude,
                            longitude: coordinates.longitude,
                          }}
                        />
                      </MapView>
                    </View>
                  )}
                </View>
                
                <View style={styles.inputContainer}>
                  <Text style={styles.label}>Description</Text>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    value={description}
                    onChangeText={setDescription}
                    placeholder="Event Description"
                    placeholderTextColor={COLORS.placeholder}
                    multiline
                    numberOfLines={4}
                  />
                </View>
                
                <View style={styles.guestsContainer}>
                  <Text style={styles.label}>Guests</Text>
                  <View style={styles.guestOptionContainer}>
                    <TouchableOpacity 
                      style={[
                        styles.guestOption,
                        isOpen && styles.selectedOption
                      ]}
                      onPress={() => {
                        setIsOpen(true);
                        setInviteOnly(false);
                      }}
                    >
                      <View style={[
                        styles.radioButton, 
                        isOpen && styles.radioButtonSelected
                      ]}>
                        {isOpen && <View style={styles.radioButtonInner} />}
                      </View>
                      <Text style={styles.optionText}>Open</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                      style={[
                        styles.guestOption,
                        inviteOnly && styles.selectedOption
                      ]}
                      onPress={() => {
                        setIsOpen(false);
                        setInviteOnly(true);
                      }}
                    >
                      <View style={[
                        styles.radioButton, 
                        inviteOnly && styles.radioButtonSelected
                      ]}>
                        {inviteOnly && <View style={styles.radioButtonInner} />}
                      </View>
                      <Text style={styles.optionText}>Invite Only</Text>
                    </TouchableOpacity>
                  </View>
                  
                  {isOpen ? (
                    <View style={styles.tagsContainer}>
                      <Text style={styles.tagsLabel}>Tags (comma separated)</Text>
                      <TextInput
                        style={styles.tagsInput}
                        value={tags}
                        onChangeText={setTags}
                        placeholder="e.g. sports, outdoor, party"
                        placeholderTextColor={COLORS.placeholder}
                      />
                    </View>
                  ) : (
                    <TouchableOpacity 
                      style={styles.inviteButton}
                      onPress={loadContacts}
                    >
                      <Text style={styles.inviteButtonText}>
                        {selectedContacts.length > 0 
                          ? `${selectedContacts.length} contacts selected` 
                          : 'Select contacts to invite'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
              
              <TouchableOpacity 
                style={[
                  styles.createButton,
                  uploading && styles.disabledButton
                ]}
                onPress={handleCreateEvent}
                disabled={uploading}
              >
                {uploading ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <Text style={styles.createButtonText}>CREATE EVENT</Text>
                )}
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
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
    marginRight: 30, // To offset the back button and center the title
  },
  imageUploadContainer: {
    height: 180,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: SPACING.md,
    marginHorizontal: SPACING.md,
    borderRadius: LAYOUT.borderRadius,
  },
  uploadText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    marginTop: SPACING.sm,
  },
  previewImage: {
    width: '100%',
    height: '100%',
    borderRadius: LAYOUT.borderRadius,
  },
  formContainer: {
    padding: SPACING.md,
  },
  inputContainer: {
    marginBottom: SPACING.md,
  },
  label: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    marginBottom: SPACING.xs,
    color: COLORS.text,
  },
  input: {
    height: LAYOUT.inputHeight,
    backgroundColor: '#F0F0F0',
    borderRadius: LAYOUT.borderRadius,
    paddingHorizontal: SPACING.md,
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
  },
  addressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  addressInput: {
    flex: 1,
    height: LAYOUT.inputHeight,
    backgroundColor: '#F0F0F0',
    borderRadius: LAYOUT.borderRadius,
    paddingHorizontal: SPACING.md,
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    marginRight: SPACING.xs,
  },
  validateButton: {
    backgroundColor: COLORS.primary,
    height: LAYOUT.inputHeight,
    paddingHorizontal: SPACING.md,
    borderRadius: LAYOUT.borderRadius,
    justifyContent: 'center',
    alignItems: 'center',
  },
  validatedButton: {
    backgroundColor: '#34D399', // Green
  },
  validateButtonText: {
    color: 'white',
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
  },
  mapPreviewContainer: {
    marginTop: SPACING.sm,
    borderRadius: LAYOUT.borderRadius,
    overflow: 'hidden',
    height: 150,
  },
  mapPreview: {
    ...StyleSheet.absoluteFillObject,
  },
  textArea: {
    height: 100,
    paddingTop: SPACING.md,
    textAlignVertical: 'top',
  },
  guestsContainer: {
    marginBottom: SPACING.lg,
  },
  guestOptionContainer: {
    flexDirection: 'row',
    marginTop: SPACING.xs,
  },
  guestOption: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: SPACING.xl,
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#CCCCCC',
    marginRight: SPACING.xs,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioButtonSelected: {
    borderColor: COLORS.primary,
  },
  radioButtonInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.primary,
  },
  optionText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
  },
  selectedOption: {
    opacity: 1,
  },
  tagsContainer: {
    marginTop: SPACING.md,
  },
  tagsLabel: {
    fontSize: FONT_SIZES.sm,
    marginBottom: SPACING.xs,
    color: COLORS.text,
  },
  tagsInput: {
    height: LAYOUT.inputHeight,
    backgroundColor: '#F0F0F0',
    borderRadius: LAYOUT.borderRadius,
    paddingHorizontal: SPACING.md,
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
  },
  inviteButton: {
    height: LAYOUT.inputHeight,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: SPACING.md,
    borderRadius: LAYOUT.borderRadius,
  },
  inviteButtonText: {
    color: 'white',
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
  },
  createButton: {
    height: 50,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.xl,
    marginTop: SPACING.lg,
    borderRadius: LAYOUT.borderRadius,
  },
  disabledButton: {
    opacity: 0.7,
  },
  createButtonText: {
    color: 'white',
    fontSize: FONT_SIZES.md,
    fontWeight: 'bold',
  },
  contactsContainer: {
    flex: 1,
    padding: SPACING.md,
  },
  contactsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  contactsTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  doneButton: {
    color: COLORS.primary,
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
  },
  contactsLoading: {
    marginTop: 50,
  },
  contactsList: {
    flex: 1,
  },
  contactItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  selectedContact: {
    backgroundColor: '#F0F0FF',
  },
  contactName: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
  },
  searchIndicator: {
    position: 'absolute',
    right: 15,
    top: 45,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  addressResultsContainer: {
    backgroundColor: 'white',
    padding: SPACING.md,
    borderRadius: LAYOUT.borderRadius,
    width: '80%',
    maxHeight: '80%',
  },
  addressResultsTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    marginBottom: SPACING.md,
  },
  addressResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  addressResultText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    marginLeft: SPACING.xs,
    flex: 1,
  },
  closeButton: {
    backgroundColor: COLORS.primary,
    padding: SPACING.md,
    borderRadius: LAYOUT.borderRadius,
    alignItems: 'center',
    marginTop: SPACING.md,
  },
  closeButtonText: {
    color: 'white',
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
  },
  addressResultsDropdown: {
    position: 'absolute',
    top: 75, // Position below the input
    left: 0,
    right: 0,
    backgroundColor: 'white',
    borderRadius: LAYOUT.borderRadius,
    maxHeight: 200,
    zIndex: 1000,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
});

export default CreateEventScreen; 