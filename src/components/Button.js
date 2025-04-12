import React from 'react';
import { 
  TouchableOpacity, 
  Text, 
  StyleSheet, 
  ActivityIndicator 
} from 'react-native';
import { COLORS, LAYOUT, FONT_SIZES, SPACING } from '../constants';

/**
 * Reusable button component
 * 
 * @param {object} props - Component props
 * @param {string} props.title - Button text
 * @param {function} props.onPress - Function to call when button is pressed
 * @param {boolean} [props.loading] - Whether to show loading indicator
 * @param {boolean} [props.disabled] - Whether button is disabled
 * @param {object} [props.style] - Additional styles for the button
 * @param {object} [props.textStyle] - Additional styles for the text
 * @param {string} [props.variant] - Button variant ('primary' or 'secondary')
 * @returns {React.ReactElement}
 */
const Button = ({ 
  title, 
  onPress, 
  loading = false, 
  disabled = false,
  style = {},
  textStyle = {},
  variant = 'primary'
}) => {
  const isPrimary = variant === 'primary';
  
  return (
    <TouchableOpacity 
      style={[
        styles.button,
        isPrimary ? styles.primaryButton : styles.secondaryButton,
        disabled && styles.disabledButton,
        style
      ]}
      onPress={onPress}
      disabled={disabled || loading}
    >
      {loading ? (
        <ActivityIndicator 
          color={isPrimary ? COLORS.background : COLORS.primary} 
          size="small" 
        />
      ) : (
        <Text 
          style={[
            styles.buttonText,
            isPrimary ? styles.primaryButtonText : styles.secondaryButtonText,
            textStyle
          ]}
        >
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    height: LAYOUT.buttonHeight,
    borderRadius: LAYOUT.borderRadius,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
  },
  primaryButton: {
    backgroundColor: COLORS.primary,
  },
  secondaryButton: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  disabledButton: {
    opacity: 0.6,
  },
  buttonText: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
  },
  primaryButtonText: {
    color: COLORS.background,
  },
  secondaryButtonText: {
    color: COLORS.primary,
  },
});

export default Button; 