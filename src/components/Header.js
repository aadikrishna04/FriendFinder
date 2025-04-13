import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Modal, ScrollView, SafeAreaView, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../services/supabaseClient';
import { COLORS, FONT_SIZES, SPACING } from '../constants';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';

const radius_options = [5, 10, 20, 50, 100];

const Header = ({ location, eventsCount, onLocationPress, profile, onRadiusChange, searchQuery, setSearchQuery, onSearch }) => {
  const [user, setUser] = useState(null);
  const [userName, setUserName] = useState('');
  const [showRadiusModal, setShowRadiusModal] = useState(false);
  const [radius, setRadius] = useState(20);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const navigation = useNavigation();
  const searchInputRef = React.useRef(null);

  useEffect(() => {
    // Get user profile data
    const getUserProfile = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        setUser(user);
        
        if (user) {
          // Get the profile information to get the name
          const { data, error } = await supabase
            .from('profiles')
            .select('first_name')
            .eq('id', user.id)
            .single();
            
          if (data && data.first_name) {
            setUserName(data.first_name);
          }
        }
      } catch (error) {
        console.error('Error getting user profile:', error);
      }
    };

    getUserProfile();
  }, []);

  const handleRadiusSelect = (newRadius) => {
    setRadius(newRadius);
    setShowRadiusModal(false);
    if (onRadiusChange) {
      onRadiusChange(newRadius);
    }
  };

  const handleProfilePress = () => {
    setShowProfileModal(true);
  };

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      setShowProfileModal(false);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const navigateToProfileScreen = () => {
    setShowProfileModal(false);
    navigation.navigate('ProfileScreen');
  };

  const renderSearchBar = () => (
    <View style={styles.searchContainer}>
      <View style={styles.searchBar}>
        <Ionicons name="search" size={20} color="#AAAAAA" />
        <TextInput
          ref={searchInputRef}
          style={styles.searchInput}
          placeholder="Search for an event"
          placeholderTextColor="#AAAAAA"
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={onSearch}
          returnKeyType="search"
        />
      </View>
      <TouchableOpacity style={styles.seeAllButton}>
        <Text style={styles.seeAllText}>See All</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <>
      <LinearGradient
        colors={[
          'rgba(255,255,255,1)',     // Fully opaque white at top
          'rgba(255,255,255,1)',     // Still fully opaque white at 60% point
          'rgba(255,255,255,0.75)',  // Start getting translucent
          'rgba(255,255,255,0.5)'    // Most translucent at bottom (frosted glass effect)
        ]}
        locations={[0, 0.6, 0.8, 1.0]}
        style={styles.headerGradient}>
        <View style={styles.header}>
          <View style={styles.locationContainer}>
            <TouchableOpacity style={styles.locationButton} onPress={() => setShowRadiusModal(true)}>
              <Text style={styles.locationText}>{location || 'Current Location'}</Text>
              <Ionicons name="chevron-down" size={16} color={COLORS.text} />
            </TouchableOpacity>
            <Text style={styles.locationSubtext}>
              within {radius} miles
            </Text>
          </View>
          
          <View style={styles.greetingContainer}>
            <Text style={styles.greeting}>Hello, {userName || 'Friend'}</Text>
            <Text style={styles.eventsText}>
              There are {eventsCount || 0} new events in your area.
            </Text>
          </View>
          
          <View style={styles.profileContainer}>
            <TouchableOpacity onPress={handleProfilePress}>
              {profile ? (
                <Image source={{ uri: profile }} style={styles.profileImage} />
              ) : (
                <View style={styles.profilePlaceholder}>
                  <Ionicons name="person" size={24} color="#FFFFFF" />
                </View>
              )}
            </TouchableOpacity>
          </View>
          
          {renderSearchBar()}
        </View>
      </LinearGradient>

      {/* Radius Selection Modal */}
      <Modal
        visible={showRadiusModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowRadiusModal(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setShowRadiusModal(false)}
        >
          <View style={styles.radiusModalContainer}>
            <View style={styles.radiusModalContent}>
              <Text style={styles.modalTitle}>Select Search Radius</Text>
              <ScrollView>
                {radius_options.map((option) => (
                  <TouchableOpacity
                    key={option}
                    style={[
                      styles.radiusOption,
                      radius === option && styles.selectedRadiusOption
                    ]}
                    onPress={() => handleRadiusSelect(option)}
                  >
                    <Text style={[
                      styles.radiusOptionText,
                      radius === option && styles.selectedRadiusText
                    ]}>
                      {option} miles
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Profile Modal */}
      <Modal
        visible={showProfileModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowProfileModal(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setShowProfileModal(false)}
        >
          <View style={styles.profileModalContainer}>
            <View style={styles.profileModalContent}>
              <Text style={styles.modalTitle}>Profile</Text>
              
              <View style={styles.profileModalHeader}>
                {profile ? (
                  <Image source={{ uri: profile }} style={styles.profileModalImage} />
                ) : (
                  <View style={styles.profileModalPlaceholder}>
                    <Ionicons name="person" size={40} color="#FFFFFF" />
                  </View>
                )}
                <Text style={styles.profileModalName}>{userName || 'User'}</Text>
                <Text style={styles.profileModalEmail}>{user?.email || ''}</Text>
              </View>
              
              <TouchableOpacity 
                style={styles.profileOption}
                onPress={navigateToProfileScreen}
              >
                <Ionicons name="person-circle-outline" size={24} color={COLORS.text} />
                <Text style={styles.profileOptionText}>View Profile</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.profileOption}
                onPress={() => setShowProfileModal(false)}
              >
                <Ionicons name="settings-outline" size={24} color={COLORS.text} />
                <Text style={styles.profileOptionText}>Settings</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.profileOption, styles.signOutOption]}
                onPress={handleSignOut}
              >
                <Ionicons name="log-out-outline" size={24} color="#ff3b30" />
                <Text style={styles.signOutText}>Sign Out</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  headerGradient: {
    width: '100%',
    zIndex: 5,
    paddingBottom: 20,
  },
  header: {
    paddingTop: 15,
    paddingBottom: 15,
    paddingHorizontal: 20,
    width: '100%',
  },
  locationContainer: {
    marginBottom: 5,
  },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginRight: 4,
  },
  locationSubtext: {
    fontSize: 12,
    color: 'rgba(0, 0, 0, 0.5)',
    marginTop: 2,
  },
  greetingContainer: {
    marginTop: 24,
    marginBottom: 20,
  },
  greeting: {
    fontSize: 34,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 8,
  },
  eventsText: {
    fontSize: 18,
    color: '#9D7BB5',
    marginTop: 0,
  },
  searchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    width: '100%',
    zIndex: 10,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 25,
    paddingHorizontal: 15,
    paddingVertical: 8,
    marginRight: 10,
    height: 45,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    marginLeft: 10,
    color: '#000000',
  },
  seeAllButton: {
    paddingVertical: 10,
  },
  seeAllText: {
    color: '#8E6FC5',
    fontSize: 16,
    fontWeight: '500',
  },
  profileContainer: {
    position: 'absolute',
    top: 15,
    right: 20,
  },
  profileImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  profilePlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#C8C8C8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  radiusModalContainer: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '40%',
  },
  radiusModalContent: {
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 15,
    textAlign: 'center',
  },
  radiusOption: {
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  selectedRadiusOption: {
    backgroundColor: '#F0F0FF',
  },
  radiusOptionText: {
    fontSize: 16,
    textAlign: 'center',
  },
  selectedRadiusText: {
    color: '#8E6FC5',
    fontWeight: '600',
  },
  profileModalContainer: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '50%',
  },
  profileModalContent: {
    padding: 20,
  },
  profileModalHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  profileModalImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 10,
  },
  profileModalPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#C8C8C8',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  profileModalName: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  profileModalEmail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
  },
  profileOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  profileOptionText: {
    fontSize: 16,
    marginLeft: 15,
  },
  signOutOption: {
    marginTop: 20,
    borderBottomWidth: 0,
  },
  signOutText: {
    fontSize: 16,
    marginLeft: 15,
    color: '#ff3b30',
  },
});

export default Header;
