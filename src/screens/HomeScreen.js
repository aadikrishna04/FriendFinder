import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import { signOut } from '../services/authService';

const HomeScreen = ({ navigation }) => {
  const handleSignOut = async () => {
    try {
      await signOut();
      // No need to navigate - the auth state listener in App.tsx will handle this
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>FriendBook</Text>
      </View>
      
      <View style={styles.content}>
        <Text style={styles.welcomeText}>Welcome to FriendBook!</Text>
        <Text style={styles.infoText}>
          This is the home screen of your app. Here you'll be able to:
        </Text>
        <View style={styles.featureList}>
          <Text style={styles.featureItem}>• See your friends on a map</Text>
          <Text style={styles.featureItem}>• View your friends' availability</Text>
          <Text style={styles.featureItem}>• Send meeting requests</Text>
          <Text style={styles.featureItem}>• Manage your calendar</Text>
        </View>
      </View>
      
      <View style={styles.footer}>
        <TouchableOpacity 
          style={styles.signOutButton}
          onPress={handleSignOut}
        >
          <Text style={styles.signOutButtonText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  infoText: {
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'center',
  },
  featureList: {
    alignSelf: 'center',
    marginTop: 10,
  },
  featureItem: {
    fontSize: 16,
    marginBottom: 10,
  },
  footer: {
    padding: 20,
  },
  signOutButton: {
    backgroundColor: '#8B5CF6',
    height: 54,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  signOutButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
});

export default HomeScreen; 