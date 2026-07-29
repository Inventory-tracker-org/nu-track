
import * as SecureStore from 'expo-secure-store';

import { router } from 'expo-router';
import { useCallback, useState } from 'react';

import {
  Alert,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { useFocusEffect } from '@react-navigation/native';

import { useDelivery } from '../context/DeliveryContext';

import {
  getQueuedDeliveries,
} from '../storage/deliveryStorage';

export default function HomeScreen() {
  const { startNewDelivery } =
    useDelivery();

  const [queuedCount, setQueuedCount] =
    useState(0);

  useFocusEffect(
    useCallback(() => {
      const loadQueueCount = async () => {
        const queue =
          await getQueuedDeliveries();

        setQueuedCount(queue.length);
      };

      loadQueueCount();
    }, [])
  );

  const handleStartScan = async () => {
    await startNewDelivery();
    router.push('/scan');
  };

  const handleSync = () => {
    router.push('/sync');
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
                await SecureStore.getItemAsync(
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
                    },
                  }
                );
              }
            } catch (error) {
              console.warn(
                'Server logout failed:',
                error
              );
            } finally {
              await SecureStore.deleteItemAsync(
                'token'
              );

              router.replace('/login');
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>
          Package Tracker
        </Text>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={handleStartScan}
        >
          <Text style={styles.primaryButtonText}>
            Scan Package
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={handleSync}
        >
          <Text
            style={styles.secondaryButtonText}
          >
            Sync Saved Packages
            {queuedCount > 0
              ? ` (${queuedCount})`
              : ''}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
        >
          <Text style={styles.logoutText}>
            Logout
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
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