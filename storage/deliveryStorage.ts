import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';

import { getCurrentAccountKey } from './accountStorage';

import {
  normalizeStoredDelivery,
  QueuedDelivery,
  StoredDelivery,
} from '../types/delivery';

const STORAGE_PREFIX = '@packageTracker';

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

const getSafeAccountName = (
  accountKey: string
): string => {
  return encodeURIComponent(accountKey);
};

const getActiveDeliveryKey = (
  accountKey: string
): string => {
  return (
    `${STORAGE_PREFIX}/` +
    `${getSafeAccountName(accountKey)}/` +
    'activeDelivery'
  );
};

const getQueueKey = (
  accountKey: string
): string => {
  return (
    `${STORAGE_PREFIX}/` +
    `${getSafeAccountName(accountKey)}/` +
    'deliveryQueue'
  );
};

const getAccountDirectory = (
  accountKey: string
): string => {
  return (
    `${DELIVERY_DIRECTORY}` +
    `${getSafeAccountName(accountKey)}/`
  );
};

const ensureDirectory = async (
  directory: string
): Promise<void> => {
  const info =
    await FileSystem.getInfoAsync(directory);

  if (!info.exists) {
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
  await ensureDirectory(DELIVERY_DIRECTORY);

  const accountDirectory =
    getAccountDirectory(accountKey);

  await ensureDirectory(accountDirectory);

  const deliveryDirectory =
    `${accountDirectory}${deliveryId}/`;

  await ensureDirectory(deliveryDirectory);

  return deliveryDirectory;
};

const getExtension = (
  uri: string,
  fallback: string
): string => {
  const cleanUri =
    uri.split('?')[0];

  const match =
    cleanUri.match(/\.([A-Za-z0-9]+)$/);

  return (
    match?.[1]?.toLowerCase() ??
    fallback
  );
};

export const persistDeliveryFile =
  async (
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

    const extension =
      getExtension(
        sourceUri,
        fileName === 'photo'
          ? 'jpg'
          : 'png'
      );

    const destination =
      `${directory}${fileName}.${extension}`;

    if (sourceUri === destination) {
      return destination;
    }

    await FileSystem.deleteAsync(
      destination,
      {
        idempotent: true,
      }
    );

    await FileSystem.copyAsync({
      from: sourceUri,
      to: destination,
    });

    return destination;
  };

export const saveActiveDelivery =
  async (
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
      const normalized =
        normalizeStoredDelivery(
          JSON.parse(value)
        );

      if (!normalized) {
        await AsyncStorage.removeItem(key);
      }

      return normalized;
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
      getQueueKey(accountKey);

    const value =
      await AsyncStorage.getItem(key);

    if (!value) {
      return [];
    }

    try {
      const parsed =
        JSON.parse(value);

      if (!Array.isArray(parsed)) {
        return [];
      }

      const deliveries: QueuedDelivery[] = [];

for (const item of parsed) {
  const normalized =
    normalizeStoredDelivery(item);

  if (!normalized) {
    continue;
  }

  const queueItem =
    item as Partial<QueuedDelivery>;

  const queuedDelivery:
    QueuedDelivery = {
      ...normalized,

      queuedAt:
        typeof queueItem.queuedAt ===
        'string'
          ? queueItem.queuedAt
          : new Date().toISOString(),

      uploadAttempts:
        typeof queueItem.uploadAttempts ===
        'number'
          ? queueItem.uploadAttempts
          : 0,
  };

  if (
    typeof queueItem.lastError ===
    'string'
  ) {
    queuedDelivery.lastError =
      queueItem.lastError;
  }

  deliveries.push(
    queuedDelivery
  );
}

return deliveries;
    } catch {
      await AsyncStorage.removeItem(key);
      return [];
    }
  };

export const saveQueuedDeliveries =
  async (
    deliveries: QueuedDelivery[]
  ): Promise<void> => {
    const accountKey =
      await getRequiredAccountKey();

    await AsyncStorage.setItem(
      getQueueKey(accountKey),
      JSON.stringify(deliveries)
    );
  };

export const addDeliveryToQueue =
  async (
    delivery: StoredDelivery,
    error?: string
  ): Promise<QueuedDelivery> => {
    const queue =
      await getQueuedDeliveries();

    const index =
      queue.findIndex(
        (item) =>
          item.id === delivery.id
      );

    const existing =
      index >= 0
        ? queue[index]
        : null;

    const queuedDelivery: QueuedDelivery =
      {
        ...delivery,

        queuedAt:
          existing?.queuedAt ??
          new Date().toISOString(),

        uploadAttempts:
          existing?.uploadAttempts ??
          0,

        lastError: error,
      };

    if (index >= 0) {
      queue[index] =
        queuedDelivery;
    } else {
      queue.push(
        queuedDelivery
      );
    }

    await saveQueuedDeliveries(
      queue
    );

    return queuedDelivery;
  };

export const updateQueuedDelivery =
  async (
    delivery: QueuedDelivery
  ): Promise<void> => {
    const queue =
      await getQueuedDeliveries();

    await saveQueuedDeliveries(
      queue.map((item) =>
        item.id === delivery.id
          ? delivery
          : item
      )
    );
  };

export const removeQueuedDelivery =
  async (
    deliveryId: string
  ): Promise<void> => {
    const queue =
      await getQueuedDeliveries();

    await saveQueuedDeliveries(
      queue.filter(
        (item) =>
          item.id !== deliveryId
      )
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

    await FileSystem.deleteAsync(
      `${getAccountDirectory(
        accountKey
      )}${deliveryId}/`,
      {
        idempotent: true,
      }
    );
  };