import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{ headerShown: false }}
      />

      <Stack.Screen
        name="login"
        options={{ headerShown: false }}
      />

      <Stack.Screen
        name="home-screen"
        options={{ headerShown: false }}
      />

      <Stack.Screen
        name="scan"
        options={{ title: 'Scan Package' }}
      />

      <Stack.Screen
        name="package"
        options={{ title: 'Package Information' }}
      />

      <Stack.Screen
        name="sync"
        options={{ title: 'Saved Packages' }}
      />
    </Stack>
  );
}