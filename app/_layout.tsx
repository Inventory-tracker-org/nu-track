import { Stack } from 'expo-router';

import { PackageScanProvider } from '../context/PackageScanContext';

import {
  DeliveryProvider,
} from '../context/DeliveryContext';

export default function RootLayout() {
  return (
    <PackageScanProvider>
      <DeliveryProvider>
        <Stack
          screenOptions={{
            headerShown: false,
            animation: 'slide_from_right',
          }}
        >
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

          <Stack.Screen name="photo" />
          <Stack.Screen name="signature" />
        </Stack>
      </DeliveryProvider>
    </PackageScanProvider>
  );
}