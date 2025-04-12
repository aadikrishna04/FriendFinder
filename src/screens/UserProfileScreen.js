import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  SafeAreaView, 
  TouchableOpacity,
  ActivityIndicator,
  Alert
} from 'react-native';
import { supabase } from '../services/supabaseClient';
import { COLORS, SPACING, FONT_SIZES } from '../constants';

const UserProfileScreen = ({ route, navigation }) => {
  const { userId } = route.params;
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUserProfile();
  }, [userId]);

  const fetchUserProfile = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;
      
      if (data) {
        setUserData(data);
      } else {
        Alert.alert('Error', 'User not found');
        navigation.goBack();
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
      Alert.alert('Error', 'Failed to load user profile');
    } finally {
      setLoading(false);
    }
  };
  
  // Format phone number for display
  const formatPhoneNumber = (phoneNumber) => {
    if (!phoneNumber) return 'No phone number';
    
    // Assuming US format, can be adapted for international
    const cleaned = phoneNumber.replace(/\D/g, '');
    const match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/);
    
    if (match) {
      return `(${match[1]}) ${match[2]}-${match[3]}`;
    }
    
    return phoneNumber;
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>User Profile</Text>
      </View>
      
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      ) : userData ? (
        <View style={styles.profileContainer}>
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarText}>
              {userData.name ? userData.name.charAt(0).toUpperCase() : '?'}
            </Text>
          </View>
          
          <Text style={styles.nameText}>{userData.name || 'No Name'}</Text>
          
          <View style={styles.infoSection}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Email:</Text>
              <Text style={styles.infoValue}>{userData.email || 'No Email'}</Text>
            </View>
            
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Phone:</Text>
              <Text style={styles.infoValue}>{formatPhoneNumber(userData.phone_number)}</Text>
            </View>
          </View>
          
          <View style={styles.actionsContainer}>
            <TouchableOpacity style={styles.actionButton}>
              <Text style={styles.actionButtonText}>Send Message</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.actionButton}>
              <Text style={styles.actionButtonText}>Schedule Meeting</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Could not load user profile</Text>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background || '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md || 20,
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
    fontSize: FONT_SIZES.lg || 18,
    fontWeight: 'bold',
    color: COLORS.text || '#000000',
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
  profileContainer: {
    flex: 1,
    padding: SPACING.lg || 24,
    alignItems: 'center',
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.primary || '#8B5CF6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md || 20,
  },
  avatarText: {
    fontSize: FONT_SIZES.xxl || 36,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  nameText: {
    fontSize: FONT_SIZES.xl || 24,
    fontWeight: 'bold',
    color: COLORS.text || '#000000',
    marginBottom: SPACING.lg || 24,
  },
  infoSection: {
    width: '100%',
    marginBottom: SPACING.xl || 32,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: SPACING.md || 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border || '#E5E5E5',
    paddingBottom: SPACING.sm || 12,
  },
  infoLabel: {
    width: 80,
    fontSize: FONT_SIZES.md || 16,
    fontWeight: '500',
    color: COLORS.secondaryText || '#666666',
  },
  infoValue: {
    flex: 1,
    fontSize: FONT_SIZES.md || 16,
    color: COLORS.text || '#000000',
  },
  actionsContainer: {
    width: '100%',
  },
  actionButton: {
    backgroundColor: COLORS.primary || '#8B5CF6',
    paddingVertical: SPACING.md || 20,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: SPACING.md || 20,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: FONT_SIZES.md || 16,
    fontWeight: '600',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: FONT_SIZES.md || 16,
    color: COLORS.error || '#DC2626',
  },
});

export default UserProfileScreen; 