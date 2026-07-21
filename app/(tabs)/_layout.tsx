import { Tabs } from 'expo-router';
import React from 'react';

import { HapticTab } from '@/components/haptic-tab';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        headerShown: false,
        tabBarButton: HapticTab,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <MaterialCommunityIcons name="home" size={28} color={color} />,
        }}
      />
      <Tabs.Screen
        name="connection"
        options={{
          title: 'Connection',
          tabBarIcon: ({ color }) => <MaterialCommunityIcons name="wifi-settings" size={28} color={color} />,
        }}
      />
      <Tabs.Screen
        name="training"
        options={{
          title: 'Training',
          tabBarIcon: ({ color }) => <MaterialCommunityIcons name="dumbbell" size={28} color={color} />,
        }}
      />
      <Tabs.Screen
        name="monitor"
        options={{
          title: 'Monitor',
          tabBarIcon: ({ color }) => <MaterialCommunityIcons name="chart-box-outline" size={28} color={color} />,
        }}
      />
    </Tabs>
  );
}
