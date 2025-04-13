import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Image,
  Alert,
} from "react-native";
import { Button, Input, FriendAvatars } from "../components";
import { signIn } from "../services/authService";
import { COLORS, SPACING, FONT_SIZES } from "../constants";

const SignInScreen = ({ navigation }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSignIn = async () => {
    // Validate inputs
    if (!email || !password) {
      setError("Please fill in all fields");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      await signIn(email, password);
      // Auth state listener in App.tsx will handle navigation
    } catch (error) {
      setError(error.message);
      Alert.alert("Sign In Failed", error.message);
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
          <Text style={styles.title}>Welcome back.</Text>
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
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            error={error && !email}
          />

          <Input
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            error={error && !password}
          />

          <Button
            title="Sign In"
            onPress={handleSignIn}
            loading={loading}
            disabled={loading}
            style={styles.button}
          />

          <Button
            title="No Account? Sign Up!"
            onPress={() => navigation.navigate("SignUp")}
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
    paddingTop: SPACING.xxl,
  },
  title: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: "bold",
    textAlign: "center",
    color: "#282829",
  },
  avatarSection: {
    alignItems: "center",
    paddingVertical: SPACING.lg,
  },
  formContainer: {
    paddingHorizontal: SPACING.lg,
    marginTop: SPACING.lg,
  },
  button: {
    marginTop: SPACING.md,
  },
  secondaryButton: {
    marginTop: SPACING.lg,
  },
});

export default SignInScreen;
