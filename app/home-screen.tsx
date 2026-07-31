import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';

import {
  useCallback,
  useState,
} from 'react';

import {
  Alert,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  useDelivery,
} from '../context/DeliveryContext';

import {
  getQueuedDeliveries,
} from '../storage/deliveryStorage';

import {
  removeCurrentAccountKey,
} from '../storage/accountStorage';

/*
 * Replace this with the database user ID
 * of the only account allowed to change
 * the successful scan sound.
 */
const SOUND_SETTINGS_USER_ID = 193;

type StoredUser = {
  id: number | string;
  email?: string;
  username?: string;
};

export default function HomeScreen() {
  const {
    startNewDelivery,
    releaseCurrentAccount,
  } = useDelivery();

  const [
    queuedCount,
    setQueuedCount,
  ] = useState(0);

  const [
    currentUser,
    setCurrentUser,
  ] = useState<StoredUser | null>(
    null
  );

  const canChangeScanSound =
    currentUser !== null &&
    Number(currentUser.id) ===
      SOUND_SETTINGS_USER_ID;

  useFocusEffect(
    useCallback(() => {
      let screenIsActive = true;

      const loadHomeInformation =
        async () => {
          try {
            const [
              queuedDeliveries,
              storedUser,
            ] = await Promise.all([
              getQueuedDeliveries(),

              SecureStore.getItemAsync(
                'current_user'
              ),
            ]);

            if (!screenIsActive) {
              return;
            }

            setQueuedCount(
              queuedDeliveries.length
            );

            if (!storedUser) {
              setCurrentUser(null);
              return;
            }

            try {
              const parsedUser =
                JSON.parse(
                  storedUser
                ) as StoredUser;

              setCurrentUser(
                parsedUser
              );
            } catch {
              setCurrentUser(null);
            }
          } catch (error) {
            console.error(
              'Unable to load home screen information:',
              error
            );

            if (screenIsActive) {
              setQueuedCount(0);
              setCurrentUser(null);
            }
          }
        };

      void loadHomeInformation();

      return () => {
        screenIsActive = false;
      };
    }, [])
  );

  const handleStartScan =
    async () => {
      try {
        await startNewDelivery();

        router.push('/scan');
      } catch (error) {
        Alert.alert(
          'Unable to Start Scan',
          error instanceof Error
            ? error.message
            : 'Unable to start a new delivery.'
        );
      }
    };

  const handleSync = () => {
    router.push('/sync');
  };

  const handleSettings = () => {
    if (!canChangeScanSound) {
      return;
    }

    router.push('/settings');
  };

  const handleLogout = () => {
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Log Out',
          style: 'destructive',

          onPress: async () => {
            try {
              const token =
                await SecureStore
                  .getItemAsync(
                    'token'
                  );

              if (token) {
                await fetch(
                  'https://dataworks-7b7x.onrender.com/api/logout-api.php',
                  {
                    method: 'POST',

                    headers: {
                      Authorization:
                        `Bearer ${token}`,

                      Accept:
                        'application/json',
                    },
                  }
                );
              }
            } catch (error) {
              /*
               * A failed server logout should
               * not prevent local logout.
               */
              console.warn(
                'Server logout failed:',
                error
              );
            } finally {
              releaseCurrentAccount();

              await Promise.all([
                SecureStore.deleteItemAsync(
                  'token'
                ),

                SecureStore.deleteItemAsync(
                  'current_user'
                ),

                removeCurrentAccountKey(),
              ]);

              router.replace('/login');
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView
      style={styles.safeArea}
    >
      <View
        style={styles.container}
      >
        {canChangeScanSound ? (
          <TouchableOpacity
            style={
              styles.settingsButton
            }
            onPress={
              handleSettings
            }
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Open sound settings"
          >
            <Text
              style={
                styles.settingsButtonText
              }
            >
              Settings
            </Text>
          </TouchableOpacity>
        ) : null}

        <View
          style={styles.content}
        >
          <Text
            style={styles.title}
          >
            Dataworks Track
          </Text>

          <Text
            style={styles.subtitle}
          >
            Welcome Back,{' '}
            {currentUser?.username ??
              'User'}
          </Text>

          <TouchableOpacity
            style={
              styles.primaryButton
            }
            onPress={
              handleStartScan
            }
            activeOpacity={0.8}
          >
            <Text
              style={
                styles.primaryButtonText
              }
            >
              Scan Package
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={
              styles.secondaryButton
            }
            onPress={handleSync}
            activeOpacity={0.8}
          >
            <Text
              style={
                styles.secondaryButtonText
              }
            >
              Sync Saved Packages
              {queuedCount > 0
                ? ` (${queuedCount})`
                : ''}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={
              styles.logoutButton
            }
            onPress={handleLogout}
            activeOpacity={0.8}
          >
            <Text
              style={
                styles.logoutText
              }
            >
              Log Out
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles =
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: '#ffffff',
    },

    container: {
      flex: 1,
      position: 'relative',
      paddingHorizontal: 24,
    },

    content: {
      flex: 1,
      justifyContent: 'center',
    },

    settingsButton: {
      position: 'absolute',
      top: 16,
      right: 20,
      zIndex: 10,

      paddingHorizontal: 14,
      paddingVertical: 9,

      borderWidth: 1,
      borderColor: '#222222',
      borderRadius: 8,

      backgroundColor: '#ffffff',
    },

    settingsButtonText: {
      color: '#222222',
      fontSize: 14,
      fontWeight: '700',
    },

    title: {
      fontSize: 30,
      fontWeight: '700',
      textAlign: 'center',
      marginBottom: 8,
    },

    subtitle: {
      color: '#555555',
      fontSize: 16,
      textAlign: 'center',
      marginBottom: 40,
    },

    primaryButton: {
      backgroundColor: '#222222',
      borderRadius: 8,
      paddingVertical: 16,
      alignItems: 'center',
      marginBottom: 16,
    },

    primaryButtonText: {
      color: '#ffffff',
      fontSize: 16,
      fontWeight: '700',
    },

    secondaryButton: {
      borderWidth: 1,
      borderColor: '#222222',
      borderRadius: 8,
      paddingVertical: 16,
      alignItems: 'center',
      marginBottom: 16,
    },

    secondaryButtonText: {
      color: '#222222',
      fontSize: 16,
      fontWeight: '700',
    },

    logoutButton: {
      paddingVertical: 14,
      alignItems: 'center',
    },

    logoutText: {
      color: '#b00020',
      fontSize: 16,
      fontWeight: '600',
    },
  });