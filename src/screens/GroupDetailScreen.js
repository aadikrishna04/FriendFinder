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
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import * as Contacts from 'expo-contacts';
import { supabase } from '../services/supabaseClient';
import { COLORS, SPACING, FONT_SIZES } from '../constants';

const GroupDetailScreen = ({ route, navigation }) => {
  const { groupId, groupName } = route.params;
  const [members, setMembers] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [userId, setUserId] = useState(null);
  const [isOwner, setIsOwner] = useState(false);
  const [addMemberModalVisible, setAddMemberModalVisible] = useState(false);
  const [appContacts, setAppContacts] = useState([]);
  const [selectedContacts, setSelectedContacts] = useState([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
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
  const [activeTab, setActiveTab] = useState('members');

  useEffect(() => {
    navigation.setOptions({
      title: groupName || 'Group Details',
      headerRight: () => (
        <View style={{ flexDirection: 'row' }}>
          <TouchableOpacity 
            style={styles.headerButton} 
            onPress={() => {
              setSelectedContacts([]);
              setAddMemberModalVisible(true);
              loadAppContacts();
            }}
          >
            <Ionicons name="person-add" size={24} color={COLORS.primary} />
          </TouchableOpacity>
        </View>
      ),
    });

    fetchUserAndMembers();
    fetchGroupEvents();
  }, [groupId, navigation, groupName]);

  useEffect(() => {
    if (appContacts.length > 0 && searchQuery) {
      setFilteredContacts(
        appContacts.filter(contact => 
          contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (contact.email && contact.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
          (contact.phone_number && contact.phone_number.includes(searchQuery))
        )
      );
    } else {
      setFilteredContacts(appContacts);
    }
  }, [searchQuery, appContacts]);

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
  
  const fetchGroupEvents = async () => {
    try {
      setLoadingEvents(true);
      
      // Fetch events that this group is invited to
      const { data: eventGroupData, error: eventGroupError } = await supabase
        .from('event_groups')
        .select('event_id, created_at')
        .eq('group_id', groupId);
        
      if (eventGroupError) throw eventGroupError;
      
      if (eventGroupData && eventGroupData.length > 0) {
        // Extract event IDs
        const eventIds = eventGroupData.map(eg => eg.event_id);
        
        // Fetch the event details
        const { data: eventsData, error: eventsError } = await supabase
          .from('events')
          .select('*, users:host_id(name, email)')
          .in('id', eventIds)
          .order('start_time', { ascending: true });
          
        if (eventsError) throw eventsError;
        
        // Process events with date formatting
        const processedEvents = eventsData.map(event => ({
          ...event,
          formattedDate: new Date(event.start_time).toLocaleDateString(),
          formattedTime: new Date(event.start_time).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
          }),
          host: event.users?.name || event.users?.email?.split('@')[0] || 'Unknown Host'
        }));
        
        setEvents(processedEvents);
      } else {
        setEvents([]);
      }
    } catch (error) {
      console.error('Error fetching group events:', error);
      Alert.alert('Error', 'Could not load group events');
    } finally {
      setLoadingEvents(false);
    }
  };
  
  const loadAppContacts = async () => {
    try {
      setLoadingContacts(true);
      
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      
      // Get user's contacts from the contacts table (app users only)
      const { data: contactsData, error: contactsError } = await supabase
        .from('contacts')
        .select(`
          id, 
          contact_id,
          name, 
          email, 
          phone_number,
          users:contact_id(id, name, email, phone_number)
        `)
        .eq('owner_id', user.id);
        
      if (contactsError) throw contactsError;
      
      // Filter out any contacts that are already members of the group
      const existingMemberIds = members.map(m => m.userId);
      
      const filteredAppContacts = contactsData.filter(
        contact => !existingMemberIds.includes(contact.contact_id)
      );
      
      setAppContacts(filteredAppContacts);
      setFilteredContacts(filteredAppContacts);
    } catch (error) {
      console.error('Error loading app contacts:', error);
      Alert.alert('Error', 'Could not load contacts');
    } finally {
      setLoadingContacts(false);
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

  const addSelectedMembersToGroup = async () => {
    if (selectedContacts.length === 0) {
      setAddMemberModalVisible(false);
      return;
    }
    
    try {
      // Check if the group is at capacity
      if (members.length + selectedContacts.length > groupSettings.memberLimit) {
        Alert.alert(
          'Group Limit', 
          `You can only add ${groupSettings.memberLimit - members.length} more members to this group`
        );
        return;
      }
      
      // Prepare the group member records
      const newMembers = selectedContacts.map(contact => ({
        group_id: groupId,
        user_id: contact.contact_id,
        added_by: userId,
        is_owner: false
      }));
      
      // Insert all selected members
      const { error } = await supabase
        .from('group_members')
        .insert(newMembers);
        
      if (error) throw error;
      
      Alert.alert('Success', `Added ${selectedContacts.length} members to the group`);
      fetchUserAndMembers();
      setAddMemberModalVisible(false);
    } catch (error) {
      console.error('Error adding members:', error);
      Alert.alert('Error', 'Could not add members to group');
    }
  };

  const toggleContactSelection = (contact) => {
    setSelectedContacts(prevSelected => {
      const isSelected = prevSelected.some(c => c.id === contact.id);
      
      if (isSelected) {
        return prevSelected.filter(c => c.id !== contact.id);
      } else {
        return [...prevSelected, contact];
      }
    });
  };

  const sendInvitation = async (contact) => {
    try {
      // Check if invitation already exists
      const { data: existingInvitation, error: checkError } = await supabase
        .from('invitations')
        .select('id')
        .eq('phone_number', contact.phone_number)
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
            phone_number: contact.phone_number,
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

  const renderContactItem = ({ item }) => {
    const isSelected = selectedContacts.some(c => c.id === item.id);
    
    return (
      <TouchableOpacity 
        style={[styles.contactItem, isSelected && styles.selectedContactItem]}
        onPress={() => toggleContactSelection(item)}
      >
        <View style={styles.contactAvatar}>
          <Text style={styles.contactInitials}>
            {item.name.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.contactInfo}>
          <Text style={styles.contactName}>{item.name}</Text>
          <Text style={styles.contactPhone}>{item.email || item.phone_number || 'No contact info'}</Text>
        </View>
        <View style={styles.checkboxContainer}>
          {isSelected ? (
            <MaterialIcons name="check-circle" size={24} color={COLORS.primary} />
          ) : (
            <View style={styles.emptyCheckbox} />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderEventItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.eventItem}
      onPress={() => navigation.navigate('EventDetails', { eventId: item.id })}
    >
      <View style={styles.eventInfo}>
        <Text style={styles.eventName}>{item.title || 'Untitled Event'}</Text>
        <View style={styles.eventMetaRow}>
          <Ionicons name="calendar" size={14} color={COLORS.textLight} style={styles.eventIcon} />
          <Text style={styles.eventMeta}>{item.formattedDate}</Text>
        </View>
        <View style={styles.eventMetaRow}>
          <Ionicons name="time" size={14} color={COLORS.textLight} style={styles.eventIcon} />
          <Text style={styles.eventMeta}>{item.formattedTime}</Text>
        </View>
        <View style={styles.eventMetaRow}>
          <Ionicons name="person" size={14} color={COLORS.textLight} style={styles.eventIcon} />
          <Text style={styles.eventMeta}>By {item.host}</Text>
        </View>
      </View>
      
      <View style={styles.eventActions}>
        <Ionicons name="chevron-forward" size={24} color={COLORS.textLight} />
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
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background, marginHorizontal: 8 }}>
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
        
        {/* Spacing between group info and tabs */}
        <View style={{ height: 12 }} />
        
        {/* Tabs for Members and Events */}
        <View style={styles.tabContainer}>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'members' && styles.activeTab]}
            onPress={() => setActiveTab('members')}
          >
            <Text style={[styles.tabText, activeTab === 'members' && styles.activeTabText]}>
              Members
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'events' && styles.activeTab]}
            onPress={() => setActiveTab('events')}
          >
            <Text style={[styles.tabText, activeTab === 'events' && styles.activeTabText]}>
              Events
            </Text>
          </TouchableOpacity>
        </View>
        
        {/* Content based on active tab */}
        {activeTab === 'members' ? (
          // Members list
          members.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No members in this group yet</Text>
              <TouchableOpacity 
                style={styles.addMemberButton}
                onPress={() => {
                  setSelectedContacts([]);
                  setAddMemberModalVisible(true);
                  loadAppContacts();
                }}
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
              ListHeaderComponent={() => <View style={{ height: 12 }} />}
              ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
              ListFooterComponent={() => (
                <View style={{ paddingTop: 30 }}>
                  <TouchableOpacity 
                    style={styles.addMemberButton}
                    onPress={() => {
                      setSelectedContacts([]);
                      setAddMemberModalVisible(true);
                      loadAppContacts();
                    }}
                  >
                    <Text style={styles.addMemberButtonText}>Add More Members</Text>
                  </TouchableOpacity>
                </View>
              )}
            />
          )
        ) : (
          // Events list
          loadingEvents ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={COLORS.primary} />
              <Text style={styles.loadingText}>Loading events...</Text>
            </View>
          ) : events.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No events for this group</Text>
              <Text style={styles.emptySubText}>
                When someone invites this group to an event, it will appear here.
              </Text>
            </View>
          ) : (
            <FlatList
              data={events}
              keyExtractor={(item) => item.id.toString()}
              renderItem={renderEventItem}
              contentContainerStyle={styles.listContent}
            />
          )
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
            
            {loadingContacts ? (
              <View style={styles.loadingContactsContainer}>
                <ActivityIndicator size="large" color={COLORS.primary} />
                <Text style={styles.loadingText}>Loading contacts...</Text>
              </View>
            ) : (
              <>
                <FlatList
                  data={filteredContacts}
                  keyExtractor={(item) => item.id.toString()}
                  renderItem={renderContactItem}
                  contentContainerStyle={styles.contactListContent}
                  ListEmptyComponent={
                    <Text style={styles.emptyText}>
                      {appContacts.length === 0 
                        ? "No app contacts found. Add contacts in your profile first." 
                        : "No contacts match your search."}
                    </Text>
                  }
                />
                
                <View style={styles.modalFooter}>
                  <TouchableOpacity 
                    style={[
                      styles.addSelectedButton,
                      selectedContacts.length === 0 && styles.disabledButton
                    ]}
                    disabled={selectedContacts.length === 0}
                    onPress={addSelectedMembersToGroup}
                  >
                    <Text style={styles.addSelectedButtonText}>
                      Add Selected ({selectedContacts.length})
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
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
    paddingHorizontal: SPACING.large,
    paddingVertical: SPACING.medium,
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
    marginBottom: SPACING.small,
    paddingBottom: 8,
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
    paddingVertical: 5,
    borderRadius: 12,
    marginLeft: 8,
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
    borderRadius: 12,
    padding: SPACING.medium,
    marginHorizontal: 4,
    marginBottom: 8,
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
    marginRight: SPACING.medium + 6,
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
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginTop: SPACING.medium,
    marginHorizontal: SPACING.medium,
    alignSelf: 'center',
    minWidth: 180,
    alignItems: 'center',
    marginBottom: SPACING.medium + 6,
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
    padding: SPACING.large,
    paddingHorizontal: SPACING.large + 6,
    maxHeight: '80%',
    marginHorizontal: 8,
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
  },
  selectedContactItem: {
    backgroundColor: `${COLORS.primary}20`, // 20% opacity of primary color
  },
  checkboxContainer: {
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyCheckbox: {
    width: 22,
    height: 22,
    borderWidth: 2,
    borderColor: COLORS.primary,
    borderRadius: 12,
  },
  modalFooter: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 10,
    marginTop: 10,
    paddingBottom: 20,
  },
  addSelectedButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addSelectedButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: FONT_SIZES.medium,
  },
  disabledButton: {
    opacity: 0.5,
  },
  loadingContactsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    color: COLORS.textLight,
  },
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.white,
    marginHorizontal: 10,
    borderRadius: 8,
    marginBottom: SPACING.small,
  },
  tab: {
    flex: 1,
    paddingVertical: SPACING.medium,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: COLORS.primary,
  },
  tabText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '500',
    color: COLORS.textLight,
  },
  activeTabText: {
    color: COLORS.primary,
    fontWeight: 'bold',
  },
  eventItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.cardBackground,
    borderRadius: 8,
    padding: SPACING.medium,
    marginBottom: SPACING.small,
  },
  eventInfo: {
    flex: 1,
  },
  eventName: {
    fontSize: FONT_SIZES.medium,
    fontWeight: '500',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  eventMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  eventIcon: {
    marginRight: 4,
  },
  eventMeta: {
    fontSize: FONT_SIZES.small,
    color: COLORS.textLight,
  },
  eventActions: {
    padding: 4,
  },
  emptySubText: {
    color: COLORS.textLight,
    textAlign: 'center',
    marginTop: SPACING.xs,
    fontSize: FONT_SIZES.small,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: SPACING.sm,
    color: COLORS.textLight,
  },
});

export default GroupDetailScreen; 