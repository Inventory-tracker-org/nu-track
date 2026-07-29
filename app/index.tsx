import * as SecureStore from 'expo-secure-store';
import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';

import {
  ActivityIndicator,
  StyleSheet,
  View,
} from 'react-native';

import { useDelivery } from
  '../context/DeliveryContext';

type Destination =
  | '/login'
  | '/home-screen'
  | '/package'
  | null;

export default function IndexScreen() {
  const {
    loading: deliveryLoading,
    recoverActiveDelivery,
  } = useDelivery();

  const [destination, setDestination] =
    useState<Destination>(null);

  useEffect(() => {
    if (deliveryLoading) {
      return;
    }

    const determineDestination =
      async () => {
        const token =
          await SecureStore.getItemAsync(
            'token'
          );

        if (!token) {
          setDestination('/login');
          return;
        }

        const recovered =
          await recoverActiveDelivery();

        setDestination(
          recovered
            ? '/package'
            : '/home-screen'
        );
      };

    determineDestination();
  }, [
    deliveryLoading,
    recoverActiveDelivery,
  ]);

  if (!destination) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return <Redirect href={destination} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
});