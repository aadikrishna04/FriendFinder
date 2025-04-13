import React, { useState, useEffect } from "react";
import * as FileSystem from "expo-file-system";
import { Buffer } from "buffer";
import { Keyboard } from 'react-native';

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
  FlatList,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import { supabase } from "../services/supabaseClient";
import { COLORS, SPACING, FONT_SIZES, LAYOUT } from "../constants";
import * as Location from "expo-location";
import { MaterialIcons } from "@expo/vector-icons";
import MapView, { Marker } from "react-native-maps";
import * as Contacts from "expo-contacts";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";

const CreateEventScreen = () => {
  const navigation = useNavigation();
  const [title, setTitle] = useState("");
  const [address, setAddress] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(new Date());
  const [startTime, setStartTime] = useState(new Date());
  const [endTime, setEndTime] = useState(new Date(Date.now() + 3600000)); // Default to 1 hour later
  const [image, setImage] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [isOpen, setIsOpen] = useState(true);
  const [inviteOnly, setInviteOnly] = useState(false);
  const [tags, setTags] = useState("");
  const [coordinates, setCoordinates] = useState(null);
  const [user, setUser] = useState(null);

  // Time picker state
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);

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

  // Add new state for group features
  const [userGroups, setUserGroups] = useState([]);
  const [selectedGroups, setSelectedGroups] = useState([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [showGroupsModal, setShowGroupsModal] = useState(false);

  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUser(user);
    };

    getUser();
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
    }
  };

  const uploadImage = async () => {
    if (!image) return null;

    setUploading(true);

    try {
      // Extract file extension from URI
      const fileExtension = image.split(".").pop().toLowerCase();
      const fileName = `${user.id}-${Date.now()}.${fileExtension}`;
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

      if (status !== "granted") {
        Alert.alert(
          "Permission Denied",
          "Cannot access contacts without permission"
        );
        setLoadingContacts(false);
        return;
      }

      const { data } = await Contacts.getContactsAsync({
        fields: [
          Contacts.Fields.PhoneNumbers,
          Contacts.Fields.Emails,  // Explicitly request emails
          Contacts.Fields.Name,
          Contacts.Fields.Image,
        ],
        sort: Contacts.SortTypes.FirstName,
      });

      console.log(`Loaded ${data.length} contacts`);
      
      // Log how many contacts have emails
      const contactsWithEmails = data.filter(
        (contact) => contact.emails && contact.emails.length > 0
      );
      console.log(`${contactsWithEmails.length} contacts have email addresses`);

      const contactsWithPhones = data.filter(
        (contact) => contact.phoneNumbers && contact.phoneNumbers.length > 0
      );
      
      console.log(`${contactsWithPhones.length} contacts have phone numbers`);

      // Use contacts with either emails or phone numbers
      const usableContacts = data.filter(
        (contact) => 
          (contact.phoneNumbers && contact.phoneNumbers.length > 0) ||
          (contact.emails && contact.emails.length > 0)
      );
      
      console.log(`${usableContacts.length} contacts have either email or phone`);
      
      // Fetch registered app users and enhance the contacts with app user info
      const enhancedContacts = await fetchRegisteredUsers(usableContacts);
      
      setContacts(enhancedContacts);
      setShowingContacts(true);
    } catch (error) {
      console.error("Error loading contacts:", error);
      Alert.alert("Error", "Failed to load contacts");
    } finally {
      setLoadingContacts(false);
    }
  };
  
  // Fetch registered users from database and match with contacts
  const fetchRegisteredUsers = async (contactsList) => {
    try {
      // Extract all unique emails and phone numbers from contacts
      const emailsSet = new Set();
      const phonesSet = new Set();
      
      contactsList.forEach(contact => {
        // Get emails
        if (contact.emails && contact.emails.length > 0) {
          contact.emails.forEach(email => {
            if (email.email) emailsSet.add(email.email.toLowerCase());
          });
        }
        
        // Get phones
        if (contact.phoneNumbers && contact.phoneNumbers.length > 0) {
          contact.phoneNumbers.forEach(phone => {
            // Standardize phone numbers by removing non-digit characters
            const standardizedPhone = phone.number.replace(/\D/g, '');
            if (standardizedPhone) phonesSet.add(standardizedPhone);
          });
        }
      });
      
      const emails = Array.from(emailsSet);
      const phones = Array.from(phonesSet);
      
      console.log(`Extracted ${emails.length} unique emails and ${phones.length} unique phone numbers`);
      
      // Find registered users by email
      const { data: emailUsers, error: emailError } = await supabase
        .from('users')
        .select('id, name, email, phone_number')
        .in('email', emails);
      
      if (emailError) {
        console.error('Error fetching users by email:', emailError);
      }
      
      // Find registered users by phone
      const { data: phoneUsers, error: phoneError } = await supabase
        .from('users')
        .select('id, name, email, phone_number')
        .in('phone_number', phones);
      
      if (phoneError) {
        console.error('Error fetching users by phone:', phoneError);
      }
      
      // Combine users, avoiding duplicates
      const appUsers = [];
      const userIds = new Set();
      
      if (emailUsers) {
        emailUsers.forEach(user => {
          if (!userIds.has(user.id)) {
            appUsers.push(user);
            userIds.add(user.id);
          }
        });
      }
      
      if (phoneUsers) {
        phoneUsers.forEach(user => {
          if (!userIds.has(user.id)) {
            appUsers.push(user);
            userIds.add(user.id);
          }
        });
      }
      
      console.log(`Found ${appUsers.length} registered app users`);
      
      // Create lookup maps for both email and phone
      const emailMap = new Map();
      const phoneMap = new Map();
      
      appUsers.forEach(user => {
        if (user.email) emailMap.set(user.email.toLowerCase(), user);
        if (user.phone_number) phoneMap.set(user.phone_number, user);
      });
      
      // Enhance contacts with app user data
      return contactsList.map(contact => {
        // Try to match by email first
        let appUser = null;
        
        if (contact.emails && contact.emails.length > 0) {
          for (const emailObj of contact.emails) {
            if (emailObj.email) {
              const email = emailObj.email.toLowerCase();
              if (emailMap.has(email)) {
                appUser = emailMap.get(email);
                break;
              }
            }
          }
        }
        
        // If no match by email, try by phone
        if (!appUser && contact.phoneNumbers && contact.phoneNumbers.length > 0) {
          for (const phoneObj of contact.phoneNumbers) {
            const standardizedPhone = phoneObj.number.replace(/\D/g, '');
            if (phoneMap.has(standardizedPhone)) {
              appUser = phoneMap.get(standardizedPhone);
              break;
            }
          }
        }
        
        // Return enhanced contact
        return appUser ? {
          ...contact,
          appUserId: appUser.id,
          appUserEmail: appUser.email,
          appUserName: appUser.name,
          appUserPhone: appUser.phone_number,
          isRegistered: true
        } : {
          ...contact,
          isRegistered: false
        };
      });
    } catch (error) {
      console.error('Error fetching registered users:', error);
      return contactsList; // Return original list if there's an error
    }
  };

  const toggleContactSelection = (contact) => {
    if (selectedContacts.some((c) => c.id === contact.id)) {
      setSelectedContacts(selectedContacts.filter((c) => c.id !== contact.id));
    } else {
      setSelectedContacts([...selectedContacts, contact]);
    }
  };

  // Add a new useEffect to fetch groups when invite-only is selected
  useEffect(() => {
    if (inviteOnly) {
      fetchUserGroups();
    }
  }, [inviteOnly]);
  
  // Add fetchUserGroups function
  const fetchUserGroups = async () => {
    if (!user) return;
    
    try {
      setLoadingGroups(true);
      
      // Fetch groups where user is a member
      const { data: membershipData, error: membershipError } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('user_id', user.id);
        
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
        
        // Get member counts for each group
        const groupsWithCounts = await Promise.all(groupsData.map(async (group) => {
          const { count, error: countError } = await supabase
            .from('group_members')
            .select('*', { count: 'exact', head: true })
            .eq('group_id', group.id);
            
          if (countError) throw countError;
          
          return {
            ...group,
            isHost: group.host_id === user.id,
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
      setLoadingGroups(false);
    }
  };
  
  // Add function to toggle group selection
  const toggleGroupSelection = (group) => {
    if (selectedGroups.some(g => g.id === group.id)) {
      setSelectedGroups(selectedGroups.filter(g => g.id !== group.id));
    } else {
      setSelectedGroups([...selectedGroups, group]);
    }
  };

  const handleCreateEvent = async () => {
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
        "Please validate the address before creating the event"
      );
      return;
    }

    if (!user) {
      Alert.alert(
        "Authentication Error",
        "You must be logged in to create an event"
      );
      return;
    }

    setUploading(true);

    try {
      // Upload image if selected
      const imageUrl = image ? await uploadImage() : null;

      // Make sure we have a valid date with time
      const eventDate = new Date(date);

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

      // Parse tags if this is an open event
      const parsedTags = isOpen
        ? tags
            .split(",")
            .map((tag) => tag.trim())
            .filter((tag) => tag.length > 0)
        : null;

      // Create event in database
      const { data, error } = await supabase
        .from("events")
        .insert([
          {
            host_id: user.id,
            title,
            description,
            location: address,
            event_date: eventDate.toISOString(),
            start_time: startTimeStr,
            end_time: endTimeStr,
            image_url: imageUrl,
            is_open: isOpen,
            tags: parsedTags,
            latitude: coordinates.latitude,
            longitude: coordinates.longitude,
            created_at: new Date().toISOString(),
          },
        ])
        .select();

      if (error) throw error;

      // If invite-only, handle invited contacts and groups
      if (!isOpen) {
        const eventId = data[0].id; // Get the newly created event ID
        let registeredCount = 0;
        let unregisteredCount = 0;
        
        // Process selected contacts for individual invitations
        if (selectedContacts.length > 0) {
          // Process each selected contact and create invitations
          const invitePromises = selectedContacts.map(async (contact) => {
            try {
              // Log contact info
              console.log(`Processing contact: ${contact.name}`);
              
              // If this contact is a registered user (matched during fetchRegisteredUsers)
              if (contact.isRegistered && contact.appUserId) {
                console.log(`Using app data for registered user: ${contact.appUserName} (${contact.appUserEmail})`);
                
                // Use the app user ID directly - DO NOT include email/phone due to DB constraint
                const { error: inviteError } = await supabase
                  .from('event_invitations')
                  .insert({
                    event_id: eventId,
                    inviter_id: user.id,
                    invitee_id: contact.appUserId,
                    status: 'pending'
                  });
                
                if (inviteError) {
                  console.error('Error creating invitation with app user ID:', inviteError);
                  return null;
                }
                
                return { 
                  type: 'registered', 
                  user: { 
                    id: contact.appUserId,
                    name: contact.appUserName,
                    email: contact.appUserEmail
                  }
                };
              }
              
              // For non-registered users, get contact info from device
              // Get contact email if available
              let email = null;
              if (contact.emails && contact.emails.length > 0) {
                email = contact.emails[0].email;
                console.log(`Using device email for non-registered user ${contact.name}: ${email}`);
              } else {
                console.log(`No email found for contact: ${contact.name}`);
              }
              
              // If no email available, try to use phone as fallback
              let phoneNumber = null;
              if (!email && contact.phoneNumbers && contact.phoneNumbers.length > 0) {
                // Extract just the digits from the phone number
                phoneNumber = contact.phoneNumbers[0].number.replace(/\D/g, '');
                
                // Format consistently with country code (assuming US numbers)
                if (phoneNumber.length === 10) {
                  phoneNumber = `+1${phoneNumber}`;
                } else if (phoneNumber.length > 10 && !phoneNumber.startsWith('+')) {
                  phoneNumber = `+${phoneNumber}`;
                }
                console.log(`Using device phone for non-registered user ${contact.name}: ${phoneNumber}`);
              }
              
              if (!email && !phoneNumber) {
                console.log('No contact info for:', contact.name);
                return null;
              }
              
              // Store invitation with contact info for non-registered user
              const contactValue = email || phoneNumber;
              const contactType = email ? 'email' : 'phone';
              
              const { error: inviteError } = await supabase
                .from('event_invitations')
                .insert({
                  event_id: eventId,
                  inviter_id: user.id,
                  invitee_phone: contactType === 'phone' ? contactValue : null,
                  invitee_email: contactType === 'email' ? contactValue : null,
                  status: 'pending'
                });
              
              if (inviteError) {
                console.error('Error creating contact invitation:', inviteError);
                return null;
              }
              
              return { 
                type: 'unregistered', 
                contactType,
                contactValue,
                name: contact.name 
              };
            } catch (error) {
              console.error('Error processing invitation:', error);
              return null;
            }
          });
          
          const results = await Promise.all(invitePromises);
          const validResults = results.filter(r => r !== null);
          
          registeredCount = validResults.filter(r => r.type === 'registered').length;
          unregisteredCount = validResults.filter(r => r.type === 'unregistered').length;
        }
        
        // Process selected groups - add entries to event_groups table
        let totalGroupMembers = 0;
        if (selectedGroups.length > 0) {
          const groupEntries = selectedGroups.map(group => ({
            event_id: eventId,
            group_id: group.id,
            invited_by: user.id
          }));
          
          const { error: groupInviteError } = await supabase
            .from('event_groups')
            .insert(groupEntries);
            
          if (groupInviteError) {
            console.error('Error inviting groups:', groupInviteError);
          } else {
            console.log(`${selectedGroups.length} groups invited to event`);
            totalGroupMembers = selectedGroups.reduce((sum, group) => sum + group.memberCount, 0);
          }
        }
        
        // Show alert with invitation summary
        let alertMessage = "";
        if (registeredCount > 0 || unregisteredCount > 0) {
          alertMessage += `Invitations sent to ${registeredCount} registered users and ${unregisteredCount} contacts who aren't registered yet.`;
        }
        
        if (selectedGroups.length > 0) {
          if (alertMessage) alertMessage += "\n\n";
          alertMessage += `${totalGroupMembers} members across ${selectedGroups.length} groups have been invited.`;
        }
        
        if (alertMessage) {
          Alert.alert("Invitations Sent", alertMessage);
        }
      }

      Alert.alert("Success", "Your event has been created!");
      navigation.goBack();
    } catch (error) {
      console.error("Error creating event:", error);
      Alert.alert("Error", "Failed to create event. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const renderContactItem = (contact, index) => {
    const isSelected = selectedContacts.some((c) => c.id === contact.id);
    const contactName = contact.name || "No Name";

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
      longitude: item.longitude,
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

  // Add these new functions for date/time handling
  
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

  // Handle date change
  const onDateChange = (event, selectedDate) => {
    const currentDate = selectedDate || date;
    setShowDatePicker(false);
    setDate(currentDate);
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

  // Render date and time pickers
  const renderDateTimePickers = () => (
    <View style={styles.inputContainer}>
      <Text style={styles.label}>Event Date & Time</Text>

      <TouchableOpacity
        style={styles.datePickerButton}
        onPress={() => setShowDatePicker(true)}
      >
        <MaterialIcons name="event" size={20} color={COLORS.primary} />
        <Text style={styles.dateTimeText}>{formatDate(date)}</Text>
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
          value={date}
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

  // Add a useEffect to catch keyboard show/hide events for better handling
  useEffect(() => {
    if (Platform.OS === 'ios') {
      const keyboardWillShowListener = Keyboard.addListener('keyboardWillShow', () => {
        // Ensure we're scrolled properly when keyboard appears
      });
      
      const keyboardWillHideListener = Keyboard.addListener('keyboardWillHide', () => {
        // Handling when keyboard hides
      });
      
      return () => {
        keyboardWillShowListener.remove();
        keyboardWillHideListener.remove();
      };
    }
  }, []);

  // Add function to render group items
  const renderGroupItem = ({ item }) => {
    const isSelected = selectedGroups.some(g => g.id === item.id);
    
    return (
      <TouchableOpacity
        style={[styles.groupItem, isSelected && styles.selectedGroup]}
        onPress={() => toggleGroupSelection(item)}
      >
        <View style={styles.groupInfo}>
          <Text style={styles.groupName}>{item.name}</Text>
          <Text style={styles.groupMemberCount}>
            {item.memberCount} {item.memberCount === 1 ? 'member' : 'members'}
          </Text>
        </View>
        
        {isSelected && (
          <MaterialIcons name="check" size={20} color={COLORS.primary} />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.container}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={true}
          bounces={true}
        >
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
                    <View style={styles.tagsContainer}>
                      <Text style={styles.tagsLabel}>
                        Tags (comma separated)
                      </Text>
                      <TextInput
                        style={styles.tagsInput}
                        value={tags}
                        onChangeText={setTags}
                        placeholder="e.g. sports, outdoor, party"
                        placeholderTextColor={COLORS.placeholder}
                      />
                    </View>
                  ) : (
                    <>
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
                      
                      <TouchableOpacity
                        style={[styles.inviteButton, { marginTop: SPACING.sm }]}
                        onPress={() => setShowGroupsModal(true)}
                      >
                        <Text style={styles.inviteButtonText}>
                          {selectedGroups.length > 0
                            ? `${selectedGroups.length} groups selected`
                            : "Select groups to invite"}
                        </Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              </View>

              {/* Add the date/time pickers here */}
              {renderDateTimePickers()}

              <TouchableOpacity
                style={[
                  styles.createButton,
                  uploading && styles.disabledButton,
                ]}
                onPress={handleCreateEvent}
                disabled={uploading}
              >
                {uploading ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <Text style={styles.createButtonText}>Save Event</Text>
                )}
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
      
      {/* Add Groups Modal */}
      <Modal
        visible={showGroupsModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowGroupsModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Groups</Text>
              <TouchableOpacity onPress={() => setShowGroupsModal(false)}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            
            {loadingGroups ? (
              <ActivityIndicator size="large" color={COLORS.primary} style={styles.loader} />
            ) : userGroups.length === 0 ? (
              <Text style={styles.emptyText}>You don't have any groups yet</Text>
            ) : (
              <FlatList
                data={userGroups}
                renderItem={renderGroupItem}
                keyExtractor={item => item.id}
                contentContainerStyle={styles.groupsList}
              />
            )}
            
            <TouchableOpacity
              style={[
                styles.doneButton,
                selectedGroups.length === 0 && styles.disabledButton
              ]}
              onPress={() => setShowGroupsModal(false)}
              disabled={selectedGroups.length === 0}
            >
              <Text style={styles.doneButtonText}>
                {selectedGroups.length > 0
                  ? `Add ${selectedGroups.length} Groups`
                  : "Done"}
              </Text>
            </TouchableOpacity>
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
    paddingBottom: 100,
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
    marginRight: 30, // To offset the back button and center the title
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
    marginBottom: SPACING.md,
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
    marginTop: SPACING.sm,
    justifyContent: "space-between",
    padding: SPACING.xs,
  },
  guestOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: SPACING.sm,
    borderRadius: LAYOUT.borderRadius / 2,
    borderWidth: 1,
    borderColor: COLORS.border,
    flex: 0.48, // Close to half width with a small gap
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
  tagsContainer: {
    marginTop: SPACING.md,
  },
  tagsLabel: {
    fontSize: FONT_SIZES.sm,
    marginBottom: SPACING.xs,
    color: COLORS.text,
  },
  tagsInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: SPACING.xs,
    padding: SPACING.sm,
    marginTop: SPACING.xs,
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
  createButton: {
    height: 56,
    backgroundColor: COLORS.primary,
    justifyContent: "center",
    alignItems: "center",
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.xl * 3, // Significantly increase bottom margin to avoid tab bar
    marginTop: SPACING.xl,
    borderRadius: LAYOUT.borderRadius,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  disabledButton: {
    opacity: 0.7,
  },
  createButtonText: {
    color: "white",
    fontSize: FONT_SIZES.lg,
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
  contactName: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
  },
  searchIndicator: {
    position: "absolute",
    right: 15,
    top: 45,
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
  addressResultItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  addressResultText: {
    marginLeft: SPACING.xs,
    flex: 1,
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
  },
  closeButton: {
    backgroundColor: COLORS.primary,
    padding: SPACING.md,
    borderRadius: LAYOUT.borderRadius,
    alignItems: "center",
    marginTop: SPACING.md,
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
    shadowOpacity: 0.2,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  // Add styles for date and time pickers
  datePickerButton: {
    flexDirection: "row",
    alignItems: "center",
    height: LAYOUT.inputHeight,
    backgroundColor: "#F0F0F0",
    borderRadius: LAYOUT.borderRadius,
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  timePickersRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: SPACING.md,
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
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  timeLabel: {
    fontSize: FONT_SIZES.sm,
    marginBottom: 4,
    color: COLORS.text,
  },
  dateTimeText: {
    flex: 1,
    marginLeft: SPACING.sm,
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
  },
  // Add styles for group features
  groupItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: LAYOUT.borderRadius,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
  },
  selectedGroup: {
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
  },
  groupMemberCount: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.secondaryText,
    marginTop: 2,
  },
  groupsList: {
    padding: SPACING.sm,
  },
  emptyText: {
    textAlign: 'center',
    color: COLORS.secondaryText,
    padding: SPACING.lg,
  },
  doneButton: {
    backgroundColor: COLORS.primary,
    padding: SPACING.md,
    borderRadius: LAYOUT.borderRadius,
    alignItems: 'center',
    margin: SPACING.md,
  },
  doneButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: FONT_SIZES.md,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
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
  loader: {
    padding: SPACING.xl,
  },
});

export default CreateEventScreen;
