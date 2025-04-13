import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Image,
  Platform,
  Alert,
  TouchableOpacity,
} from "react-native";
import { Button, Input, FriendAvatars } from "../components";
import { signUp } from "../services/authService";
import { COLORS, SPACING, FONT_SIZES, LAYOUT } from "../constants";

const SignUpScreen = ({ navigation }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const validateForm = () => {
    const newErrors = {};

    if (!email) newErrors.email = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(email)) newErrors.email = "Email is invalid";

    if (!password) newErrors.password = "Password is required";
    else if (password.length < 6)
      newErrors.password = "Password must be at least 6 characters";

    if (!fullName) newErrors.fullName = "Full Name is required";

    if (!phoneNumber) newErrors.phoneNumber = "Phone Number is required";
    else if (!/^\d{10}$/.test(phoneNumber.replace(/\D/g, ""))) {
      newErrors.phoneNumber = "Please enter a valid 10-digit phone number";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSignUp = async () => {
    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      // Format phone number consistently
      const formattedPhoneNumber = phoneNumber.replace(/\D/g, "");

      const user = await signUp(email, password, {
        name: fullName,
        phoneNumber: formattedPhoneNumber,
      });

      // Validate that we have a user with an ID
      if (!user || !user.id) {
        console.error("Sign up returned invalid user object:", user);
        throw new Error("Failed to create user account properly");
      }

      console.log("Successfully created user with ID:", user.id);

      // Use the global startOnboarding function instead of navigation
      if (global.startOnboarding) {
        console.log("Starting onboarding process for user:", user.id);
        
        const onboardingData = {
          userId: user.id,
          email: email,
          fullName: fullName,
          phoneNumber: formattedPhoneNumber,
          password: password
        };
        
        console.log("Onboarding data:", JSON.stringify(onboardingData, null, 2));
        global.startOnboarding(onboardingData);
      } else {
        // Fallback if the global function isn't available
        console.error("startOnboarding function not available");
        Alert.alert(
          "Error",
          "Could not start onboarding process. Please try again."
        );
      }
    } catch (error) {
      Alert.alert("Sign Up Failed", error.message);
    } finally {
      setLoading(false);
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.container}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Create Account</Text>
        </View>

        <Image
          source={require("../../assets/image.png")}
          style={{
            width: 200,
            height: 200,
            marginLeft: "auto",
            marginRight: "auto",
          }}
        ></Image>

        <View style={styles.formContainer}>
          <Input
            placeholder="Full Name"
            value={fullName}
            onChangeText={setFullName}
            error={errors.fullName}
            errorText={errors.fullName}
          />

          <Input
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            error={errors.email}
            errorText={errors.email}
          />

          <Input
            placeholder="Phone Number"
            value={phoneNumber}
            onChangeText={setPhoneNumber}
            keyboardType="phone-pad"
            error={errors.phoneNumber}
            errorText={errors.phoneNumber}
          />

          <View style={styles.passwordContainer}>
            <Input
              placeholder="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              error={errors.password}
              errorText={errors.password}
              style={{ flex: 1 }}
            />
            <TouchableOpacity
              style={styles.eyeIcon}
              onPress={togglePasswordVisibility}
            >
              <Text style={styles.eyeIconText}>
                {showPassword ? "👁️" : "👁️‍🗨️"}
              </Text>
            </TouchableOpacity>
          </View>

          <Button
            title="Create Account"
            onPress={handleSignUp}
            loading={loading}
            disabled={loading}
            style={styles.button}
          />

          <Button
            title="Already have an account? Sign In"
            onPress={() => navigation.navigate("SignIn")}
            variant="secondary"
            style={styles.secondaryButton}
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
  avatarSection: {
    alignItems: "center",
    paddingVertical: SPACING.md,
  },
  formContainer: {
    paddingHorizontal: SPACING.lg,
  },
  passwordContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: SPACING.md,
    position: "relative",
  },
  eyeIcon: {
    position: "absolute",
    right: SPACING.md,
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: SPACING.sm,
    zIndex: 1,
    top: -3,
    right: 1.1,
  },
  eyeIconText: {
    fontSize: FONT_SIZES.md,
    lineHeight: FONT_SIZES.md * 1.5,
    marginTop: -3,
    marginRight: 1.1,
  },
  button: {
    marginTop: SPACING.md,
  },
  secondaryButton: {
    marginTop: SPACING.lg,
  },
  errorText: {
    color: COLORS.error,
    fontSize: FONT_SIZES.xs,
    marginTop: SPACING.xs,
  },
});

export default SignUpScreen;
