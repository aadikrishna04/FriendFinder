import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  SafeAreaView, 
  KeyboardAvoidingView, 
  Platform,
  Alert 
} from 'react-native';
import { signUp } from '../services/authService';

const FriendAvatars = () => {
  return (
    <View style={styles.avatarsContainer}>
      <View style={[styles.centerAvatar, { backgroundColor: '#6366F1' }]}>
        <Text style={styles.emojiText}>👩</Text>
      </View>
      
      <View style={[styles.avatar, styles.avatar1, { backgroundColor: '#F59E0B' }]}>
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
    </View>
  );
};

const SignUpScreen = ({ navigation }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignUp = async () => {
    if (!name || !email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    try {
      setLoading(true);
      await signUp(email, password, name);
      
      // Instead of directly navigating to HomeScreen, 
      // inform the parent navigator by setting auth state
      // This is handled in App.tsx with the onAuthStateChange listener
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Sign Up</Text>
        </View>
        
        <View style={styles.avatarSection}>
          <FriendAvatars />
        </View>
        
        <View style={styles.formContainer}>
          <TextInput
            style={styles.input}
            placeholder="Name"
            placeholderTextColor="#A0A0A0"
            value={name}
            onChangeText={setName}
          />
          
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#A0A0A0"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#A0A0A0"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
          
          <TouchableOpacity 
            style={styles.signUpButton}
            onPress={handleSignUp}
            disabled={loading}
          >
            <Text style={styles.signUpButtonText}>
              {loading ? 'Creating account...' : 'Sign Up'}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.signInLink}
            onPress={() => navigation.navigate('SignIn')}
          >
            <Text style={styles.signInLinkText}>Have an account? Sign in!</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 60,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  avatarSection: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  avatarsContainer: {
    width: 250,
    height: 150,
    position: 'relative',
  },
  centerAvatar: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    top: '50%',
    left: '50%',
    marginLeft: -50,
    marginTop: -50,
    zIndex: 10,
  },
  avatar: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatar1: { top: 0, left: 40 },
  avatar2: { top: 0, right: 40 },
  avatar3: { bottom: 0, left: 40 },
  avatar4: { bottom: 0, right: 40 },
  emojiText: {
    fontSize: 24,
  },
  formContainer: {
    paddingHorizontal: 20,
    marginTop: 20,
  },
  input: {
    height: 54,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 10,
    marginBottom: 15,
    paddingHorizontal: 15,
    fontSize: 16,
  },
  signUpButton: {
    backgroundColor: '#8B5CF6',
    height: 54,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  signUpButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  signInLink: {
    marginTop: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 10,
  },
  signInLinkText: {
    fontSize: 16,
    color: '#8B5CF6',
    fontWeight: '600',
  },
});

export default SignUpScreen; 