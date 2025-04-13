import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
  Switch,
  ScrollView,
  SafeAreaView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Contacts from 'expo-contacts';
import { supabase } from '../services/supabaseClient';
import { COLORS, SPACING, FONT_SIZES } from '../constants';

const GroupDetailScreen = ({ route, navigation }) => {
  const { groupId, groupName } = route.params;
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState(null);
  const [isOwner, setIsOwner] = useState(false);
  const [addMemberModalVisible, setAddMemberModalVisible] = useState(false);
  const [contactList, setContactList] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredContacts, setFilteredContacts] = useState([]);
  const [groupSettings, setGroupSettings] = useState({
    isPrivate: true,
    memberLimit: 20
  });
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [tempSettings, setTempSettings] = useState({
    isPrivate: true,
    memberLimit: 20
  });

  useEffect(() => {
    navigation.setOptions({
      title: groupName || 'Group Details',
      headerRight: () => (
        <TouchableOpacity 
          style={styles.headerButton} 
          onPress={() => setAddMemberModalVisible(true)}
        >
          <Ionicons name="person-add" size={24} color={COLORS.primary} />
        </TouchableOpacity>
      ),
    });

    fetchUserAndMembers();
    loadContacts();
  }, [groupId, navigation, groupName]);

  useEffect(() => {
    if (contactList.length > 0 && searchQuery) {
      setFilteredContacts(
        contactList.filter(contact => 
          contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (contact.phoneNumber && contact.phoneNumber.includes(searchQuery))
        )
      );
    } else {
      setFilteredContacts(contactList);
    }
  }, [searchQuery, contactList]);

  const fetchUserAndMembers = async () => {
    try {
      setLoading(true);
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }
      setUserId(user.id);
      
      // Get group data
      const { data: groupData, error: groupError } = await supabase
        .from('groups')
        .select('*')
        .eq('id', groupId)
        .single();
        
      if (groupError) throw groupError;
      
      console.log('Group data:', groupData);
      
      // Set group settings
      setGroupSettings({
        isPrivate: groupData.is_private !== false, // Default to true if null
        memberLimit: groupData.member_limit || 20 // Default to 20 if null
      });
      
      setTempSettings({
        isPrivate: groupData.is_private !== false,
        memberLimit: groupData.member_limit || 20
      });
      
      // Check if user is owner using group_members table with is_owner flag
      const { data: ownerData, error: ownerError } = await supabase
        .from('group_members')
        .select('is_owner')
        .eq('group_id', groupId)
        .eq('user_id', user.id)
        .single();
      
      console.log('Owner data:', ownerData);
      
      if (!ownerError) {
        setIsOwner(ownerData?.is_owner === true);
      }
      
      // Get members without using joins (since there's no foreign key relationship)
      const { data: memberData, error: memberError } = await supabase
        .from('group_members')
        .select('*')
        .eq('group_id', groupId);
        
      if (memberError) throw memberError;
      
      console.log('Member data:', memberData);
      
      // Get user data separately for each member
      const processedMembers = [];
      
      for (const member of memberData) {
        // Get user data
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('id, name, email')
          .eq('id', member.user_id)
          .single();
          
        // Get profile data if needed
        let profileData = null;
        if (!userError && userData) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('first_name, last_name, phone_number, profile_picture')
            .eq('user_id', member.user_id)
            .single();
            
          profileData = profile;
        }
        
        // Construct the member object
        processedMembers.push({
          id: member.id,
          userId: member.user_id,
          addedAt: member.added_at,
          isOwner: member.is_owner === true,
          name: userData?.name || 
            (profileData ? 
              `${profileData.first_name || ''} ${profileData.last_name || ''}`.trim() : 
              userData?.email || 'Unknown User'),
          email: userData?.email || '',
          phoneNumber: profileData?.phone_number || '',
          profilePicture: profileData?.profile_picture || null,
        });
      }
      
      setMembers(processedMembers);
    } catch (error) {
      console.error('Error fetching group details:', error);
      Alert.alert('Error', 'Could not load group details');
    } finally {
      setLoading(false);
    }
  };
  
  const loadContacts = async () => {
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status === 'granted') {
        const { data } = await Contacts.getContactsAsync({
          fields: [Contacts.Fields.Name, Contacts.Fields.PhoneNumbers],
        });
        
        if (data.length > 0) {
          const formattedContacts = data
            .filter(c => c.name && c.phoneNumbers && c.phoneNumbers.length > 0)
            .map(contact => ({
              id: contact.id,
              name: contact.name,
              phoneNumber: contact.phoneNumbers[0]?.number || '',
            }));
          
          setContactList(formattedContacts);
          setFilteredContacts(formattedContacts);
        }
      }
    } catch (error) {
      console.error('Error loading contacts:', error);
    }
  };

  const saveGroupSettings = async () => {
    try {
      const { error } = await supabase
        .from('groups')
        .update({
          is_private: tempSettings.isPrivate,
          member_limit: tempSettings.memberLimit
        })
        .eq('id', groupId);
        
      if (error) throw error;
      
      setGroupSettings({
        isPrivate: tempSettings.isPrivate,
        memberLimit: tempSettings.memberLimit
      });
      
      setShowSettingsModal(false);
      Alert.alert('Success', 'Group settings updated successfully');
    } catch (error) {
      console.error('Error updating group settings:', error);
      Alert.alert('Error', 'Could not update group settings');
    }
  };

  const addMemberToGroup = async (contact) => {
    try {
      // Check if the group is at capacity
      if (members.length >= groupSettings.memberLimit) {
        Alert.alert('Group Full', `This group has reached its member limit of ${groupSettings.memberLimit}`);
        return;
      }
      
      // First check if user exists in the system
      const { data: userData, error: userError } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('phone_number', contact.phoneNumber)
        .single();
      
      if (userError && userError.code !== 'PGRST116') {
        throw userError;
      }
      
      if (!userData) {
        // User not registered, send invitation
        Alert.alert(
          'User not registered',
          'This contact is not registered in the app. Would you like to send an invitation?',
          [
            {
              text: 'Cancel',
              style: 'cancel',
            },
            {
              text: 'Send Invitation',
              onPress: () => sendInvitation(contact),
            },
          ]
        );
        return;
      }
      
      // Check if user is already a member
      const { data: existingMember, error: memberCheckError } = await supabase
        .from('group_members')
        .select('id')
        .eq('group_id', groupId)
        .eq('user_id', userData.user_id);
        
      if (memberCheckError) throw memberCheckError;
      
      if (existingMember && existingMember.length > 0) {
        Alert.alert('Already a member', 'This user is already a member of this group');
        return;
      }
      
      // Add member to group
      const { error: addError } = await supabase
        .from('group_members')
        .insert({
          group_id: groupId,
          user_id: userData.user_id,
          added_by: userId,
          is_owner: false
        });
        
      if (addError) throw addError;
      
      Alert.alert('Success', 'Member added to group');
      fetchUserAndMembers();
      setAddMemberModalVisible(false);
    } catch (error) {
      console.error('Error adding member:', error);
      Alert.alert('Error', 'Could not add member to group');
    }
  };

  const sendInvitation = async (contact) => {
    try {
      // Check if invitation already exists
      const { data: existingInvitation, error: checkError } = await supabase
        .from('invitations')
        .select('id')
        .eq('phone_number', contact.phoneNumber)
        .eq('invited_by', userId);
        
      if (checkError) throw checkError;
      
      if (existingInvitation && existingInvitation.length > 0) {
        // Update existing invitation
        const { error: updateError } = await supabase
          .from('invitations')
          .update({ updated_at: new Date() })
          .eq('id', existingInvitation[0].id);
          
        if (updateError) throw updateError;
      } else {
        // Create new invitation
        const { error: inviteError } = await supabase
          .from('invitations')
          .insert({
            phone_number: contact.phoneNumber,
            name: contact.name,
            invited_by: userId,
            message: `Join my group "${groupName}" on FriendFinder!`,
            group_id: groupId
          });
          
        if (inviteError) throw inviteError;
      }
      
      Alert.alert('Invitation sent', `An invitation has been sent to ${contact.name}`);
    } catch (error) {
      console.error('Error sending invitation:', error);
      Alert.alert('Error', 'Could not send invitation');
    }
  };

  const removeMember = async (memberId, memberUserId) => {
    // Don't allow removing yourself if you're not the owner
    if (memberUserId === userId && !isOwner) {
      Alert.alert(
        'Leave Group',
        'Are you sure you want to leave this group?',
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Leave',
            style: 'destructive',
            onPress: async () => {
              try {
                const { error } = await supabase
                  .from('group_members')
                  .delete()
                  .eq('id', memberId);
                  
                if (error) throw error;
                
                Alert.alert('Success', 'You have left the group');
                navigation.goBack();
              } catch (error) {
                console.error('Error leaving group:', error);
                Alert.alert('Error', 'Could not leave the group');
              }
            },
          },
        ]
      );
      return;
    }
    
    // Only owner can remove other members
    if (!isOwner) {
      Alert.alert('Permission denied', 'Only the group owner can remove members');
      return;
    }
    
    Alert.alert(
      'Remove Member',
      'Are you sure you want to remove this member?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('group_members')
                .delete()
                .eq('id', memberId);
                
              if (error) throw error;
              
              setMembers(members.filter(m => m.id !== memberId));
              Alert.alert('Success', 'Member removed from group');
            } catch (error) {
              console.error('Error removing member:', error);
              Alert.alert('Error', 'Could not remove member');
            }
          },
        },
      ]
    );
  };

  const renderMemberItem = ({ item }) => (
    <View style={styles.memberItem}>
      <View style={styles.memberInfo}>
        <View style={styles.memberAvatar}>
          <Text style={styles.memberInitials}>
            {item.name.split(' ').map(n => n[0]).join('').toUpperCase()}
          </Text>
        </View>
        <View>
          <Text style={styles.memberName}>
            {item.name} {item.isOwner && <Text style={styles.ownerTag}>(Owner)</Text>}
          </Text>
          <Text style={styles.memberEmail}>{item.email || item.phoneNumber || 'No contact info'}</Text>
        </View>
      </View>
      <TouchableOpacity 
        style={styles.memberAction}
        onPress={() => removeMember(item.id, item.userId)}
      >
        {item.userId === userId ? (
          <Ionicons name="exit-outline" size={24} color={COLORS.danger} />
        ) : (
          <Ionicons name="close-circle-outline" size={24} color={COLORS.danger} />
        )}
      </TouchableOpacity>
    </View>
  );

  const renderContactItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.contactItem}
      onPress={() => addMemberToGroup(item)}
    >
      <View style={styles.contactAvatar}>
        <Text style={styles.contactInitials}>
          {item.name.split(' ').map(n => n[0]).join('').toUpperCase()}
        </Text>
      </View>
      <View style={styles.contactInfo}>
        <Text style={styles.contactName}>{item.name}</Text>
        <Text style={styles.contactPhone}>{item.phoneNumber}</Text>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }}>
      <View style={styles.container}>
        {/* Header with group info */}
        <View style={styles.groupInfoContainer}>
          <View style={styles.groupTitleContainer}>
            <Text style={styles.sectionTitle}>
              Group Members ({members.length}/{groupSettings.memberLimit})
            </Text>
            <View style={styles.privacyBadge}>
              <Ionicons 
                name={groupSettings.isPrivate ? "lock-closed" : "earth"} 
                size={14} 
                color={COLORS.white} 
              />
              <Text style={styles.privacyText}>
                {groupSettings.isPrivate ? "Private" : "Public"}
              </Text>
            </View>
          </View>
          
          {isOwner && (
            <TouchableOpacity 
              style={styles.settingsButton} 
              onPress={() => setShowSettingsModal(true)}
            >
              <Ionicons name="settings-outline" size={22} color={COLORS.primary} />
            </TouchableOpacity>
          )}
        </View>
        
        {/* Members list */}
        {members.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No members in this group yet</Text>
            <TouchableOpacity 
              style={styles.addMemberButton}
              onPress={() => setAddMemberModalVisible(true)}
            >
              <Text style={styles.addMemberButtonText}>Add Members</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={members}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderMemberItem}
            contentContainerStyle={styles.listContent}
            ListFooterComponent={() => (
              <TouchableOpacity 
                style={styles.addMemberButton}
                onPress={() => setAddMemberModalVisible(true)}
              >
                <Text style={styles.addMemberButtonText}>Add More Members</Text>
              </TouchableOpacity>
            )}
          />
        )}
      </View>
      
      {/* Add Member Modal */}
      <Modal
        visible={addMemberModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setAddMemberModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Members</Text>
              <TouchableOpacity onPress={() => setAddMemberModalVisible(false)}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            
            <TextInput
              style={styles.searchInput}
              placeholder="Search contacts..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor={COLORS.textLight}
            />
            
            <FlatList
              data={filteredContacts}
              keyExtractor={(item) => item.id.toString()}
              renderItem={renderContactItem}
              contentContainerStyle={styles.contactListContent}
              ListEmptyComponent={
                <Text style={styles.emptyText}>No contacts found</Text>
              }
            />
          </View>
        </View>
      </Modal>
      
      {/* Group Settings Modal */}
      <Modal
        visible={showSettingsModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowSettingsModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Group Settings</Text>
              <TouchableOpacity onPress={() => setShowSettingsModal(false)}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            
            <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
              <View style={styles.settingItem}>
                <Text style={styles.settingLabel}>Privacy:</Text>
                <View style={styles.settingControl}>
                  <Text style={tempSettings.isPrivate ? styles.activeLabel : styles.inactiveLabel}>
                    Private
                  </Text>
                  <Switch
                    value={tempSettings.isPrivate}
                    onValueChange={(value) => setTempSettings({...tempSettings, isPrivate: value})}
                    trackColor={{ false: COLORS.border, true: COLORS.primary }}
                    thumbColor={COLORS.white}
                  />
                </View>
              </View>
              
              <View style={styles.settingItem}>
                <Text style={styles.settingLabel}>Member Limit:</Text>
                <View style={styles.memberLimitControl}>
                  <TextInput
                    style={styles.memberLimitInput}
                    value={tempSettings.memberLimit.toString()}
                    onChangeText={(value) => {
                      const numberValue = parseInt(value);
                      if (!isNaN(numberValue) && numberValue > 0) {
                        setTempSettings({...tempSettings, memberLimit: numberValue});
                      } else if (value === '') {
                        setTempSettings({...tempSettings, memberLimit: ''});
                      }
                    }}
                    keyboardType="number-pad"
                    maxLength={3}
                  />
                  <Text style={styles.memberLimitLabel}>members</Text>
                </View>
              </View>
              
              <Text style={styles.settingInfo}>
                {tempSettings.isPrivate 
                  ? "Private groups are invite-only. Only members can see the group and its events."
                  : "Public groups allow anyone to join. Group events will be visible to everyone."}
              </Text>
              
              <TouchableOpacity 
                style={styles.saveButton}
                onPress={saveGroupSettings}
              >
                <Text style={styles.saveButtonText}>Save Settings</Text>
              </TouchableOpacity>
            </ScrollView>
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
    padding: SPACING.medium,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerButton: {
    marginRight: SPACING.medium,
    padding: 5,
  },
  groupInfoContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.medium,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  groupTitleContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: FONT_SIZES.medium,
    fontWeight: 'bold',
    color: COLORS.text,
    marginRight: 10,
  },
  privacyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  privacyText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.small,
    marginLeft: 4,
    fontWeight: '600',
  },
  settingsButton: {
    padding: 8,
    backgroundColor: COLORS.background,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  listContent: {
    paddingBottom: SPACING.large,
  },
  memberItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.cardBackground,
    borderRadius: 8,
    padding: SPACING.medium,
    marginBottom: SPACING.small,
  },
  memberInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.small,
  },
  memberInitials: {
    color: COLORS.white,
    fontWeight: 'bold',
  },
  memberName: {
    fontSize: FONT_SIZES.medium,
    fontWeight: '500',
    color: COLORS.text,
  },
  ownerTag: {
    fontSize: FONT_SIZES.small,
    color: COLORS.primary,
    fontWeight: '600',
  },
  memberEmail: {
    fontSize: FONT_SIZES.small,
    color: COLORS.textLight,
  },
  memberAction: {
    padding: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 30,
  },
  emptyText: {
    textAlign: 'center',
    color: COLORS.textLight,
    marginBottom: SPACING.medium,
  },
  addMemberButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginTop: SPACING.medium,
    alignSelf: 'center',
    minWidth: 150,
    alignItems: 'center',
  },
  addMemberButtonText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.medium,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: SPACING.medium,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.medium,
    paddingVertical: 5,
  },
  modalTitle: {
    fontSize: FONT_SIZES.large,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  searchInput: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: 8,
    padding: SPACING.small,
    marginBottom: SPACING.medium,
    color: COLORS.text,
  },
  contactListContent: {
    paddingBottom: SPACING.large,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.small,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  contactAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.small,
  },
  contactInitials: {
    color: COLORS.white,
    fontWeight: 'bold',
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: FONT_SIZES.medium,
    color: COLORS.text,
  },
  contactPhone: {
    fontSize: FONT_SIZES.small,
    color: COLORS.textLight,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.medium,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  settingLabel: {
    fontSize: FONT_SIZES.medium,
    color: COLORS.text,
    fontWeight: '500',
  },
  settingControl: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  activeLabel: {
    color: COLORS.primary,
    marginRight: 10,
  },
  inactiveLabel: {
    color: COLORS.textLight,
    marginRight: 10,
  },
  memberLimitControl: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  memberLimitInput: {
    backgroundColor: COLORS.cardBackground,
    padding: 8,
    borderRadius: 6,
    width: 60,
    textAlign: 'center',
    color: COLORS.text,
    marginRight: 8,
  },
  memberLimitLabel: {
    fontSize: FONT_SIZES.small,
    color: COLORS.textLight,
  },
  settingInfo: {
    fontSize: FONT_SIZES.small,
    color: COLORS.textLight,
    marginTop: SPACING.medium,
    marginBottom: SPACING.large,
    lineHeight: 18,
  },
  saveButton: {
    backgroundColor: COLORS.primary,
    padding: SPACING.medium,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 20,
  },
  saveButtonText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.medium,
    fontWeight: '600',
  }
});

export default GroupDetailScreen; 