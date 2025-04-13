import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Button, Input } from "../components";
import { COLORS, SPACING, FONT_SIZES } from "../constants";
import { supabase } from "../services/supabaseClient";

const OnboardingScreen = ({ route, navigation }) => {
  // Get user data from route params
  const { userId, email, fullName, phoneNumber, password } = route.params || {};
  
  console.log("OnboardingScreen initialized with params:", 
    route.params ? JSON.stringify({
      userId,
      email,
      fullName,
      phoneNumber,
      hasPassword: !!password
    }, null, 2) : "No params");
  
  const [interestsInput, setInterestsInput] = useState("");
  const [major, setMajor] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const parsedInterests = interestsInput
    .split(",")
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);

  const validateForm = () => {
    const newErrors = {};
    if (parsedInterests.length === 0)
      newErrors.interests = "Interests are required";
    if (!major) newErrors.major = "Major is required";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    
    setLoading(true);
    
    try {
      // Validate user ID
      if (!userId) {
        console.error('User ID is undefined or invalid. Route params:', 
          route.params ? JSON.stringify(route.params, null, 2) : "No params");
        throw new Error('User ID is undefined or invalid');
      }
      
      console.log(`Attempting to update profile for user ID: ${userId}`);
      
      // Update user profile with interests and major
      const { error } = await supabase
        .from('users')
        .update({ 
          tags: JSON.stringify(parsedInterests),
          resume: major  // Using resume field to store major for now
        })
        .eq('id', userId);
      
      if (error) {
        console.error('Supabase update error:', error);
        throw error;
      }
      
      // Sign in the user with the stored credentials
      if (!email || !password) {
        console.error('Missing email or password for sign-in:', { 
          hasEmail: !!email, 
          hasPassword: !!password 
        });
        throw new Error('Sign-in credentials are missing');
      }
      
      console.log(`Attempting to sign in with email: ${email}`);
      
      const { data: sessionData, error: signInError } = await supabase.auth.signInWithPassword({
        email: email,
        password: password
      });
      
      if (signInError) {
        console.error('Sign-in error:', signInError);
        throw signInError;
      }
      
      console.log('Sign-in successful. User ID:', sessionData?.user?.id);
      console.log('Resetting onboarding state');
      
      // Reset the onboarding state in the App component
      if (global.startOnboarding) {
        global.startOnboarding(null); // Reset onboarding data
      } else {
        console.warn('global.startOnboarding is not available');
      }
      
      // No need to use navigation.reset since we're using global state
      // The App component will automatically show the main app
      // when isOnboarding is false and the user is authenticated
    } catch (error) {
      console.error('Error updating user profile:', error);
      Alert.alert('Error', 'Failed to complete onboarding. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.container}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Tell us about yourself</Text>
          <Text style={styles.subtitle}>Hi {fullName}, just a few more details to get started!</Text>
        </View>

        <View style={styles.formContainer}>
          {/* #major */}
          <Text style={styles.tagLabel}>#major</Text>
          <Input
            placeholder="Your Major"
            value={major}
            onChangeText={setMajor}
            error={errors.major}
            errorText={errors.major}
          />

          {/* #interests */}
          <Text style={styles.tagLabel}>#interests</Text>
          <View style={styles.tagsContainer}>
            {parsedInterests.map((tag, index) => (
              <View key={index} style={styles.tag}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
          </View>
          <Input
            placeholder="Interests (comma-separated)"
            value={interestsInput}
            onChangeText={setInterestsInput}
            error={errors.interests}
            errorText={errors.interests}
          />

          <Button
            title="Complete Profile"
            onPress={handleSubmit}
            style={styles.button}
            loading={loading}
            disabled={loading}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xl,
  },
  title: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: "bold",
    textAlign: "center",
    color: COLORS.text,
  },
  subtitle: {
    fontSize: FONT_SIZES.md,
    textAlign: "center",
    color: COLORS.secondaryText,
    marginTop: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  formContainer: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
  },
  tagLabel: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.primary,
    fontWeight: "600",
    marginBottom: SPACING.xs,
    marginTop: SPACING.md,
  },
  tagsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  tag: {
    backgroundColor: COLORS.primary + "20",
    borderRadius: 20,
    paddingVertical: 4,
    paddingHorizontal: 12,
    marginRight: SPACING.xs,
    marginBottom: SPACING.xs,
  },
  tagText: {
    color: COLORS.primary,
    fontSize: FONT_SIZES.sm,
  },
  button: {
    marginTop: SPACING.lg,
  },
  errorText: {
    color: COLORS.error,
    fontSize: FONT_SIZES.xs,
    marginTop: SPACING.xs,
  },
});

export default OnboardingScreen;
