import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Stack } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';

export default function RootLayout() {
  useAuth(); // handles redirect guard

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="ai-chat" options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="item/[id]" options={{ presentation: 'card', headerShown: true, headerTitle: '物品详情', headerBackTitle: '返回' }} />
      </Stack>
    </GestureHandlerRootView>
  );
}
