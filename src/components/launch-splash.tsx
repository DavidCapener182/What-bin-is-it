import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Animated, Image, Platform, StyleSheet } from 'react-native';

const artwork = require('../../assets/images/launch-splash.png');

export function LaunchSplash() {
  const [visible, setVisible] = useState(true);
  const [opacity] = useState(() => new Animated.Value(1));

  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 320,
        useNativeDriver: Platform.OS !== 'web',
      }).start(({ finished }) => {
        if (finished) setVisible(false);
      });
    }, 900);

    return () => {
      clearTimeout(timer);
      opacity.stopAnimation();
    };
  }, [opacity]);

  if (!visible) return null;

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={[styles.overlay, { opacity }]}>
      <StatusBar style="dark" />
      <Image accessibilityIgnoresInvertColors resizeMode="cover" source={artwork} style={styles.artwork} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 10_000,
    elevation: 10_000,
    backgroundColor: '#FAF7F2',
  },
  artwork: {
    width: '100%',
    height: '100%',
  },
});
