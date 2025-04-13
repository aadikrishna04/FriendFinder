import React, { useState, useEffect } from "react";
import * as FileSystem from "expo-file-system";
import { Buffer } from "buffer";

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
  FlatList,
  Modal,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { supabase } from "../services/supabaseClient";
import { COLORS, SPACING, FONT_SIZES, LAYOUT } from "../constants";
import { MaterialIcons } from "@expo/vector-icons";
import MapView, { Marker } from "react-native-maps";
import * as Contacts from "expo-contacts";
import DateTimePicker from "@react-native-community/datetimepicker";

const EditEventScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { event } = route.params;

  // Form state
  const [title, setTitle] = useState(event.title || "");
  const [address, setAddress] = useState(event.location || "");
  const [description, setDescription] = useState(event.description || "");
  const [eventDate, setEventDate] = useState(new Date(event.event_date));
  const [startTime, setStartTime] = useState(
    event.start_time ? new Date(`2000-01-01T${event.start_time}`) : new Date()
  );
  const [endTime, setEndTime] = useState(
    event.end_time ? new Date(`2000-01-01T${event.end_time}`) : new Date()
  );
  const [image, setImage] = useState(null);
  const [imageUrl, setImageUrl] = useState(event.image_url || null);
  const [isOpen, setIsOpen] = useState(event.is_open !== false);
  const [inviteOnly, setInviteOnly] = useState(event.is_open === false);
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState(event.tags || []);
  const [coordinates, setCoordinates] = useState({
    latitude: event.latitude || null,
    longitude: event.longitude || null,
  });

  // UI state
  const [loading, setLoading] = useState(false);
  const [validatingAddress, setValidatingAddress] = useState(false);
  const [addressValidated, setAddressValidated] = useState(!!event.latitude);
  const [showingContacts, setShowingContacts] = useState(false);
  const [contacts, setContacts] = useState([]);
  const [selectedContacts, setSelectedContacts] = useState([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [addressResults, setAddressResults] = useState([]);
  const [searchingAddress, setSearchingAddress] = useState(false);

  // Time picker state
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Add a state for input focus
  const [addressInputFocused, setAddressInputFocused] = useState(false);

  useEffect(() => {
    requestLocationPermission();
  }, []);

  const requestLocationPermission = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission Denied",
        "We need location permission to validate and pin the event location on the map"
      );
    }
  };

  const validateAddress = async () => {
    if (!address.trim()) {
      Alert.alert("Missing Information", "Please enter an address");
      return;
    }

    setValidatingAddress(true);

    try {
      // In a real app, you'd use a geocoding service here
      // For demo purposes, we'll use the device's location
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== "granted") {
        Alert.alert(
          "Permission Denied",
          "Cannot validate address without location access"
        );
        setValidatingAddress(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({});

      // Add a small random offset to simulate different addresses
      const lat = location.coords.latitude + (Math.random() - 0.5) * 0.01;
      const lng = location.coords.longitude + (Math.random() - 0.5) * 0.01;

      setCoordinates({
        latitude: lat,
        longitude: lng,
      });

      setAddressValidated(true);
    } catch (error) {
      console.error("Error validating address:", error);
      Alert.alert("Error", "Could not validate address");
    } finally {
      setValidatingAddress(false);
    }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (status !== "granted") {
      Alert.alert(
        "Permission Needed",
        "We need access to your photos to upload an event image"
      );
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
      setImageUrl(null); // Clear old image URL when new image is selected
    }
  };

  const uploadImage = async () => {
    if (!image) return null;

    setLoading(true);

    try {
      // Get current user session
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user) throw new Error("No user session");
      // Extract file extension from URI
      const fileExtension = image.split(".").pop().toLowerCase();
      const fileName = `${session.user.id}-${Date.now()}.${fileExtension}`;
      const filePath = `event_images/${fileName}`;

      // Read the file directly as base64 using Expo FileSystem
      const base64String = await FileSystem.readAsStringAsync(image, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Convert base64 to buffer
      const buffer = Buffer.from(base64String, "base64");

      // Determine content type based on file extension
      const contentType =
        fileExtension === "png"
          ? "image/png"
          : fileExtension === "gif"
          ? "image/gif"
          : "image/jpeg";

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from("event-images")
        .upload(filePath, buffer, {
          cacheControl: "3600",
          upsert: false,
          contentType, // Set the correct content type
        });

      if (error) throw error;

      // Get public URL
      const {
        data: { publicUrl },
      } = await supabase.storage.from("event-images").getPublicUrl(data.path);

      return publicUrl;
    } catch (error) {
      console.error("Upload error:", error);
      Alert.alert("Upload Error", error.message);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const loadContacts = async () => {
    if (contacts.length > 0) {
      setShowingContacts(true);
      return;
    }

    setLoadingContacts(true);

    try {
      // Fetch the current user's contacts from the database instead of device contacts
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError) throw userError;

      // Fetch contacts with joined user data - similar to ContactsScreen
      const { data: contactsData, error: contactsError } = await supabase
        .from('contacts')
        .select(`
          id, 
          name, 
          email, 
          phone_number,
          contact_id,
          contacts_users:contact_id(id, name, email, phone_number)
        `)
        .eq('owner_id', user.id)
        .order('name');
        
      if (contactsError) throw contactsError;
      
      // Transform database contacts to match the format expected by the rest of the code
      const enhancedContacts = contactsData.map(contact => ({
        id: contact.id.toString(),
        name: contact.name,
        emails: contact.email ? [{ email: contact.email }] : [],
        phoneNumbers: contact.phone_number ? [{ number: contact.phone_number }] : [],
        appUserId: contact.contact_id,
        appUserEmail: contact.email,
        appUserName: contact.name,
        appUserPhone: contact.phone_number,
        isRegistered: true,
        contactInfo: contact.contacts_users
      }));
      
      setContacts(enhancedContacts);
      setShowingContacts(true);
    } catch (error) {
      console.error("Error loading contacts:", error);
      Alert.alert("Error", "Failed to load contacts");
    } finally {
      setLoadingContacts(false);
    }
  };

  const toggleContactSelection = (contact) => {
    if (selectedContacts.some((c) => c.id === contact.id)) {
      setSelectedContacts(selectedContacts.filter((c) => c.id !== contact.id));
    } else {
      setSelectedContacts([...selectedContacts, contact]);
    }
  };

  // Handle adding a tag
  const addTag = () => {
    if (tagInput.trim()) {
      // Don't add duplicate tags
      if (!tags.includes(tagInput.trim())) {
        setTags([...tags, tagInput.trim()]);
      }
      setTagInput("");
    }
  };

  // Handle removing a tag
  const removeTag = (index) => {
    const newTags = [...tags];
    newTags.splice(index, 1);
    setTags(newTags);
  };

  const saveEvent = async () => {
    if (!title || !address) {
      Alert.alert(
        "Missing Information",
        "Please provide a title and address for your event"
      );
      return;
    }

    if (!addressValidated) {
      Alert.alert(
        "Address Not Validated",
        "Please validate the address before saving"
      );
      return;
    }

    setLoading(true);

    try {
      // Upload image if a new one is selected
      const newImageUrl = image ? await uploadImage() : imageUrl;

      // Format start and end times
      const startTimeStr = startTime
        ? `${startTime.getHours().toString().padStart(2, "0")}:${startTime
            .getMinutes()
            .toString()
            .padStart(2, "0")}:00`
        : null;

      const endTimeStr = endTime
        ? `${endTime.getHours().toString().padStart(2, "0")}:${endTime
            .getMinutes()
            .toString()
            .padStart(2, "0")}:00`
        : null;

      // Update event in database
      const { error } = await supabase
        .from("events")
        .update({
          title,
          description,
          location: address,
          event_date: eventDate.toISOString(),
          start_time: startTimeStr,
          end_time: endTimeStr,
          image_url: newImageUrl,
          is_open: isOpen,
          tags: isOpen ? tags : null,
          latitude: coordinates.latitude,
          longitude: coordinates.longitude,
          updated_at: new Date().toISOString(),
        })
        .eq("id", event.id);

      if (error) throw error;

      // If invite-only, handle invited contacts
      if (!isOpen && selectedContacts.length > 0) {
        let registeredCount = 0;
        let unregisteredCount = 0;
        
        // Process each selected contact and create invitations
        const invitePromises = selectedContacts.map(async (contact) => {
          try {
            // If this contact is a registered user
            if (contact.isRegistered && contact.appUserId) {
              console.log(`Using app data for registered user: ${contact.appUserName} (${contact.appUserEmail})`);
              
              // Check if invitation already exists
              const { data: existingInvitation, error: checkError } = await supabase
                .from('event_invitations')
                .select('id')
                .eq('event_id', event.id)
                .eq('invitee_id', contact.appUserId)
                .single();
                
              if (!checkError && existingInvitation) {
                console.log(`Invitation already exists for user ${contact.appUserId}`);
                return { type: 'existing' };
              }
              
              // Use the app user ID directly
              const { error: inviteError } = await supabase
                .from('event_invitations')
                .insert({
                  event_id: event.id,
                  inviter_id: user.id,
                  invitee_id: contact.appUserId,
                  status: 'pending'
                });
              
              if (inviteError) {
                console.error('Error creating invitation with app user ID:', inviteError);
                return null;
              }
              
              return { type: 'registered' };
            }
            
            // For non-registered users with email or phone
            let email = null;
            if (contact.emails && contact.emails.length > 0) {
              email = contact.emails[0].email;
            }
            
            let phoneNumber = null;
            if (!email && contact.phoneNumbers && contact.phoneNumbers.length > 0) {
              phoneNumber = contact.phoneNumbers[0].number.replace(/\D/g, '');
              
              // Format consistently with country code (assuming US numbers)
              if (phoneNumber.length === 10) {
                phoneNumber = `+1${phoneNumber}`;
              } else if (phoneNumber.length > 10 && !phoneNumber.startsWith('+')) {
                phoneNumber = `+${phoneNumber}`;
              }
            }
            
            if (!email && !phoneNumber) {
              console.log('No contact info for:', contact.name);
              return null;
            }
            
            // Check if invitation already exists
            const contactValue = email || phoneNumber;
            const contactType = email ? 'email' : 'phone';
            
            const { data: existingInvitation, error: checkError } = await supabase
              .from('event_invitations')
              .select('id')
              .eq('event_id', event.id)
              .eq(contactType === 'email' ? 'invitee_email' : 'invitee_phone', contactValue)
              .single();
              
            if (!checkError && existingInvitation) {
              console.log(`Invitation already exists for ${contactType}: ${contactValue}`);
              return { type: 'existing' };
            }
            
            // Store invitation with contact info for non-registered user
            const { error: inviteError } = await supabase
              .from('event_invitations')
              .insert({
                event_id: event.id,
                inviter_id: user.id,
                invitee_phone: contactType === 'phone' ? contactValue : null,
                invitee_email: contactType === 'email' ? contactValue : null,
                status: 'pending'
              });
            
            if (inviteError) {
              console.error('Error creating contact invitation:', inviteError);
              return null;
            }
            
            return { type: 'unregistered' };
          } catch (error) {
            console.error('Error processing invitation:', error);
            return null;
          }
        });
        
        const results = await Promise.all(invitePromises);
        const validResults = results.filter(r => r !== null && r.type !== 'existing');
        
        registeredCount = validResults.filter(r => r.type === 'registered').length;
        unregisteredCount = validResults.filter(r => r.type === 'unregistered').length;
        
        if (registeredCount > 0 || unregisteredCount > 0) {
          Alert.alert(
            "Invitations Sent",
            `Invitations sent to ${registeredCount} registered users and ${unregisteredCount} contacts who aren't registered yet.`
          );
        } else if (results.filter(r => r && r.type === 'existing').length === selectedContacts.length) {
          Alert.alert("No New Invitations", "All selected contacts have already been invited to this event.");
        }
      }

      Alert.alert("Success", "Your event has been updated!");
      navigation.goBack();
    } catch (error) {
      console.error("Error updating event:", error);
      Alert.alert("Error", "Failed to update event. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const renderContactItem = (contact, index) => {
    const isSelected = selectedContacts.some((c) => c.id === contact.id);
    const contactName = contact.name || "No Name";
    const contactEmail = contact.appUserEmail || (contact.emails && contact.emails[0]?.email) || "";
    const contactPhone = contact.appUserPhone || (contact.phoneNumbers && contact.phoneNumbers[0]?.number) || "";

    return (
      <TouchableOpacity
        key={index}
        style={[styles.contactItem, isSelected && styles.selectedContact]}
        onPress={() => toggleContactSelection(contact)}
      >
        <View style={styles.contactItemContent}>
          <Text style={styles.contactName}>{contactName}</Text>
          {contactEmail && <Text style={styles.contactDetail}>{contactEmail}</Text>}
          {contactPhone && <Text style={styles.contactDetail}>{contactPhone}</Text>}
        </View>
        {isSelected && (
          <MaterialIcons name="check" size={20} color={COLORS.primary} />
        )}
      </TouchableOpacity>
    );
  };

  // Update the render method to show tags as chips
  const renderTagChips = () => {
    return (
      <View style={styles.tagChipsContainer}>
        {tags.map((tag, index) => (
          <View key={index} style={styles.tagChip}>
            <Text style={styles.tagChipText}>{tag}</Text>
            <TouchableOpacity
              onPress={() => removeTag(index)}
              style={styles.tagChipRemove}
            >
              <MaterialIcons name="close" size={16} color="white" />
            </TouchableOpacity>
          </View>
        ))}
      </View>
    );
  };

  // Update the tags UI to show tags as chips and have an input field for new tags
  const renderTagsInput = () => {
    return (
      <View style={styles.tagsContainer}>
        <Text style={styles.tagsLabel}>Tags</Text>
        {renderTagChips()}
        <View style={styles.tagInputContainer}>
          <TextInput
            style={styles.tagInput}
            value={tagInput}
            onChangeText={setTagInput}
            placeholder="Add a tag..."
            placeholderTextColor={COLORS.placeholder}
            onSubmitEditing={addTag}
            returnKeyType="done"
          />
          <TouchableOpacity style={styles.addTagButton} onPress={addTag}>
            <Text style={styles.addTagButtonText}>Add</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const searchAddress = async (query) => {
    if (!query.trim() || query.length < 3) {
      setAddressResults([]);
      return;
    }

    setSearchingAddress(true);

    try {
      // Use OpenStreetMap's Nominatim API for geocoding
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
          query
        )}&format=json&addressdetails=1&limit=5`,
        {
          headers: {
            "Accept-Language": "en", // Request results in English
            "User-Agent": "FriendFinder App", // Identify your app as required by Nominatim usage policy
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch address suggestions");
      }

      const data = await response.json();

      // Format the results
      const formattedResults = data.map((item, index) => ({
        id: item.place_id.toString(),
        name: item.display_name,
        latitude: parseFloat(item.lat),
        longitude: parseFloat(item.lon),
      }));

      setAddressResults(formattedResults);
    } catch (error) {
      console.error("Error searching address:", error);
      Alert.alert("Error", "Failed to search for addresses");
    } finally {
      setSearchingAddress(false);
    }
  };

  const selectAddress = (item) => {
    setAddress(item.name);
    setCoordinates({
      latitude: item.latitude,
      longitude: item.longitude,
    });
    setAddressResults([]);
    setAddressValidated(true);
  };

  // Render address search results
  const renderAddressResult = ({ item }) => (
    <TouchableOpacity
      style={styles.addressResultItem}
      onPress={() => selectAddress(item)}
    >
      <MaterialIcons name="location-on" size={20} color={COLORS.primary} />
      <Text style={styles.addressResultText}>{item.name}</Text>
    </TouchableOpacity>
  );

  // Add debounce to address search
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

  // Modified address input component
  const renderAddressInput = () => (
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
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
          />
        </View>
      )}

      {addressValidated && coordinates.latitude && coordinates.longitude && (
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
  );

  // Handle date change
  const onDateChange = (event, selectedDate) => {
    const currentDate = selectedDate || eventDate;
    setShowDatePicker(false);
    setEventDate(currentDate);
  };

  // Handle start time change
  const onStartTimeChange = (event, selectedTime) => {
    const currentTime = selectedTime || startTime;
    setShowStartTimePicker(false);
    setStartTime(currentTime);
  };

  // Handle end time change
  const onEndTimeChange = (event, selectedTime) => {
    const currentTime = selectedTime || endTime;
    setShowEndTimePicker(false);
    setEndTime(currentTime);
  };

  // Format time for display
  const formatTime = (date) => {
    let hours = date.getHours();
    let minutes = date.getMinutes();
    const ampm = hours >= 12 ? "PM" : "AM";

    hours = hours % 12;
    hours = hours ? hours : 12; // the hour '0' should be '12'
    minutes = minutes < 10 ? "0" + minutes : minutes;

    return `${hours}:${minutes} ${ampm}`;
  };

  // Format date for display
  const formatDate = (date) => {
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  // Render date and time pickers
  const renderDateTimePickers = () => (
    <View style={styles.inputContainer}>
      <Text style={styles.label}>Event Date & Time</Text>

      <TouchableOpacity
        style={styles.datePickerButton}
        onPress={() => setShowDatePicker(true)}
      >
        <MaterialIcons name="event" size={20} color={COLORS.primary} />
        <Text style={styles.dateTimeText}>{formatDate(eventDate)}</Text>
      </TouchableOpacity>

      <View style={styles.timePickersRow}>
        <View style={styles.timePickerContainer}>
          <Text style={styles.timeLabel}>Start Time</Text>
          <TouchableOpacity
            style={styles.timePickerButton}
            onPress={() => setShowStartTimePicker(true)}
          >
            <MaterialIcons
              name="access-time"
              size={20}
              color={COLORS.primary}
            />
            <Text style={styles.dateTimeText}>{formatTime(startTime)}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.timePickerContainer}>
          <Text style={styles.timeLabel}>End Time</Text>
          <TouchableOpacity
            style={styles.timePickerButton}
            onPress={() => setShowEndTimePicker(true)}
          >
            <MaterialIcons
              name="access-time"
              size={20}
              color={COLORS.primary}
            />
            <Text style={styles.dateTimeText}>{formatTime(endTime)}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {showDatePicker && (
        <DateTimePicker
          testID="dateTimePicker"
          value={eventDate}
          mode="date"
          is24Hour={true}
          display="default"
          onChange={onDateChange}
        />
      )}

      {showStartTimePicker && (
        <DateTimePicker
          testID="startTimePicker"
          value={startTime}
          mode="time"
          is24Hour={false}
          display="default"
          onChange={onStartTimeChange}
        />
      )}

      {showEndTimePicker && (
        <DateTimePicker
          testID="endTimePicker"
          value={endTime}
          mode="time"
          is24Hour={false}
          display="default"
          onChange={onEndTimeChange}
        />
      )}
    </View>
  );

  // Updated delete button with ghost style
  const renderDeleteButton = () => (
    <TouchableOpacity
      style={styles.deleteButton}
      onPress={() => {
        Alert.alert(
          "Delete Event",
          "Are you sure you want to delete this event?",
          [
            {
              text: "Cancel",
              style: "cancel",
            },
            {
              text: "Delete",
              style: "destructive",
              onPress: async () => {
                setLoading(true);
                try {
                  const { error } = await supabase
                    .from("events")
                    .delete()
                    .eq("id", event.id);

                  if (error) throw error;

                  Alert.alert("Success", "Event has been deleted");
                  navigation.goBack();
                } catch (error) {
                  console.error("Error deleting event:", error);
                  Alert.alert("Error", "Failed to delete event");
                } finally {
                  setLoading(false);
                }
              },
            },
          ]
        );
      }}
      disabled={loading}
    >
      <Text style={styles.deleteButtonText}>Delete Event</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
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
            <Text style={styles.headerTitle}>Edit Event</Text>
          </View>

          {showingContacts ? (
            <View style={styles.contactsContainer}>
              <View style={styles.contactsHeader}>
                <Text style={styles.contactsTitle}>
                  Select Contacts to Invite
                </Text>
                <TouchableOpacity onPress={() => setShowingContacts(false)}>
                  <Text style={styles.doneButton}>Done</Text>
                </TouchableOpacity>
              </View>

              {loadingContacts ? (
                <ActivityIndicator
                  size="large"
                  color={COLORS.primary}
                  style={styles.contactsLoading}
                />
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
                ) : imageUrl ? (
                  <Image
                    source={{ uri: imageUrl }}
                    style={styles.previewImage}
                  />
                ) : (
                  <>
                    <MaterialIcons
                      name="file-upload"
                      size={40}
                      color={COLORS.text}
                    />
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

                {renderAddressInput()}

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
                        isOpen && styles.selectedOption,
                      ]}
                      onPress={() => {
                        setIsOpen(true);
                        setInviteOnly(false);
                      }}
                    >
                      <View
                        style={[
                          styles.radioButton,
                          isOpen && styles.radioButtonSelected,
                        ]}
                      >
                        {isOpen && <View style={styles.radioButtonInner} />}
                      </View>
                      <Text style={styles.optionText}>Open</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.guestOption,
                        inviteOnly && styles.selectedOption,
                      ]}
                      onPress={() => {
                        setIsOpen(false);
                        setInviteOnly(true);
                      }}
                    >
                      <View
                        style={[
                          styles.radioButton,
                          inviteOnly && styles.radioButtonSelected,
                        ]}
                      >
                        {inviteOnly && <View style={styles.radioButtonInner} />}
                      </View>
                      <Text style={styles.optionText}>Invite Only</Text>
                    </TouchableOpacity>
                  </View>

                  {isOpen ? (
                    renderTagsInput()
                  ) : (
                    <TouchableOpacity
                      style={styles.inviteButton}
                      onPress={loadContacts}
                    >
                      <Text style={styles.inviteButtonText}>
                        {selectedContacts.length > 0
                          ? `${selectedContacts.length} contacts selected`
                          : "Select contacts to invite"}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {renderDateTimePickers()}
            </>
          )}

          <TouchableOpacity
            style={styles.saveButton}
            onPress={saveEvent}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Text style={styles.saveButtonText}>Save Event</Text>
            )}
          </TouchableOpacity>

          {renderDeleteButton()}
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
    flexDirection: "row",
    alignItems: "center",
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    padding: SPACING.xs,
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: FONT_SIZES.xl,
    fontWeight: "bold",
    color: COLORS.text,
  },
  imageUploadContainer: {
    height: 180,
    backgroundColor: "#F0F0F0",
    justifyContent: "center",
    alignItems: "center",
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
    width: "100%",
    height: "100%",
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
    fontWeight: "600",
    marginBottom: SPACING.xs,
    color: COLORS.text,
  },
  input: {
    height: LAYOUT.inputHeight,
    backgroundColor: "#F0F0F0",
    borderRadius: LAYOUT.borderRadius,
    paddingHorizontal: SPACING.md,
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
  },
  addressContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  addressInput: {
    flex: 1,
    height: LAYOUT.inputHeight,
    backgroundColor: "#F0F0F0",
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
    justifyContent: "center",
    alignItems: "center",
  },
  validatedButton: {
    backgroundColor: "#34D399", // Green
  },
  validateButtonText: {
    color: "white",
    fontSize: FONT_SIZES.sm,
    fontWeight: "600",
  },
  mapPreviewContainer: {
    marginTop: SPACING.sm,
    borderRadius: LAYOUT.borderRadius,
    overflow: "hidden",
    height: 150,
  },
  mapPreview: {
    ...StyleSheet.absoluteFillObject,
  },
  textArea: {
    height: 100,
    paddingTop: SPACING.md,
    textAlignVertical: "top",
  },
  guestsContainer: {
    marginBottom: SPACING.lg,
  },
  guestOptionContainer: {
    flexDirection: "row",
    marginTop: SPACING.xs,
  },
  guestOption: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: SPACING.xl,
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#CCCCCC",
    marginRight: SPACING.xs,
    justifyContent: "center",
    alignItems: "center",
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
  inviteButton: {
    height: LAYOUT.inputHeight,
    backgroundColor: COLORS.primary,
    justifyContent: "center",
    alignItems: "center",
    marginTop: SPACING.md,
    borderRadius: LAYOUT.borderRadius,
  },
  inviteButtonText: {
    color: "white",
    fontSize: FONT_SIZES.md,
    fontWeight: "600",
  },
  deleteButton: {
    height: 50,
    borderWidth: 2,
    borderColor: "#F87171",
    backgroundColor: "transparent",
    justifyContent: "center",
    alignItems: "center",
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.xl,
    marginTop: SPACING.md,
    borderRadius: LAYOUT.borderRadius,
  },
  deleteButtonText: {
    color: "#F87171",
    fontSize: FONT_SIZES.md,
    fontWeight: "bold",
  },
  saveButton: {
    height: 50,
    backgroundColor: COLORS.primary,
    justifyContent: "center",
    alignItems: "center",
    marginHorizontal: SPACING.md,
    marginTop: SPACING.lg,
    borderRadius: LAYOUT.borderRadius,
  },
  saveButtonText: {
    color: "white",
    fontSize: FONT_SIZES.md,
    fontWeight: "bold",
  },
  contactsContainer: {
    flex: 1,
    padding: SPACING.md,
  },
  contactsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.md,
  },
  contactsTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: "bold",
    color: COLORS.text,
  },
  doneButton: {
    color: COLORS.primary,
    fontSize: FONT_SIZES.md,
    fontWeight: "600",
  },
  contactsLoading: {
    marginTop: 50,
  },
  contactsList: {
    flex: 1,
  },
  contactItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  selectedContact: {
    backgroundColor: "#F0F0FF",
  },
  contactItemContent: {
    flex: 1,
  },
  contactName: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
  },
  contactDetail: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textLight,
    marginTop: 2,
  },
  tagChipsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: SPACING.sm,
  },
  tagChip: {
    flexDirection: "row",
    backgroundColor: COLORS.primary,
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
    margin: 4,
    alignItems: "center",
  },
  tagChipText: {
    color: "white",
    fontSize: FONT_SIZES.sm,
    marginRight: 6,
  },
  tagChipRemove: {
    width: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  tagInputContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  tagInput: {
    flex: 1,
    height: LAYOUT.inputHeight,
    backgroundColor: "#F0F0F0",
    borderRadius: LAYOUT.borderRadius,
    paddingHorizontal: SPACING.md,
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    marginRight: SPACING.xs,
  },
  addTagButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: LAYOUT.borderRadius,
  },
  addTagButtonText: {
    color: "white",
    fontSize: FONT_SIZES.sm,
    fontWeight: "600",
  },
  tagsContainer: {
    marginTop: SPACING.md,
  },
  tagsLabel: {
    fontSize: FONT_SIZES.sm,
    marginBottom: SPACING.xs,
    color: COLORS.text,
  },
  addressResultItem: {
    flexDirection: "row",
    alignItems: "center",
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
  searchIndicator: {
    position: "absolute",
    right: 15,
    top: 45,
  },
  datePickerButton: {
    flexDirection: "row",
    alignItems: "center",
    height: LAYOUT.inputHeight,
    backgroundColor: "#F0F0F0",
    borderRadius: LAYOUT.borderRadius,
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
  },
  timePickersRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  timePickerContainer: {
    flex: 1,
    marginRight: SPACING.sm,
  },
  timePickerButton: {
    flexDirection: "row",
    alignItems: "center",
    height: LAYOUT.inputHeight,
    backgroundColor: "#F0F0F0",
    borderRadius: LAYOUT.borderRadius,
    paddingHorizontal: SPACING.md,
  },
  timeLabel: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  dateTimeText: {
    marginLeft: SPACING.sm,
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  addressResultsContainer: {
    backgroundColor: "white",
    padding: SPACING.md,
    borderRadius: LAYOUT.borderRadius,
    width: "80%",
    maxHeight: "80%",
  },
  addressResultsTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: "bold",
    marginBottom: SPACING.md,
  },
  closeButton: {
    backgroundColor: COLORS.primary,
    padding: SPACING.md,
    borderRadius: LAYOUT.borderRadius,
    alignItems: "center",
  },
  closeButtonText: {
    color: "white",
    fontSize: FONT_SIZES.md,
    fontWeight: "600",
  },
  addressResultsDropdown: {
    position: "absolute",
    top: 75, // Position below the input
    left: 0,
    right: 0,
    backgroundColor: "white",
    borderRadius: LAYOUT.borderRadius,
    maxHeight: 200,
    zIndex: 1000,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
});

export default EditEventScreen;
