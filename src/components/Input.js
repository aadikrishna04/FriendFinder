import React from 'react';
import { TextInput, StyleSheet, View, Text } from 'react-native';
import { COLORS, LAYOUT, FONT_SIZES, SPACING } from '../constants';

/**
 * Reusable input component
 * 
 * @param {object} props - Component props
 * @param {string} props.placeholder - Input placeholder text
 * @param {string} props.value - Input value
 * @param {function} props.onChangeText - Function to call when input changes
 * @param {string} [props.label] - Optional label above the input
 * @param {boolean} [props.secureTextEntry] - Whether to hide input text
 * @param {string} [props.keyboardType] - Keyboard type for the input
 * @param {string} [props.autoCapitalize] - Auto capitalize behavior
 * @param {boolean} [props.error] - Whether input has an error
 * @param {string} [props.errorText] - Error message to display
 * @param {object} [props.style] - Additional styles for the input container
 * @param {object} [props.inputStyle] - Additional styles for the input itself
 * @returns {React.ReactElement}
 */
const Input = ({
  placeholder,
  value,
  onChangeText,
  label,
  secureTextEntry = false,
  keyboardType = 'default',
  autoCapitalize = 'sentences',
  error = false,
  errorText = '',
  style = {},
  inputStyle = {},
}) => {
  return (
    <View style={[styles.container, style]}>
      {label && <Text style={styles.label}>{label}</Text>}
      
      <TextInput
        style={[
          styles.input,
          error && styles.inputError,
          inputStyle
        ]}
        placeholder={placeholder}
        placeholderTextColor={COLORS.placeholder}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
      />
      
      {error && errorText ? (
        <Text style={styles.errorText}>{errorText}</Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: SPACING.md,
  },
  label: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  input: {
    height: LAYOUT.inputHeight,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: LAYOUT.borderRadius,
    paddingHorizontal: SPACING.md,
    fontSize: FONT_SIZES.md,
  },
  inputError: {
    borderColor: COLORS.error,
  },
  errorText: {
    color: COLORS.error,
    fontSize: FONT_SIZES.xs,
    marginTop: SPACING.xs,
  },
});

export default Input; 