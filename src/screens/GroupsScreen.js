import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
  Modal
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { supabase } from '../services/supabaseClient';
import { COLORS, SPACING, FONT_SIZES } from '../constants';

const GroupsScreen = ({ navigation }) => {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [createGroupModalVisible, setCreateGroupModalVisible] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredGroups, setFilteredGroups] = useState([]);

  useEffect(() => {
    fetchUserAndGroups();
  }, []);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredGroups(groups);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = groups.filter(group => 
        group.name.toLowerCase().includes(query)
      );
      setFilteredGroups(filtered);
    }
  }, [searchQuery, groups]);

  const fetchUserAndGroups = async () => {
    try {
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      setUser(user);
      
      await fetchGroups(user.id);
    } catch (error) {
      console.error('Error fetching user:', error);
      Alert.alert('Error', 'Failed to load user data');
      setLoading(false);
    }
  };

  const fetchGroups = async (userId) => {
    setLoading(true);
    try {
      // First fetch groups the user hosts (without the problematic join)
      const { data: hostedGroups, error: hostedError } = await supabase
        .from('groups')
        .select('id, name, created_at, description, host_id')
        .eq('host_id', userId);
        
      if (hostedError) throw hostedError;
      
      // Then fetch group IDs the user is a member of
      const { data: membershipData, error: membershipError } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('user_id', userId);
        
      if (membershipError) throw membershipError;
      
      // Extract the group IDs the user is a member of
      const memberGroupIds = membershipData.map(item => item.group_id);
      
      // If there are any member groups, fetch their details
      let memberGroups = [];
      if (memberGroupIds.length > 0) {
        const { data: groupsData, error: groupsError } = await supabase
          .from('groups')
          .select('id, name, created_at, description, host_id')
          .in('id', memberGroupIds)
          .neq('host_id', userId); // Avoid duplicates from hostedGroups
          
        if (groupsError) throw groupsError;
        memberGroups = groupsData || [];
      }
      
      // Combine hosted and member groups
      const allGroups = [...(hostedGroups || []), ...memberGroups];
      
      // Fetch member counts for each group
      const groupsWithCounts = await Promise.all(allGroups.map(async (group) => {
        const { count, error: countError } = await supabase
          .from('group_members')
          .select('*', { count: 'exact', head: true })
          .eq('group_id', group.id);
          
        if (countError) throw countError;
        
        return {
          ...group,
          isHost: group.host_id === userId,
          memberCount: count || 0
        };
      }));
      
      // Sort by most recent first
      const sortedGroups = groupsWithCounts.sort((a, b) => 
        new Date(b.created_at) - new Date(a.created_at)
      );
      
      setGroups(sortedGroups);
      setFilteredGroups(sortedGroups);
    } catch (error) {
      console.error('Error fetching groups:', error);
      Alert.alert('Error', 'Failed to load groups');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) {
      Alert.alert('Error', 'Please enter a group name');
      return;
    }
    
    setCreatingGroup(true);
    try {
      // Create a new group
      const { data: group, error: groupError } = await supabase
        .from('groups')
        .insert({
          name: newGroupName.trim(),
          host_id: user.id,
          description: ''
        })
        .select()
        .single();
        
      if (groupError) throw groupError;
      
      // Add the creator as a member
      const { error: memberError } = await supabase
        .from('group_members')
        .insert({
          group_id: group.id,
          user_id: user.id
        });
        
      if (memberError) throw memberError;
      
      // Clear the form and close the modal
      setNewGroupName('');
      setCreateGroupModalVisible(false);
      
      // Refresh the groups list
      await fetchGroups(user.id);
      
      // Navigate to the group detail screen for adding members
      navigation.navigate('GroupDetail', { groupId: group.id });
    } catch (error) {
      console.error('Error creating group:', error);
      Alert.alert('Error', 'Failed to create group');
    } finally {
      setCreatingGroup(false);
    }
  };

  const handleDeleteGroup = async (groupId) => {
    Alert.alert(
      'Delete Group',
      'Are you sure you want to delete this group? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // Delete the group (cascade delete will handle members)
              const { error } = await supabase
                .from('groups')
                .delete()
                .eq('id', groupId)
                .eq('host_id', user.id);
                
              if (error) throw error;
              
              // Update the local state
              const updatedGroups = groups.filter(group => group.id !== groupId);
              setGroups(updatedGroups);
              setFilteredGroups(updatedGroups.filter(group => 
                group.name.toLowerCase().includes(searchQuery.toLowerCase())
              ));
            } catch (error) {
              console.error('Error deleting group:', error);
              Alert.alert('Error', 'Failed to delete group');
            }
          }
        }
      ]
    );
  };

  const handleLeaveGroup = async (groupId) => {
    Alert.alert(
      'Leave Group',
      'Are you sure you want to leave this group?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            try {
              // Remove the user from the group
              const { error } = await supabase
                .from('group_members')
                .delete()
                .eq('group_id', groupId)
                .eq('user_id', user.id);
                
              if (error) throw error;
              
              // Update the local state
              const updatedGroups = groups.filter(group => group.id !== groupId);
              setGroups(updatedGroups);
              setFilteredGroups(updatedGroups.filter(group => 
                group.name.toLowerCase().includes(searchQuery.toLowerCase())
              ));
            } catch (error) {
              console.error('Error leaving group:', error);
              Alert.alert('Error', 'Failed to leave group');
            }
          }
        }
      ]
    );
  };

  const renderGroupItem = ({ item }) => {
    return (
      <TouchableOpacity
        style={styles.groupCard}
        onPress={() => navigation.navigate('GroupDetail', { groupId: item.id })}
      >
        <View style={styles.groupInfo}>
          <Text style={styles.groupName}>{item.name}</Text>
          <Text style={styles.groupMeta}>
            {item.memberCount} {item.memberCount === 1 ? 'member' : 'members'} • 
            {item.isHost ? ' You are host' : ' Member'}
          </Text>
        </View>
        
        <View style={styles.groupActions}>
          {item.isHost ? (
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => handleDeleteGroup(item.id)}
            >
              <MaterialIcons name="delete" size={22} color={COLORS.error || '#F44336'} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.leaveButton}
              onPress={() => handleLeaveGroup(item.id)}
            >
              <MaterialIcons name="exit-to-app" size={22} color={COLORS.warning || '#FF9800'} />
            </TouchableOpacity>
          )}
          <MaterialIcons name="chevron-right" size={24} color={COLORS.textLight} />
        </View>
      </TouchableOpacity>
    );
  };

  const renderCreateGroupModal = () => {
    return (
      <Modal
        animationType="slide"
        transparent={true}
        visible={createGroupModalVisible}
        onRequestClose={() => setCreateGroupModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create New Group</Text>
              <TouchableOpacity
                onPress={() => setCreateGroupModalVisible(false)}
              >
                <MaterialIcons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.modalBody}>
              <Text style={styles.inputLabel}>Group Name</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter group name"
                value={newGroupName}
                onChangeText={setNewGroupName}
                autoFocus
              />
              
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[
                    styles.createButton,
                    (!newGroupName.trim() || creatingGroup) && styles.disabledButton
                  ]}
                  onPress={handleCreateGroup}
                  disabled={!newGroupName.trim() || creatingGroup}
                >
                  {creatingGroup ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.createButtonText}>Create Group</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
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
        <Text style={styles.headerTitle}>My Groups</Text>
        <TouchableOpacity
          style={styles.createGroupButton}
          onPress={() => setCreateGroupModalVisible(true)}
        >
          <MaterialIcons name="add" size={24} color={COLORS.primary} />
        </TouchableOpacity>
      </View>
      
      <View style={styles.searchContainer}>
        <MaterialIcons name="search" size={24} color={COLORS.textSecondary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search groups..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          clearButtonMode="while-editing"
        />
      </View>
      
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading groups...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredGroups}
          renderItem={renderGroupItem}
          keyExtractor={item => item.id.toString()}
          contentContainerStyle={styles.groupsList}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialIcons name="group" size={64} color={COLORS.textLight} />
              <Text style={styles.emptyTitle}>No Groups Found</Text>
              <Text style={styles.emptySubtitle}>
                {searchQuery.trim() !== '' 
                  ? 'Try a different search term'
                  : 'Create a group to organize your contacts'}
              </Text>
              {searchQuery.trim() === '' && (
                <TouchableOpacity
                  style={styles.emptyCreateButton}
                  onPress={() => setCreateGroupModalVisible(true)}
                >
                  <Text style={styles.emptyCreateButtonText}>Create Group</Text>
                </TouchableOpacity>
              )}
            </View>
          }
        />
      )}
      
      {renderCreateGroupModal()}
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
  createGroupButton: {
    padding: SPACING.xs,
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
  groupsList: {
    flexGrow: 1,
    padding: SPACING.sm,
  },
  groupCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
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
  groupInfo: {
    flex: 1,
  },
  groupName: {
    fontSize: FONT_SIZES.md,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 4,
  },
  groupMeta: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  groupActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deleteButton: {
    padding: SPACING.xs,
    marginRight: SPACING.xs,
  },
  leaveButton: {
    padding: SPACING.xs,
    marginRight: SPACING.xs,
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
  emptyCreateButton: {
    marginTop: SPACING.lg,
    backgroundColor: COLORS.primary,
    padding: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: 8,
  },
  emptyCreateButtonText: {
    color: '#FFFFFF',
    fontSize: FONT_SIZES.md,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    width: '85%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    padding: SPACING.md,
  },
  modalTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  modalBody: {
    padding: SPACING.lg,
  },
  inputLabel: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: SPACING.md,
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: SPACING.md,
  },
  createButton: {
    backgroundColor: COLORS.primary,
    padding: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: 8,
    alignItems: 'center',
    width: '100%',
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: FONT_SIZES.md,
    fontWeight: 'bold',
  },
  disabledButton: {
    backgroundColor: COLORS.border,
  },
});

export default GroupsScreen; 