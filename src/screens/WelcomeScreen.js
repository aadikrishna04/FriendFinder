import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, SafeAreaView } from 'react-native';

const FriendAvatars = () => {
  // This component will display the animated friend avatars
  return (
    <View style={styles.avatarsContainer}>
      {/* Center avatar (larger) */}
      <View style={[styles.centerAvatar, { backgroundColor: '#6366F1' }]}>
        <Text style={styles.emojiText}>😄✌️</Text>
      </View>
      
      {/* Surrounding avatars */}
      <View style={[styles.avatar, styles.avatar1, { backgroundColor: '#F87171' }]}>
        <Text style={styles.emojiText}>👩</Text>
      </View>
      <View style={[styles.avatar, styles.avatar2, { backgroundColor: '#34D399' }]}>
        <Text style={styles.emojiText}>🧔</Text>
      </View>
      <View style={[styles.avatar, styles.avatar3, { backgroundColor: '#F59E0B' }]}>
        <Text style={styles.emojiText}>👨‍🦲</Text>
      </View>
      <View style={[styles.avatar, styles.avatar4, { backgroundColor: '#EC4899' }]}>
        <Text style={styles.emojiText}>👩‍🦱</Text>
      </View>
      <View style={[styles.avatar, styles.avatar5, { backgroundColor: '#8B5CF6' }]}>
        <Text style={styles.emojiText}>👧</Text>
      </View>
      <View style={[styles.avatar, styles.avatar6, { backgroundColor: '#EF4444' }]}>
        <Text style={styles.emojiText}>👨‍🦰</Text>
      </View>
    </View>
  );
};

const WelcomeScreen = ({ navigation }) => {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>FriendBook</Text>
      </View>
      
      <View style={styles.content}>
        <FriendAvatars />
      </View>
      
      <View style={styles.footer}>
        <TouchableOpacity 
          style={styles.primaryButton}
          onPress={() => navigation.navigate('SignUp')}
        >
          <Text style={styles.primaryButtonText}>Create an account</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.secondaryButton}
          onPress={() => navigation.navigate('SignIn')}
        >
          <Text style={styles.secondaryButtonText}>Sign in</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    alignItems: 'center',
    paddingTop: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarsContainer: {
    width: 300,
    height: 300,
    position: 'relative',
  },
  centerAvatar: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    top: '50%',
    left: '50%',
    marginLeft: -60,
    marginTop: -60,
    zIndex: 10,
  },
  avatar: {
    position: 'absolute',
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatar1: { top: 20, left: 20 },
  avatar2: { top: 20, right: 20 },
  avatar3: { top: '50%', left: 0, marginTop: -35 },
  avatar4: { top: '50%', right: 0, marginTop: -35 },
  avatar5: { bottom: 20, left: 40 },
  avatar6: { bottom: 20, right: 40 },
  emojiText: {
    fontSize: 30,
  },
  footer: {
    padding: 20,
    marginBottom: 20,
  },
  primaryButton: {
    backgroundColor: '#8B5CF6',
    borderRadius: 25,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 25,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  secondaryButtonText: {
    color: '#000000',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 10,
  },
});

export default WelcomeScreen; 