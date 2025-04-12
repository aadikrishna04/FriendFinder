import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, LAYOUT, FONT_SIZES } from '../constants';

/**
 * Friend avatars component for displaying a center avatar surrounded by smaller avatars
 * 
 * @param {object} props - Component props
 * @param {string} [props.centerEmoji] - Emoji to display in the center avatar
 * @param {string} [props.centerColor] - Background color for the center avatar
 * @param {string} [props.variant] - Size variant ('large' or 'small')
 * @param {object} [props.style] - Additional styles for the container
 * @returns {React.ReactElement}
 */
const FriendAvatars = ({
  centerEmoji = '😄✌️',
  centerColor = COLORS.avatarColors.purple,
  variant = 'large',
  style = {},
}) => {
  const isLarge = variant === 'large';
  
  // Define emoji's for surrounding avatars
  const surroundingEmojis = [
    { emoji: '👩', color: COLORS.avatarColors.yellow },
    { emoji: '🧔', color: COLORS.avatarColors.green },
    { emoji: '👨‍🦲', color: COLORS.avatarColors.yellow },
    { emoji: '👩‍🦱', color: COLORS.avatarColors.pink },
  ];
  
  // For large variant, add more avatars
  if (isLarge) {
    surroundingEmojis.push(
      { emoji: '👧', color: COLORS.avatarColors.purple },
      { emoji: '👨‍🦰', color: COLORS.avatarColors.red }
    );
  }
  
  return (
    <View style={[
      styles.container,
      isLarge ? styles.largeContainer : styles.smallContainer,
      style
    ]}>
      {/* Center avatar */}
      <View 
        style={[
          styles.centerAvatar, 
          isLarge ? styles.largeCenterAvatar : styles.smallCenterAvatar,
          { backgroundColor: centerColor }
        ]}
      >
        <Text style={isLarge ? styles.largeEmojiText : styles.emojiText}>
          {centerEmoji}
        </Text>
      </View>
      
      {/* Surrounding avatars */}
      {surroundingEmojis.map((item, index) => (
        <View
          key={index}
          style={[
            styles.avatar,
            isLarge ? styles.largeAvatar : styles.smallAvatar,
            isLarge ? styles[`largePosition${index + 1}`] : styles[`smallPosition${index + 1}`],
            { backgroundColor: item.color }
          ]}
        >
          <Text style={styles.emojiText}>{item.emoji}</Text>
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  largeContainer: {
    width: 300,
    height: 300,
  },
  smallContainer: {
    width: 250,
    height: 150,
  },
  centerAvatar: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  largeCenterAvatar: {
    width: LAYOUT.avatarSizes.large,
    height: LAYOUT.avatarSizes.large,
    borderRadius: LAYOUT.avatarSizes.large / 2,
    top: '50%',
    left: '50%',
    marginLeft: -LAYOUT.avatarSizes.large / 2,
    marginTop: -LAYOUT.avatarSizes.large / 2,
  },
  smallCenterAvatar: {
    width: LAYOUT.avatarSizes.medium,
    height: LAYOUT.avatarSizes.medium,
    borderRadius: LAYOUT.avatarSizes.medium / 2,
    top: '50%',
    left: '50%',
    marginLeft: -LAYOUT.avatarSizes.medium / 2,
    marginTop: -LAYOUT.avatarSizes.medium / 2,
  },
  avatar: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  largeAvatar: {
    width: LAYOUT.avatarSizes.small,
    height: LAYOUT.avatarSizes.small,
    borderRadius: LAYOUT.avatarSizes.small / 2,
  },
  smallAvatar: {
    width: LAYOUT.avatarSizes.small,
    height: LAYOUT.avatarSizes.small,
    borderRadius: LAYOUT.avatarSizes.small / 2,
  },
  // Positions for large variant
  largePosition1: { top: 20, left: 20 },
  largePosition2: { top: 20, right: 20 },
  largePosition3: { top: '50%', left: 0, marginTop: -30 },
  largePosition4: { top: '50%', right: 0, marginTop: -30 },
  largePosition5: { bottom: 20, left: 40 },
  largePosition6: { bottom: 20, right: 40 },
  // Positions for small variant
  smallPosition1: { top: 0, left: 40 },
  smallPosition2: { top: 0, right: 40 },
  smallPosition3: { bottom: 0, left: 40 },
  smallPosition4: { bottom: 0, right: 40 },
  emojiText: {
    fontSize: FONT_SIZES.xl,
  },
  largeEmojiText: {
    fontSize: FONT_SIZES.xxl,
  },
});

export default FriendAvatars; 