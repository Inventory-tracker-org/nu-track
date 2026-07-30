import AsyncStorage from '@react-native-async-storage/async-storage';

import * as FileSystem from 'expo-file-system/legacy';

import {
  getCurrentAccountKey,
} from './accountStorage';

import {
  QueuedDelivery,
  StoredDelivery,
} from '../types/delivery';

const STORAGE_PREFIX =
  '@packageTracker';

const LEGACY_ACTIVE_DELIVERY_KEY =
  '@packageTracker/activeDelivery';

const LEGACY_DELIVERY_QUEUE_KEY =
  '@packageTracker/deliveryQueue';

const DELIVERY_DIRECTORY =
  `${FileSystem.documentDirectory}deliveries/`;

const getRequiredAccountKey =
  async (): Promise<string> => {
    const accountKey =
      await getCurrentAccountKey();

    if (!accountKey) {
      throw new Error(
        'No logged-in account was found.'
      );
    }

    return accountKey;
  };

const getSafeAccountDirectoryName = (
  accountKey: string
): string => {
  return encodeURIComponent(accountKey);
};

const getActiveDeliveryKey = (
  accountKey: string
): string => {
  return (
    `${STORAGE_PREFIX}/` +
    `${getSafeAccountDirectoryName(accountKey)}/` +
    'activeDelivery'
  );
};

const getDeliveryQueueKey = (
  accountKey: string
): string => {
  return (
    `${STORAGE_PREFIX}/` +
    `${getSafeAccountDirectoryName(accountKey)}/` +
    'deliveryQueue'
  );
};

const getAccountDeliveryDirectory = (
  accountKey: string
): string => {
  return (
    `${DELIVERY_DIRECTORY}` +
    `${getSafeAccountDirectoryName(accountKey)}/`
  );
};

const ensureDirectory = async (
  directory: string
): Promise<void> => {
  const information =
    await FileSystem.getInfoAsync(directory);

  if (!information.exists) {
    await FileSystem.makeDirectoryAsync(
      directory,
      {
        intermediates: true,
      }
    );
  }
};

const ensureDeliveryDirectory = async (
  accountKey: string,
  deliveryId: string
): Promise<string> => {
  await ensureDirectory(
    DELIVERY_DIRECTORY
  );

  const accountDirectory =
    getAccountDeliveryDirectory(accountKey);

  await ensureDirectory(
    accountDirectory
  );

  const deliveryDirectory =
    `${accountDirectory}${deliveryId}/`;

  await ensureDirectory(
    deliveryDirectory
  );

  return deliveryDirectory;
};

const getFileExtension = (
  uri: string,
  fallback: string
): string => {
  const cleanUri = uri.split('?')[0];

  const match =
    cleanUri.match(/\.([a-zA-Z0-9]+)$/);

  return (
    match?.[1]?.toLowerCase() ??
    fallback
  );
};

export const persistDeliveryFile = async (
  sourceUri: string,
  deliveryId: string,
  fileName: 'photo' | 'signature'
): Promise<string> => {
  const accountKey =
    await getRequiredAccountKey();

  const directory =
    await ensureDeliveryDirectory(
      accountKey,
      deliveryId
    );

  const fallbackExtension =
    fileName === 'photo'
      ? 'jpg'
      : 'png';

  const extension =
    getFileExtension(
      sourceUri,
      fallbackExtension
    );

  const destinationUri =
    `${directory}${fileName}.${extension}`;

  if (sourceUri === destinationUri) {
    return destinationUri;
  }

  const existingDestination =
    await FileSystem.getInfoAsync(
      destinationUri
    );

  if (existingDestination.exists) {
    await FileSystem.deleteAsync(
      destinationUri,
      {
        idempotent: true,
      }
    );
  }

  await FileSystem.copyAsync({
    from: sourceUri,
    to: destinationUri,
  });

  return destinationUri;
};

export const saveActiveDelivery = async (
  delivery: StoredDelivery
): Promise<void> => {
  const accountKey =
    await getRequiredAccountKey();

  await AsyncStorage.setItem(
    getActiveDeliveryKey(accountKey),
    JSON.stringify(delivery)
  );
};

export const getActiveDelivery =
  async (): Promise<StoredDelivery | null> => {
    const accountKey =
      await getCurrentAccountKey();

    if (!accountKey) {
      return null;
    }

    const key =
      getActiveDeliveryKey(accountKey);

    const value =
      await AsyncStorage.getItem(key);

    if (!value) {
      return null;
    }

    try {
      return JSON.parse(
        value
      ) as StoredDelivery;
    } catch {
      await AsyncStorage.removeItem(key);

      return null;
    }
  };

export const removeActiveDelivery =
  async (): Promise<void> => {
    const accountKey =
      await getCurrentAccountKey();

    if (!accountKey) {
      return;
    }

    await AsyncStorage.removeItem(
      getActiveDeliveryKey(accountKey)
    );
  };

export const getQueuedDeliveries =
  async (): Promise<QueuedDelivery[]> => {
    const accountKey =
      await getCurrentAccountKey();

    if (!accountKey) {
      return [];
    }

    const key =
      getDeliveryQueueKey(accountKey);

    const value =
      await AsyncStorage.getItem(key);

    if (!value) {
      return [];
    }

    try {
      const parsed = JSON.parse(value);

      return Array.isArray(parsed)
        ? parsed as QueuedDelivery[]
        : [];
    } catch {
      await AsyncStorage.removeItem(key);

      return [];
    }
  };

export const saveQueuedDeliveries = async (
  deliveries: QueuedDelivery[]
): Promise<void> => {
  const accountKey =
    await getRequiredAccountKey();

  await AsyncStorage.setItem(
    getDeliveryQueueKey(accountKey),
    JSON.stringify(deliveries)
  );
};

export const addDeliveryToQueue = async (
  delivery: StoredDelivery,
  error?: string
): Promise<QueuedDelivery> => {
  const queue =
    await getQueuedDeliveries();

  const existingIndex =
    queue.findIndex(
      (item) =>
        item.id === delivery.id
    );

  const existingDelivery =
    existingIndex >= 0
      ? queue[existingIndex]
      : null;

  const queuedDelivery:
    QueuedDelivery = {
      ...delivery,
      queuedAt:
        existingDelivery?.queuedAt ??
        new Date().toISOString(),
      uploadAttempts:
        existingDelivery
          ?.uploadAttempts ?? 0,
      lastError: error,
    };

  if (existingIndex >= 0) {
    queue[existingIndex] =
      queuedDelivery;
  } else {
    queue.push(queuedDelivery);
  }

  await saveQueuedDeliveries(queue);

  return queuedDelivery;
};

export const updateQueuedDelivery =
  async (
    delivery: QueuedDelivery
  ): Promise<void> => {
    const queue =
      await getQueuedDeliveries();

    const updatedQueue =
      queue.map((item) =>
        item.id === delivery.id
          ? delivery
          : item
      );

    await saveQueuedDeliveries(
      updatedQueue
    );
  };

export const removeQueuedDelivery =
  async (
    deliveryId: string
  ): Promise<void> => {
    const queue =
      await getQueuedDeliveries();

    const updatedQueue =
      queue.filter(
        (delivery) =>
          delivery.id !== deliveryId
      );

    await saveQueuedDeliveries(
      updatedQueue
    );
  };

export const deleteDeliveryFiles =
  async (
    deliveryId: string
  ): Promise<void> => {
    const accountKey =
      await getCurrentAccountKey();

    if (!accountKey) {
      return;
    }

    const directory =
      `${getAccountDeliveryDirectory(
        accountKey
      )}${deliveryId}/`;

    await FileSystem.deleteAsync(
      directory,
      {
        idempotent: true,
      }
    );
  };

/*
 * This removes data created by the old,
 * non-account-scoped storage version.
 *
 * Call this once only if you intentionally
 * want to delete the old shared queue.
 */
export const clearLegacySharedStorage =
  async (): Promise<void> => {
    await AsyncStorage.multiRemove([
      LEGACY_ACTIVE_DELIVERY_KEY,
      LEGACY_DELIVERY_QUEUE_KEY,
    ]);
  };