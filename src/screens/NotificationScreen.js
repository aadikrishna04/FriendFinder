import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  SafeAreaView
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { supabase } from '../services/supabaseClient';
import { COLORS, SPACING, FONT_SIZES } from '../constants';

const NotificationScreen = ({ navigation }) => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    fetchNotifications();

    // Refresh notifications when the screen comes into focus
    const unsubscribe = navigation.addListener('focus', fetchNotifications);
    return unsubscribe;
  }, [navigation]);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError) throw userError;
      if (!user || !user.id) {
        console.log('No valid user found, redirecting to sign in');
        navigation.replace('SignIn');
        return;
      }
      
      setUser(user);
      
      // Fetch notifications from the database
      const { data: notificationsData, error: notificationsError } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
        
      if (notificationsError) throw notificationsError;
      
      // For invitations, fetch additional information about the sender
      const enhancedNotifications = await Promise.all(
        (notificationsData || []).map(async (notification) => {
          if (notification.type === 'invitation_sent' || notification.type === 'invitation_accepted') {
            // For invitation notifications, fetch sender info
            if (notification.content.invitation_id) {
              const { data: invitationData, error: invitationError } = await supabase
                .from('invitations')
                .select('inviter_id, invited_name, invited_phone, message, status')
                .eq('id', notification.content.invitation_id)
                .single();
                
              if (!invitationError && invitationData) {
                // Get the inviter's name
                const { data: inviterData, error: inviterError } = await supabase
                  .from('users')
                  .select('name, email')
                  .eq('id', invitationData.inviter_id)
                  .single();
                  
                if (!inviterError && inviterData) {
                  return {
                    ...notification,
                    inviter: inviterData,
                    invitation: invitationData
                  };
                }
              }
            }
          }
          
          return notification;
        })
      );
      
      setNotifications(enhancedNotifications);
    } catch (error) {
      console.error('Error fetching notifications:', error);
      Alert.alert('Error', 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId);
        
      if (error) throw error;
      
      // Update the local state
      setNotifications(
        notifications.map(notification => 
          notification.id === notificationId
            ? { ...notification, is_read: true }
            : notification
        )
      );
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const handleNotificationPress = (notification) => {
    if (!notification || !notification.id) {
      console.error('Invalid notification object:', notification);
      return;
    }
    
    // Mark the notification as read
    if (!notification.is_read) {
      markAsRead(notification.id);
    }
    
    // Navigate based on notification type
    if (notification.type === 'invitation_sent') {
      // Show invitation details
      Alert.alert(
        'Invitation Sent',
        `You have invited ${notification.content.invited_name} to join FriendFinder.`,
        [{ text: 'OK' }]
      );
    } else if (notification.type === 'invitation_accepted') {
      // Navigate to the user's profile if available
      if (notification.invitation && notification.invitation.inviter_id) {
        navigation.navigate('UserProfile', { userId: notification.invitation.inviter_id });
      } else {
        Alert.alert(
          'Invitation Accepted',
          `${notification.content.invited_name || 'Someone'} has accepted your invitation!`,
          [{ text: 'OK' }]
        );
      }
    } else if (notification.type === 'event_invitation') {
      // Navigate directly to event details page
      if (notification.content.event_id) {
        console.log('Navigating to event with ID:', notification.content.event_id);
        navigation.navigate('EventDetails', { eventId: notification.content.event_id });
      }
    } else if (notification.type === 'event_invitation_response') {
      // Navigate directly to event details
      if (notification.content.event_id) {
        console.log('Navigating to event (response) with ID:', notification.content.event_id);
        navigation.navigate('EventDetails', { eventId: notification.content.event_id });
      }
    }
  };

  // Add function to update invitation status
  const updateInvitationStatus = async (invitationId, status) => {
    try {
      if (!invitationId) {
        console.error('Invalid invitation ID: undefined');
        Alert.alert('Error', 'Invalid invitation ID');
        return;
      }
      
      const { error } = await supabase
        .from('event_invitations')
        .update({ status })
        .eq('id', invitationId);
        
      if (error) throw error;
      
      // Show confirmation
      Alert.alert(
        'Success',
        `You have ${status} the event invitation.`,
        [{ text: 'OK' }]
      );
      
      // Refresh notifications to update the UI
      fetchNotifications();
    } catch (error) {
      console.error('Error updating invitation status:', error);
      Alert.alert('Error', 'Failed to update invitation status');
    }
  };

  const renderNotificationItem = ({ item }) => {
    // Determine icon and color based on notification type
    let icon = 'notifications';
    let color = COLORS.primary;
    let title = 'Notification';
    let description = '';
    
    if (item.type === 'invitation_sent') {
      icon = 'person-add';
      color = '#4CAF50'; // Green
      title = 'Invitation Sent';
      description = `You invited ${item.content.invited_name || 'someone'} to join FriendFinder.`;
    } else if (item.type === 'invitation_accepted') {
      icon = 'check-circle';
      color = '#2196F3'; // Blue
      title = 'Invitation Accepted';
      description = `${item.content.invited_name || 'Someone'} accepted your invitation!`;
    } else if (item.type === 'event_invitation') {
      icon = 'event';
      color = '#FF9800'; // Orange
      title = 'Event Invitation';
      description = `${item.content.sender_name || 'Someone'} invited you to "${item.content.event_title}".`;
    } else if (item.type === 'event_invitation_response') {
      icon = 'event-available';
      color = '#8E6FC5'; // Purple
      title = 'Invitation Response';
      description = `${item.content.responder_name || 'Someone'} ${item.content.status} your invitation to "${item.content.event_title}".`;
    }
    
    // Format date
    const date = new Date(item.created_at);
    const formattedDate = date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    
    return (
      <TouchableOpacity
        style={[
          styles.notificationItem,
          !item.is_read && styles.unreadNotification
        ]}
        onPress={() => handleNotificationPress(item)}
      >
        <View style={[styles.iconContainer, { backgroundColor: color }]}>
          <MaterialIcons name={icon} size={24} color="white" />
        </View>
        
        <View style={styles.notificationContent}>
          <Text style={styles.notificationTitle}>{title}</Text>
          <Text style={styles.notificationDescription}>{description}</Text>
          <Text style={styles.notificationTime}>{formattedDate}</Text>
        </View>
        
        {!item.is_read && (
          <View style={styles.unreadDot} />
        )}
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <MaterialIcons name="notifications-none" size={64} color={COLORS.textLight} />
      <Text style={styles.emptyTitle}>No Notifications</Text>
      <Text style={styles.emptySubtitle}>
        You don't have any notifications yet.
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Notifications</Text>
      </View>
      
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading notifications...</Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          renderItem={renderNotificationItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={renderEmptyState}
          onRefresh={fetchNotifications}
          refreshing={loading}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background || '#F8F9FA',
  },
  header: {
    padding: SPACING.md,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  listContent: {
    flexGrow: 1,
    paddingVertical: SPACING.sm,
  },
  notificationItem: {
    flexDirection: 'row',
    padding: SPACING.md,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    alignItems: 'center',
  },
  unreadNotification: {
    backgroundColor: '#F0F8FF', // Light blue background
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  notificationContent: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 2,
  },
  notificationDescription: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary || '#666',
    marginBottom: 4,
  },
  notificationTime: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textLight || '#999',
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.primary,
    marginLeft: SPACING.sm,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: SPACING.md,
    color: COLORS.textSecondary,
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
    color: COLORS.textSecondary,
    marginTop: SPACING.md,
  },
  emptySubtitle: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textLight,
    textAlign: 'center',
    marginTop: SPACING.sm,
  },
});

export default NotificationScreen; 