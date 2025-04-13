import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Alert, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';

const OnbResume = () => {
  const navigation = useNavigation();
  const [resumeUri, setResumeUri] = useState(null);
  const [resumeName, setResumeName] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const pickResume = async () => {
    try {
      setIsLoading(true);
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
        copyToCacheDirectory: true,
      });

      if (result.type === 'success') {
        // Check if file size is less than 5MB
        const fileInfo = await FileSystem.getInfoAsync(result.uri);
        if (fileInfo.size > 5 * 1024 * 1024) {
          Alert.alert('File too large', 'Please select a file smaller than 5MB');
          setIsLoading(false);
          return;
        }

        setResumeUri(result.uri);
        setResumeName(result.name);
      }
      setIsLoading(false);
    } catch (error) {
      console.error('Error picking document:', error);
      Alert.alert('Error', 'Failed to pick document');
      setIsLoading(false);
    }
  };

  const handleCreateAccount = () => {
    if (!resumeUri) {
      Alert.alert('Resume Required', 'Please upload your resume before continuing');
      return;
    }
    
    // Save resume information to state or context if needed
    // Then navigate to the next screen
    navigation.navigate('OnbTags');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Upload Your Resume</Text>
      <Text style={styles.subtitle}>Share your resume to help us match you with relevant opportunities</Text>
      
      <View style={styles.resumePreviewContainer}>
        {isLoading ? (
          <ActivityIndicator size="large" color="#4A90E2" />
        ) : resumeUri ? (
          <View style={styles.resumePreview}>
            <Image 
              source={require('../assets/document-icon.png')} 
              style={styles.documentIcon} 
              resizeMode="contain"
            />
            <Text style={styles.resumeName} numberOfLines={1} ellipsizeMode="middle">
              {resumeName}
            </Text>
            <TouchableOpacity onPress={pickResume} style={styles.changeButton}>
              <Text style={styles.changeButtonText}>Change</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.emptyPreview}>
            <Text style={styles.emptyPreviewText}>No resume uploaded</Text>
          </View>
        )}
      </View>

      <TouchableOpacity style={styles.uploadButton} onPress={pickResume}>
        <Text style={styles.uploadButtonText}>Upload Resume</Text>
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={[styles.createAccountButton, !resumeUri && styles.disabledButton]} 
        onPress={handleCreateAccount}
        disabled={!resumeUri}
      >
        <Text style={styles.createAccountButtonText}>Create Account</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#AAAAAA',
    marginBottom: 30,
    textAlign: 'center',
  },
  resumePreviewContainer: {
    width: '100%',
    height: 180,
    backgroundColor: '#111111',
    borderRadius: 12,
    marginBottom: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#333333',
    overflow: 'hidden',
  },
  emptyPreview: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyPreviewText: {
    color: '#666666',
    fontSize: 16,
  },
  resumePreview: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
  },
  documentIcon: {
    width: 60,
    height: 60,
    marginBottom: 10,
  },
  resumeName: {
    color: '#FFFFFF',
    fontSize: 16,
    marginBottom: 15,
    maxWidth: '80%',
  },
  changeButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#333333',
    borderRadius: 6,
  },
  changeButtonText: {
    color: '#4A90E2',
    fontSize: 14,
  },
  uploadButton: {
    backgroundColor: '#4A90E2',
    borderRadius: 10,
    paddingVertical: 15,
    paddingHorizontal: 30,
    width: '100%',
    alignItems: 'center',
    marginBottom: 20,
  },
  uploadButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  createAccountButton: {
    backgroundColor: '#22C55E',
    borderRadius: 10,
    paddingVertical: 15,
    paddingHorizontal: 30,
    width: '100%',
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: '#22C55E80',
  },
  createAccountButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default OnbResume;