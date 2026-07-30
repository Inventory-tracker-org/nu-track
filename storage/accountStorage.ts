import * as SecureStore from 'expo-secure-store';

const ACCOUNT_KEY = 'accountKey';

export const normalizeAccountKey = (
  email: string
): string => {
  return email.trim().toLowerCase();
};

export const saveCurrentAccountKey = async (
  email: string
): Promise<void> => {
  const normalizedEmail =
    normalizeAccountKey(email);

  if (!normalizedEmail) {
    throw new Error(
      'Cannot save an empty account identifier.'
    );
  }

  await SecureStore.setItemAsync(
    ACCOUNT_KEY,
    normalizedEmail
  );
};

export const getCurrentAccountKey =
  async (): Promise<string | null> => {
    return SecureStore.getItemAsync(
      ACCOUNT_KEY
    );
  };

export const removeCurrentAccountKey =
  async (): Promise<void> => {
    await SecureStore.deleteItemAsync(
      ACCOUNT_KEY
    );
  };