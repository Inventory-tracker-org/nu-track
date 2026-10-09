import { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import * as Haptics from 'expo-haptics';
import { Pressable } from 'react-native';

export function HapticTab(props: BottomTabBarButtonProps) {
  const { onPress, onLongPress, children, style, accessibilityState } = props;

  return (
    <Pressable
      onPress={(ev) => {
        if (process.env.EXPO_OS === 'ios') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }

        onPress?.(ev);
      }}
      onLongPress={onLongPress}
      style={style}
      accessibilityState={accessibilityState}
    >
      {children}
    </Pressable>
  );
}