import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  Image,
} from 'react-native';

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
  StoredDelivery,
} from '../types/delivery';

const MAX_PHOTO_WIDTH = 1600;
const PHOTO_COMPRESSION = 0.65;

type DeliveryContextValue = {
  delivery: StoredDelivery;
  mode: DeliveryMode;
  loading: boolean;
  hasActiveDelivery: boolean;

  setMode: (
    mode: DeliveryMode
  ) => void;

  startNewDelivery:
    () => Promise<void>;

  recoverActiveDelivery:
    () => Promise<boolean>;

  releaseCurrentAccount:
    () => void;

  addBarcode: (
    barcode: string
  ) => boolean;

  removeBarcode: (
    index: number
  ) => void;

  setLastName: (
    value: string
  ) => void;

  setNotes: (
    value: string
  ) => void;

  setLocation: (
    latitude: number | null,
    longitude: number | null
  ) => void;

  savePhoto: (
    uri: string
  ) => Promise<void>;

  saveSignature: (
    uri: string
  ) => Promise<void>;

  discardCurrentDelivery:
    () => Promise<void>;

  queueCurrentDelivery: (
    error?: string
  ) => Promise<void>;

  clearCurrentDeliveryAfterUpload:
    () => Promise<void>;
};

const DeliveryContext =
  createContext<
    DeliveryContextValue | null
  >(null);

type DeliveryProviderProps = {
  children: ReactNode;
};

const getImageDimensions = (
  uri: string
): Promise<{
  width: number;
  height: number;
}> => {
  return new Promise(
    (resolve, reject) => {
      Image.getSize(
        uri,
        (width, height) => {
          resolve({
            width,
            height,
          });
        },
        (error) => {
          reject(error);
        }
      );
    }
  );
};

const compressDeliveryPhoto =
  async (
    uri: string
  ): Promise<string> => {
    let actions:
      {
        resize: {
          width: number;
        };
      }[] = [];

    try {
      const dimensions =
        await getImageDimensions(uri);

      if (
        dimensions.width >
        MAX_PHOTO_WIDTH
      ) {
        actions = [
          {
            resize: {
              width:
                MAX_PHOTO_WIDTH,
            },
          },
        ];
      }
    } catch (error) {
      console.warn(
        'Unable to read photo dimensions:',
        error
      );
    }

    const compressedImage =
      await manipulateAsync(
        uri,
        actions,
        {
          compress:
            PHOTO_COMPRESSION,
          format:
            SaveFormat.JPEG,
        }
      );

    return compressedImage.uri;
  };

export function DeliveryProvider({
  children,
}: DeliveryProviderProps) {
  const [delivery, setDelivery] =
    useState<StoredDelivery>(
      createEmptyDelivery()
    );

  const [mode, setMode] =
    useState<DeliveryMode>(
      'normal'
    );

  const [loading, setLoading] =
    useState(false);

  const [persistenceEnabled,
    setPersistenceEnabled] =
    useState(false);

  useEffect(() => {
    if (!persistenceEnabled) {
      return;
    }

    const persist = async () => {
      if (
        deliveryHasInformation(
          delivery
        )
      ) {
        await saveActiveDelivery(
          delivery
        );
      } else {
        await removeActiveDelivery();
      }
    };

    persist().catch((error) => {
      console.error(
        'Unable to save active delivery:',
        error
      );
    });
  }, [
    delivery,
    persistenceEnabled,
  ]);

  const startNewDelivery =
    async (): Promise<void> => {
      const previousDelivery =
        delivery;

      await removeActiveDelivery();

      if (
        !deliveryHasInformation(
          previousDelivery
        )
      ) {
        await deleteDeliveryFiles(
          previousDelivery.id
        );
      }

      setDelivery(
        createEmptyDelivery()
      );

      setMode('normal');
      setPersistenceEnabled(true);
    };

  const recoverActiveDelivery =
    useCallback(
      async (): Promise<boolean> => {
        setLoading(true);

        try {
          const storedDelivery =
            await getActiveDelivery();

          if (
            !storedDelivery ||
            !deliveryHasInformation(
              storedDelivery
            )
          ) {
            setDelivery(
              createEmptyDelivery()
            );

            setMode('normal');
            setPersistenceEnabled(
              true
            );

            return false;
          }

          setDelivery(
            storedDelivery
          );

          setMode('recovered');
          setPersistenceEnabled(true);

          return true;
        } finally {
          setLoading(false);
        }
      },
      []
    );

  /*
   * Clears only the React state.
   * It does not delete the current
   * account's saved delivery or queue.
   *
   * Use this during logout so another
   * account cannot see the previous
   * account's in-memory information.
   */
  const releaseCurrentAccount = () => {
    setPersistenceEnabled(false);

    setDelivery(
      createEmptyDelivery()
    );

    setMode('normal');
  };

  const addBarcode = (
    barcode: string
  ): boolean => {
    const cleanedBarcode =
      barcode
        .trim()
        .toUpperCase();

    if (
      !cleanedBarcode ||
      delivery.barcodes.includes(
        cleanedBarcode
      )
    ) {
      return false;
    }

    setDelivery((current) => ({
      ...current,
      barcodes: [
        ...current.barcodes,
        cleanedBarcode,
      ],
    }));

    return true;
  };

  const removeBarcode = (
    index: number
  ) => {
    setDelivery((current) => ({
      ...current,
      barcodes:
        current.barcodes.filter(
          (_, itemIndex) =>
            itemIndex !== index
        ),
    }));
  };

  const setLastName = (
    value: string
  ) => {
    setDelivery((current) => ({
      ...current,
      lastName: value,
    }));
  };

  const setNotes = (
    value: string
  ) => {
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

  const savePhoto = async (
    uri: string
  ): Promise<void> => {
    const compressedUri =
      await compressDeliveryPhoto(
        uri
      );

    const persistedUri =
      await persistDeliveryFile(
        compressedUri,
        delivery.id,
        'photo'
      );

    setDelivery((current) => ({
      ...current,
      photoUri:
        persistedUri,
    }));
  };

  const saveSignature = async (
    uri: string
  ): Promise<void> => {
    const persistedUri =
      await persistDeliveryFile(
        uri,
        delivery.id,
        'signature'
      );

    setDelivery((current) => ({
      ...current,
      signatureUri:
        persistedUri,
    }));
  };

  const discardCurrentDelivery =
    async (): Promise<void> => {
      const discardedId =
        delivery.id;

      setPersistenceEnabled(false);

      await removeActiveDelivery();

      await deleteDeliveryFiles(
        discardedId
      );

      setDelivery(
        createEmptyDelivery()
      );

      setMode('normal');
      setPersistenceEnabled(true);
    };

  const queueCurrentDelivery =
    async (
      error?: string
    ): Promise<void> => {
      setPersistenceEnabled(false);

      if (
        deliveryHasInformation(
          delivery
        )
      ) {
        await addDeliveryToQueue(
          delivery,
          error
        );
      }

      await removeActiveDelivery();

      setDelivery(
        createEmptyDelivery()
      );

      setMode('normal');
      setPersistenceEnabled(true);
    };

  const clearCurrentDeliveryAfterUpload =
    async (): Promise<void> => {
      const completedId =
        delivery.id;

      setPersistenceEnabled(false);

      await removeActiveDelivery();

      await deleteDeliveryFiles(
        completedId
      );

      setDelivery(
        createEmptyDelivery()
      );

      setMode('normal');
      setPersistenceEnabled(true);
    };

  const value = useMemo(
    () => ({
      delivery,
      mode,
      loading,

      hasActiveDelivery:
        deliveryHasInformation(
          delivery
        ),

      setMode,
      startNewDelivery,
      recoverActiveDelivery,
      releaseCurrentAccount,

      addBarcode,
      removeBarcode,

      setLastName,
      setNotes,
      setLocation,

      savePhoto,
      saveSignature,

      discardCurrentDelivery,
      queueCurrentDelivery,
      clearCurrentDeliveryAfterUpload,
    }),
    [
      delivery,
      mode,
      loading,
      recoverActiveDelivery,
    ]
  );

  return (
    <DeliveryContext.Provider
      value={value}
    >
      {children}
    </DeliveryContext.Provider>
  );
}

export function useDelivery() {
  const context =
    useContext(
      DeliveryContext
    );

  if (!context) {
    throw new Error(
      'useDelivery must be used inside DeliveryProvider.'
    );
  }

  return context;
}