import { Tabs } from 'expo-router';
import { View, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/colors';

function AIFabTab() {
  const router = useRouter();
  return (
    <TouchableOpacity
      onPress={() => router.push('/ai-chat')}
      style={{
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: Colors.brand,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 6,
        shadowColor: Colors.brand,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
        elevation: 8,
      }}
    >
      <View style={{ width: 20, height: 20 }}>
        {/* Sparkle icon */}
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: 2, height: 20, backgroundColor: '#fff', borderRadius: 1, position: 'absolute' }} />
          <View style={{ width: 20, height: 2, backgroundColor: '#fff', borderRadius: 1, position: 'absolute' }} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.brand,
        tabBarInactiveTintColor: Colors.textTertiary,
        tabBarStyle: {
          backgroundColor: Colors.surface,
          borderTopColor: Colors.border,
          height: 84,
          paddingBottom: 20,
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
      }}
    >
      <Tabs.Screen name="index"    options={{ title: '首页',  tabBarIcon: ({ color }) => <TabIcon icon="⌂" color={color} /> }} />
      <Tabs.Screen name="items"    options={{ title: '物品',  tabBarIcon: ({ color }) => <TabIcon icon="◻" color={color} /> }} />
      <Tabs.Screen name="ai"       options={{ title: '', tabBarButton: () => <AIFabTab /> }} />
      <Tabs.Screen name="insights" options={{ title: '价值',  tabBarIcon: ({ color }) => <TabIcon icon="✦" color={color} /> }} />
      <Tabs.Screen name="settings" options={{ title: '设置',  tabBarIcon: ({ color }) => <TabIcon icon="⚙" color={color} /> }} />
    </Tabs>
  );
}

function TabIcon({ icon, color }: { icon: string; color: string }) {
  const { Text } = require('react-native');
  return <Text style={{ fontSize: 18, color }}>{icon}</Text>;
}
