import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZES } from '../constants';
import { sendInvitation } from '../services/authService';

const InviteContactScreen = ({ route, navigation }) => {
  const { contact } = route.params || {};
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSendInvitation = async () => {
    if (!contact || !contact.name || !contact.phoneNumber) {
      Alert.alert('Error', 'Contact information is incomplete');
      return;
    }

    setLoading(true);
    try {
      const result = await sendInvitation(contact.name, contact.phoneNumber, message);
      
      if (result.success) {
        Alert.alert(
          'Invitation Sent',
          `An invitation has been sent to ${contact.name}.`,
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      } else {
        // Handle the case where the contact was already invited
        if (result.already_invited) {
          Alert.alert(
            'Already Invited',
            `${contact.name} has already been invited to join FriendFinder.`,
            [{ text: 'OK', onPress: () => navigation.goBack() }]
          );
        } else {
          Alert.alert('Error', result.message || 'Failed to send invitation');
        }
      }
    } catch (error) {
      console.error('Error sending invitation:', error);
      Alert.alert('Error', error.message || 'Failed to send invitation');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidView}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <MaterialIcons name="arrow-back" size={24} color={COLORS.text} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Invite Contact</Text>
          </View>

          {/* Contact Information */}
          <View style={styles.contactCard}>
            <MaterialIcons name="person" size={36} color={COLORS.primary} style={styles.contactIcon} />
            <View style={styles.contactInfo}>
              <Text style={styles.contactName}>
                {contact?.name || 'Unknown Contact'}
              </Text>
              <Text style={styles.contactPhone}>
                {contact?.phoneNumber || 'No phone number'}
              </Text>
            </View>
          </View>

          {/* Invitation Message */}
          <View style={styles.formContainer}>
            <Text style={styles.sectionTitle}>Personalize Your Invitation</Text>
            <Text style={styles.sectionSubtitle}>
              Add a personal message to your invitation (optional)
            </Text>

            <TextInput
              style={styles.messageInput}
              multiline
              numberOfLines={4}
              placeholder="Hey! I'm using FriendFinder to organize events. Join me!"
              placeholderTextColor={COLORS.textLight}
              value={message}
              onChangeText={setMessage}
              textAlignVertical="top"
            />
          </View>

          {/* Send Button */}
          <TouchableOpacity
            style={styles.sendButton}
            onPress={handleSendInvitation}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color={COLORS.white} />
            ) : (
              <>
                <Text style={styles.sendButtonText}>Send Invitation</Text>
                <MaterialIcons name="send" size={18} color={COLORS.white} style={styles.sendIcon} />
              </>
            )}
          </TouchableOpacity>

          {/* Information Text */}
          <Text style={styles.infoText}>
            Your contact will receive an SMS invitation with a link to download the app and join your network.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  keyboardAvoidView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: SPACING.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.lg,
    paddingTop: SPACING.md,
  },
  backButton: {
    padding: SPACING.sm,
    marginRight: SPACING.sm,
  },
  headerTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  contactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    padding: SPACING.md,
    borderRadius: 8,
    marginBottom: SPACING.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  contactIcon: {
    marginRight: SPACING.md,
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: FONT_SIZES.md,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  contactPhone: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textLight,
    marginTop: 2,
  },
  formContainer: {
    backgroundColor: COLORS.white,
    padding: SPACING.md,
    borderRadius: 8,
    marginBottom: SPACING.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  sectionSubtitle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textLight,
    marginBottom: SPACING.md,
  },
  messageInput: {
    backgroundColor: COLORS.backgroundLight,
    borderRadius: 8,
    padding: SPACING.md,
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    minHeight: 120,
  },
  sendButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    padding: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
    flexDirection: 'row',
  },
  sendButtonText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.md,
    fontWeight: 'bold',
  },
  sendIcon: {
    marginLeft: SPACING.sm,
  },
  infoText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textLight,
    textAlign: 'center',
    marginTop: SPACING.md,
  },
});

export default InviteContactScreen; 