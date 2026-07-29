import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';

import {
  QueuedDelivery,
  StoredDelivery,
} from '../types/delivery';

const ACTIVE_DELIVERY_KEY =
  '@packageTracker/activeDelivery';

const DELIVERY_QUEUE_KEY =
  '@packageTracker/deliveryQueue';

const DELIVERY_DIRECTORY =
  `${FileSystem.documentDirectory}deliveries/`;

const ensureDeliveryDirectory = async (
  deliveryId: string
): Promise<string> => {
  const rootInfo = await FileSystem.getInfoAsync(
    DELIVERY_DIRECTORY
  );

  if (!rootInfo.exists) {
    await FileSystem.makeDirectoryAsync(
      DELIVERY_DIRECTORY,
      {
        intermediates: true,
      }
    );
  }

  const deliveryDirectory =
    `${DELIVERY_DIRECTORY}${deliveryId}/`;

  const deliveryInfo = await FileSystem.getInfoAsync(
    deliveryDirectory
  );

  if (!deliveryInfo.exists) {
    await FileSystem.makeDirectoryAsync(
      deliveryDirectory,
      {
        intermediates: true,
      }
    );
  }

  return deliveryDirectory;
};

const getFileExtension = (
  uri: string,
  fallback: string
): string => {
  const cleanUri = uri.split('?')[0];
  const match = cleanUri.match(/\.([a-zA-Z0-9]+)$/);

  return match?.[1]?.toLowerCase() ?? fallback;
};

export const persistDeliveryFile = async (
  sourceUri: string,
  deliveryId: string,
  fileName: 'photo' | 'signature'
): Promise<string> => {
  const directory =
    await ensureDeliveryDirectory(deliveryId);

  const fallbackExtension =
    fileName === 'photo' ? 'jpg' : 'png';

  const extension = getFileExtension(
    sourceUri,
    fallbackExtension
  );

  const destinationUri =
    `${directory}${fileName}.${extension}`;

  if (sourceUri === destinationUri) {
    return destinationUri;
  }

  const existingDestination =
    await FileSystem.getInfoAsync(destinationUri);

  if (existingDestination.exists) {
    await FileSystem.deleteAsync(destinationUri, {
      idempotent: true,
    });
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
  await AsyncStorage.setItem(
    ACTIVE_DELIVERY_KEY,
    JSON.stringify(delivery)
  );
};

export const getActiveDelivery =
  async (): Promise<StoredDelivery | null> => {
    const value = await AsyncStorage.getItem(
      ACTIVE_DELIVERY_KEY
    );

    if (!value) {
      return null;
    }

    try {
      return JSON.parse(value) as StoredDelivery;
    } catch {
      await AsyncStorage.removeItem(
        ACTIVE_DELIVERY_KEY
      );

      return null;
    }
  };

export const removeActiveDelivery =
  async (): Promise<void> => {
    await AsyncStorage.removeItem(
      ACTIVE_DELIVERY_KEY
    );
  };

export const getQueuedDeliveries =
  async (): Promise<QueuedDelivery[]> => {
    const value = await AsyncStorage.getItem(
      DELIVERY_QUEUE_KEY
    );

    if (!value) {
      return [];
    }

    try {
      const parsed = JSON.parse(value);

      return Array.isArray(parsed)
        ? (parsed as QueuedDelivery[])
        : [];
    } catch {
      await AsyncStorage.removeItem(
        DELIVERY_QUEUE_KEY
      );

      return [];
    }
  };

export const saveQueuedDeliveries = async (
  deliveries: QueuedDelivery[]
): Promise<void> => {
  await AsyncStorage.setItem(
    DELIVERY_QUEUE_KEY,
    JSON.stringify(deliveries)
  );
};

export const addDeliveryToQueue = async (
  delivery: StoredDelivery,
  error?: string
): Promise<QueuedDelivery> => {
  const queue = await getQueuedDeliveries();

  const existingIndex = queue.findIndex(
    (item) => item.id === delivery.id
  );

  const queuedDelivery: QueuedDelivery = {
    ...delivery,
    queuedAt: new Date().toISOString(),
    uploadAttempts:
      existingIndex >= 0
        ? queue[existingIndex].uploadAttempts
        : 0,
    lastError: error,
  };

  if (existingIndex >= 0) {
    queue[existingIndex] = queuedDelivery;
  } else {
    queue.push(queuedDelivery);
  }

  await saveQueuedDeliveries(queue);

  return queuedDelivery;
};

export const updateQueuedDelivery = async (
  delivery: QueuedDelivery
): Promise<void> => {
  const queue = await getQueuedDeliveries();

  const updatedQueue = queue.map((item) =>
    item.id === delivery.id ? delivery : item
  );

  await saveQueuedDeliveries(updatedQueue);
};

export const removeQueuedDelivery = async (
  deliveryId: string
): Promise<void> => {
  const queue = await getQueuedDeliveries();

  const updatedQueue = queue.filter(
    (delivery) => delivery.id !== deliveryId
  );

  await saveQueuedDeliveries(updatedQueue);
};

export const deleteDeliveryFiles = async (
  deliveryId: string
): Promise<void> => {
  const directory =
    `${DELIVERY_DIRECTORY}${deliveryId}/`;

  await FileSystem.deleteAsync(directory, {
    idempotent: true,
  });
};