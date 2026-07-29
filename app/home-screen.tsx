import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';

const LOGOUT_URL =
  'https://dataworks-7b7x.onrender.com/api/logout-api.php';

export default function HomeScreen() {
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
  if (loggingOut) {
    return;
  }

  setLoggingOut(true);

  try {
    const token = await SecureStore.getItemAsync('token');

    if (token) {
      await fetch(LOGOUT_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      });
    }
  } catch (error) {
    console.warn('Logout API failed:', error);
  }

  // Always log the user out locally.
  await SecureStore.deleteItemAsync('token');

  router.replace('/login');

  setLoggingOut(false);
};

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Package Tracker</Text>

        <Text style={styles.subtitle}>
          Choose an action to continue
        </Text>

        <TouchableOpacity
          style={styles.button}
          onPress={() => router.push('/scan')}
          disabled={loggingOut}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonText}>
            Scan Package
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.button}
          onPress={() => router.push('/sync')}
          disabled={loggingOut}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonText}>
            Sync Saved Packages
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.button,
            styles.logoutButton,
            loggingOut ? styles.disabledButton : null,
          ]}
          onPress={handleLogout}
          disabled={loggingOut}
          activeOpacity={0.8}
        >
          {loggingOut ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.buttonText}>
              Logout
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  content: {
    width: '100%',
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#555555',
    textAlign: 'center',
    marginBottom: 40,
  },
  button: {
    backgroundColor: '#222222',
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  logoutButton: {
    backgroundColor: '#b00020',
    marginTop: 16,
  },
  disabledButton: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
});