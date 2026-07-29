import { Redirect } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    StyleSheet,
    View,
} from 'react-native';

export default function IndexScreen() {
  const [loading, setLoading] = useState(true);
  const [hasToken, setHasToken] = useState(false);

  useEffect(() => {
    const checkAuthentication = async () => {
      try {
        const token = await SecureStore.getItemAsync('token');

        setHasToken(Boolean(token));
      } catch (error) {
        console.error('Unable to read authentication token:', error);
        setHasToken(false);
      } finally {
        setLoading(false);
      }
    };

    checkAuthentication();
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (hasToken) {
    return <Redirect href="/home-screen" />;
  }

  return <Redirect href="/login" />;
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
});