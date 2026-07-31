import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import React, { useState } from 'react';

import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { loginUser } from '../api/auth';

import {
  saveCurrentAccountKey,
} from '../storage/accountStorage';

import {
  useDelivery,
} from '../context/DeliveryContext';

const MAX_LOGIN_ATTEMPTS = 4;

const validateEmail = (email: string): string => {
  const trimmedEmail = email.trim();

  if (!trimmedEmail) {
    return 'Email is required.';
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
    return 'Invalid email format.';
  }

  return '';
};

const validatePassword = (password: string): string => {
  if (!password) {
    return 'Password is required.';
  }

  return '';
};

export default function LoginScreen() {
  const {
  releaseCurrentAccount,
} = useDelivery();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const [failedAttempts, setFailedAttempts] = useState(0);
  const [loading, setLoading] = useState(false);

  const isLockedOut =
    failedAttempts >= MAX_LOGIN_ATTEMPTS;

  const handleLogin = async () => {
    if (loading || isLockedOut) {
      return;
    }

    const currentEmailError =
      validateEmail(email);

    const currentPasswordError =
      validatePassword(password);

    setEmailError(currentEmailError);
    setPasswordError(currentPasswordError);

    if (
      currentEmailError ||
      currentPasswordError
    ) {
      return;
    }

    setLoading(true);

    try {
      const {
  token,
  user,
} = await loginUser(
  email.trim(),
  password
);

await SecureStore.setItemAsync(
  'token',
  token
);

await SecureStore.setItemAsync(
  'current_user',
  JSON.stringify(user)
);

      await SecureStore.setItemAsync(
        'token',
        token
      );

      await saveCurrentAccountKey(
  email
);

      const savedToken =
        await SecureStore.getItemAsync('token');

      if (!savedToken) {
        throw new Error(
          'The login token could not be saved.'
        );
      }

      releaseCurrentAccount();
      setFailedAttempts(0);
      setPassword('');

      router.replace('/');
    } catch (error) {
      setPassword('');

      const message =
        error instanceof Error
          ? error.message
          : 'Unable to log in.';

      setFailedAttempts((currentAttempts) => {
        const nextAttemptCount =
          currentAttempts + 1;

        if (
          nextAttemptCount >=
          MAX_LOGIN_ATTEMPTS
        ) {
          Alert.alert(
            'Too Many Attempts',
            'You have reached the maximum number of login attempts.'
          );
        } else {
          Alert.alert(
            'Login Failed',
            message
          );
        }

        return nextAttemptCount;
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEmailChange = (
    value: string
  ) => {
    setEmail(value);

    if (emailError) {
      setEmailError(
        validateEmail(value)
      );
    }
  };

  const handlePasswordChange = (
    value: string
  ) => {
    setPassword(value);

    if (passwordError) {
      setPasswordError(
        validatePassword(value)
      );
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={
        Platform.OS === 'ios'
          ? 'padding'
          : undefined
      }
    >
      <View style={styles.form}>
        <Text style={styles.title}>
          Package Tracker
        </Text>

        <Text style={styles.subtitle}>
          Sign in to continue
        </Text>

        <Text style={styles.label}>
          Email
        </Text>

        <TextInput
          style={[
            styles.input,
            emailError
              ? styles.inputError
              : null,
          ]}
          placeholder="Email"
          value={email}
          onChangeText={handleEmailChange}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          editable={
            !loading &&
            !isLockedOut
          }
          returnKeyType="next"
        />

        {emailError ? (
          <Text style={styles.errorText}>
            {emailError}
          </Text>
        ) : null}

        <Text style={styles.label}>
          Password
        </Text>

        <TextInput
          style={[
            styles.input,
            passwordError
              ? styles.inputError
              : null,
          ]}
          placeholder="Password"
          value={password}
          onChangeText={
            handlePasswordChange
          }
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          editable={
            !loading &&
            !isLockedOut
          }
          returnKeyType="done"
          onSubmitEditing={
            handleLogin
          }
        />

        {passwordError ? (
          <Text style={styles.errorText}>
            {passwordError}
          </Text>
        ) : null}

        {!isLockedOut &&
        failedAttempts > 0 ? (
          <Text style={styles.attemptText}>
            Failed attempts:{' '}
            {failedAttempts} of{' '}
            {MAX_LOGIN_ATTEMPTS}
          </Text>
        ) : null}

        {isLockedOut ? (
          <View style={styles.lockoutBox}>
            <Text
              style={
                styles.lockoutTitle
              }
            >
              Too many login attempts
            </Text>

            <Text
              style={styles.lockoutText}
            >
              Please restart the app
              and try again later.
            </Text>
          </View>
        ) : (
          <TouchableOpacity
            style={[
              styles.loginButton,
              loading
                ? styles.disabledButton
                : null,
            ]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator
                color="#ffffff"
              />
            ) : (
              <Text
                style={
                  styles.loginButtonText
                }
              >
                Log In
              </Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: '#ffffff',
  },
  form: {
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
    textAlign: 'center',
    marginBottom: 32,
    color: '#555555',
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#aaaaaa',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 6,
    backgroundColor: '#ffffff',
  },
  inputError: {
    borderColor: '#b00020',
    borderWidth: 2,
  },
  errorText: {
    color: '#b00020',
    fontSize: 13,
    marginBottom: 12,
  },
  attemptText: {
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 12,
    color: '#555555',
  },
  loginButton: {
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
    backgroundColor: '#222222',
  },
  disabledButton: {
    opacity: 0.6,
  },
  loginButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  lockoutBox: {
    borderWidth: 1,
    borderColor: '#b00020',
    borderRadius: 8,
    padding: 16,
    marginTop: 12,
    backgroundColor: '#fff5f5',
  },
  lockoutTitle: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 6,
    color: '#b00020',
  },
  lockoutText: {
    textAlign: 'center',
    color: '#555555',
  },
});