import * as SecureStore from
  'expo-secure-store';

import {
  Redirect,
} from 'expo-router';

import {
  useEffect,
  useState,
} from 'react';

import {
  ActivityIndicator,
  StyleSheet,
  View,
} from 'react-native';

import {
  useDelivery,
} from '../context/DeliveryContext';

import {
  getCurrentAccountKey,
} from '../storage/accountStorage';

type Destination =
  | '/login'
  | '/home-screen'
  | '/package'
  | null;

export default function IndexScreen() {
  const {
    recoverActiveDelivery,
  } = useDelivery();

  const [
    destination,
    setDestination,
  ] = useState<Destination>(
    null
  );

  useEffect(() => {
    let active = true;

    const determineDestination =
      async () => {
        const token =
          await SecureStore
            .getItemAsync('token');

        const accountKey =
          await getCurrentAccountKey();

        if (!active) {
          return;
        }

        if (
          !token ||
          !accountKey
        ) {
          setDestination(
            '/login'
          );

          return;
        }

        const recovered =
          await recoverActiveDelivery();

        if (!active) {
          return;
        }

        setDestination(
          recovered
            ? '/package'
            : '/home-screen'
        );
      };

    determineDestination().catch(
      (error) => {
        console.error(
          'Startup error:',
          error
        );

        if (active) {
          setDestination(
            '/login'
          );
        }
      }
    );

    return () => {
      active = false;
    };
  }, [recoverActiveDelivery]);

  if (!destination) {
    return (
      <View style={styles.container}>
        <ActivityIndicator
          size="large"
        />
      </View>
    );
  }

  return (
    <Redirect
      href={destination}
    />
  );
}

const styles =
  StyleSheet.create({
    container: {
      flex: 1,
      alignItems: 'center',
      justifyContent:
        'center',
      backgroundColor:
        '#ffffff',
    },
  });