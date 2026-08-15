import React from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edges } from 'react-native-safe-area-context';

interface ScreenProps {
  edges?: Edges;
  backgroundColor?: string;
  scroll?: boolean;
  keyboardAvoiding?: boolean;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

const DEFAULT_EDGES: Edges = ['top', 'left', 'right'];

const Screen = ({
  edges = DEFAULT_EDGES,
  backgroundColor = '#ffffff',
  scroll = false,
  keyboardAvoiding = false,
  style,
  children,
}: ScreenProps) => {
  const safeArea = (
    <SafeAreaView
      edges={edges}
      style={[styles.container, { backgroundColor }, style]}
    >
      {children}
    </SafeAreaView>
  );

  if (keyboardAvoiding) {
    return (
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {safeArea}
      </KeyboardAvoidingView>
    );
  }

  if (scroll) {
    return (
      <ScrollView
        style={[styles.container, { backgroundColor }]}
        contentContainerStyle={[styles.scrollContent, style]}
      >
        {children}
      </ScrollView>
    );
  }

  return safeArea;
};

export default Screen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
});
