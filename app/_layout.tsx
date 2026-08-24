import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { ServerProvider } from '@/contexts/ServerContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { BleProvider } from '../contexts/BleContext';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    ScreenOrientation
      .lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP)
      .catch(e => console.error('Failed to lock portrait orientation:', e));
  }, []);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <BleProvider>
        <ServerProvider>
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
          </Stack>
        </ServerProvider>
        <StatusBar style="auto" />
      </BleProvider>
    </ThemeProvider>
  );
}
