import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { Image } from 'react-native';

import {
  manipulateAsync,
  SaveFormat,
} from 'expo-image-manipulator';

import {
  addDeliveryToQueue,
  deleteDeliveryFiles,
  getActiveDelivery,
  persistDeliveryFile,
  removeActiveDelivery,
  saveActiveDelivery,
} from '../storage/deliveryStorage';

import {
  createEmptyDelivery,
  deliveryHasInformation,
  DeliveryMode,
  ScannedPackage,
  StoredDelivery,
} from '../types/delivery';

const MAX_PHOTO_WIDTH = 1600;
const PHOTO_COMPRESSION = 0.65;

type DeliveryContextValue = {
  delivery: StoredDelivery;
  mode: DeliveryMode;
  loading: boolean;
  hasActiveDelivery: boolean;

  setMode: (mode: DeliveryMode) => void;
  startNewDelivery: () => Promise<void>;
  recoverActiveDelivery: () => Promise<boolean>;
  releaseCurrentAccount: () => void;

  addPackage: (item: ScannedPackage) => boolean;
  removePackage: (index: number) => void;

  setLastName: (value: string) => void;
  setNotes: (value: string) => void;
  setLocation: (
    latitude: number | null,
    longitude: number | null
  ) => void;

  savePhoto: (uri: string) => Promise<void>;
  saveSignature: (uri: string) => Promise<void>;

  discardCurrentDelivery: () => Promise<void>;
  queueCurrentDelivery: (error?: string) => Promise<void>;
  clearCurrentDeliveryAfterUpload: () => Promise<void>;
};

const DeliveryContext =
  createContext<DeliveryContextValue | null>(null);

const getImageDimensions = (
  uri: string
): Promise<{ width: number; height: number }> => {
  return new Promise((resolve, reject) => {
    Image.getSize(
      uri,
      (width, height) => resolve({ width, height }),
      reject
    );
  });
};

const compressDeliveryPhoto = async (
  uri: string
): Promise<string> => {
  let actions: { resize: { width: number } }[] = [];

  try {
    const dimensions = await getImageDimensions(uri);

    if (dimensions.width > MAX_PHOTO_WIDTH) {
      actions = [
        {
          resize: {
            width: MAX_PHOTO_WIDTH,
          },
        },
      ];
    }
  } catch (error) {
    console.warn('Unable to read photo dimensions:', error);
  }

  const result = await manipulateAsync(uri, actions, {
    compress: PHOTO_COMPRESSION,
    format: SaveFormat.JPEG,
  });

  return result.uri;
};

export function DeliveryProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [delivery, setDelivery] =
    useState<StoredDelivery>(createEmptyDelivery());

  const [mode, setMode] =
    useState<DeliveryMode>('normal');

  const [loading, setLoading] = useState(false);

  const [persistenceEnabled, setPersistenceEnabled] =
    useState(false);

  useEffect(() => {
    if (!persistenceEnabled) {
      return;
    }

    const persist = async () => {
      if (deliveryHasInformation(delivery)) {
        await saveActiveDelivery(delivery);
      } else {
        await removeActiveDelivery();
      }
    };

    persist().catch((error) => {
      console.error('Unable to save active delivery:', error);
    });
  }, [delivery, persistenceEnabled]);

  const startNewDelivery = async () => {
    const previousDelivery = delivery;

    await removeActiveDelivery();

    if (!deliveryHasInformation(previousDelivery)) {
      await deleteDeliveryFiles(previousDelivery.id);
    }

    setDelivery(createEmptyDelivery());
    setMode('normal');
    setPersistenceEnabled(true);
  };

  const recoverActiveDelivery = useCallback(async () => {
    setLoading(true);

    try {
      const storedDelivery = await getActiveDelivery();

      if (
        !storedDelivery ||
        !deliveryHasInformation(storedDelivery)
      ) {
        setDelivery(createEmptyDelivery());
        setMode('normal');
        setPersistenceEnabled(true);
        return false;
      }

      setDelivery(storedDelivery);
      setMode('recovered');
      setPersistenceEnabled(true);
      return true;
    } finally {
      setLoading(false);
    }
  }, []);

  const releaseCurrentAccount = () => {
    setPersistenceEnabled(false);
    setDelivery(createEmptyDelivery());
    setMode('normal');
  };

  const addPackage = (item: ScannedPackage): boolean => {
    const duplicate = delivery.packages.some(
      (current) =>
        current.trackingNumber === item.trackingNumber
    );

    if (duplicate) {
      return false;
    }

    setDelivery((current) => ({
      ...current,
      packages: [...current.packages, item],
    }));

    return true;
  };

  const removePackage = (index: number) => {
    setDelivery((current) => ({
      ...current,
      packages: current.packages.filter(
        (_, currentIndex) => currentIndex !== index
      ),
    }));
  };

  const setLastName = (value: string) => {
    setDelivery((current) => ({
      ...current,
      lastName: value,
    }));
  };

  const setNotes = (value: string) => {
    setDelivery((current) => ({
      ...current,
      notes: value,
    }));
  };

  const setLocation = (
    latitude: number | null,
    longitude: number | null
  ) => {
    setDelivery((current) => ({
      ...current,
      latitude,
      longitude,
    }));
  };

  const savePhoto = async (uri: string) => {
    const compressedUri = await compressDeliveryPhoto(uri);

    const persistedUri = await persistDeliveryFile(
      compressedUri,
      delivery.id,
      'photo'
    );

    setDelivery((current) => ({
      ...current,
      photoUri: persistedUri,
    }));
  };

  const saveSignature = async (uri: string) => {
    const persistedUri = await persistDeliveryFile(
      uri,
      delivery.id,
      'signature'
    );

    setDelivery((current) => ({
      ...current,
      signatureUri: persistedUri,
    }));
  };

  const discardCurrentDelivery = async () => {
    const deliveryId = delivery.id;

    setPersistenceEnabled(false);
    await removeActiveDelivery();
    await deleteDeliveryFiles(deliveryId);

    setDelivery(createEmptyDelivery());
    setMode('normal');
    setPersistenceEnabled(true);
  };

  const queueCurrentDelivery = async (error?: string) => {
    setPersistenceEnabled(false);

    if (deliveryHasInformation(delivery)) {
      await addDeliveryToQueue(delivery, error);
    }

    await removeActiveDelivery();

    setDelivery(createEmptyDelivery());
    setMode('normal');
    setPersistenceEnabled(true);
  };

  const clearCurrentDeliveryAfterUpload = async () => {
    const deliveryId = delivery.id;

    setPersistenceEnabled(false);
    await removeActiveDelivery();
    await deleteDeliveryFiles(deliveryId);

    setDelivery(createEmptyDelivery());
    setMode('normal');
    setPersistenceEnabled(true);
  };

  const value = useMemo(
    () => ({
      delivery,
      mode,
      loading,
      hasActiveDelivery: deliveryHasInformation(delivery),

      setMode,
      startNewDelivery,
      recoverActiveDelivery,
      releaseCurrentAccount,

      addPackage,
      removePackage,

      setLastName,
      setNotes,
      setLocation,

      savePhoto,
      saveSignature,

      discardCurrentDelivery,
      queueCurrentDelivery,
      clearCurrentDeliveryAfterUpload,
    }),
    [delivery, mode, loading, recoverActiveDelivery]
  );

  return (
    <DeliveryContext.Provider value={value}>
      {children}
    </DeliveryContext.Provider>
  );
}

export function useDelivery() {
  const context = useContext(DeliveryContext);

  if (!context) {
    throw new Error(
      'useDelivery must be used inside DeliveryProvider.'
    );
  }

  return context;
}
