import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { Button, Input } from "../components";
import { COLORS, SPACING, FONT_SIZES } from "../constants";

const OnboardingScreen = ({ navigation }) => {
  const [interestsInput, setInterestsInput] = useState("");
  const [major, setMajor] = useState("");
  const [resume, setResume] = useState(null);
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

  const handleSubmit = () => {
    if (!validateForm()) return;

    // Simulate setting resume as major
    setResume({ name: major });

    Alert.alert("Success", `Onboarding complete!\nResume: ${major}`);
    navigation.navigate("MapScreen");
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.container}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Tell us about yourself</Text>
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
            title="Complete Onboarding"
            onPress={handleSubmit}
            style={styles.button}
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
