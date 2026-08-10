import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

export default function HomeScreen() {
  const handleLogout = async () => {
    // We'll call logout-api.php later.
    await SecureStore.deleteItemAsync('token');

    router.replace('/login');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Dataworks Track</Text>


      <TouchableOpacity
        style={[styles.button, styles.logoutButton]}
        onPress={handleLogout}
      >
        <Text style={styles.buttonText}>Logout</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: '#ffffff',
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
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
    marginTop: 20,
    backgroundColor: '#B00020',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
});