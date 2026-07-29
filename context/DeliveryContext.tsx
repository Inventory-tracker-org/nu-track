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

type DeliveryContextValue = {
  delivery: StoredDelivery;
  mode: DeliveryMode;
  loading: boolean;
  hasActiveDelivery: boolean;

  setMode: (mode: DeliveryMode) => void;
  startNewDelivery: () => Promise<void>;
  recoverActiveDelivery: () => Promise<boolean>;

  addBarcode: (barcode: string) => boolean;
  removeBarcode: (index: number) => void;

  setLastName: (value: string) => void;
  setNotes: (value: string) => void;
  setLocation: (
    latitude: number | null,
    longitude: number | null
  ) => void;

  savePhoto: (uri: string) => Promise<void>;
  saveSignature: (uri: string) => Promise<void>;

  discardCurrentDelivery: () => Promise<void>;
  queueCurrentDelivery: (
    error?: string
  ) => Promise<void>;

  clearCurrentDeliveryAfterUpload:
    () => Promise<void>;
};

const DeliveryContext =
  createContext<DeliveryContextValue | null>(null);

type DeliveryProviderProps = {
  children: ReactNode;
};

export function DeliveryProvider({
  children,
}: DeliveryProviderProps) {
  const [delivery, setDelivery] =
    useState<StoredDelivery>(
      createEmptyDelivery()
    );

  const [mode, setMode] =
    useState<DeliveryMode>('normal');

  const [loading, setLoading] =
    useState(true);

  const [hydrated, setHydrated] =
    useState(false);

  const hydrate = useCallback(async () => {
    try {
      const storedDelivery =
        await getActiveDelivery();

      if (
        storedDelivery &&
        deliveryHasInformation(storedDelivery)
      ) {
        setDelivery(storedDelivery);
      }
    } finally {
      setHydrated(true);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!hydrated) {
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
      console.error(
        'Unable to save active delivery:',
        error
      );
    });
  }, [delivery, hydrated]);

  const startNewDelivery = async () => {
    const previousDelivery = delivery;

    await removeActiveDelivery();

    if (
      !deliveryHasInformation(previousDelivery)
    ) {
      await deleteDeliveryFiles(
        previousDelivery.id
      );
    }

    setDelivery(createEmptyDelivery());
    setMode('normal');
  };

  const recoverActiveDelivery =
    async (): Promise<boolean> => {
      const storedDelivery =
        await getActiveDelivery();

      if (
        !storedDelivery ||
        !deliveryHasInformation(storedDelivery)
      ) {
        return false;
      }

      setDelivery(storedDelivery);
      setMode('recovered');

      return true;
    };

  const addBarcode = (
    barcode: string
  ): boolean => {
    const cleanedBarcode =
      barcode.trim().toUpperCase();

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

  const removeBarcode = (index: number) => {
    setDelivery((current) => ({
      ...current,
      barcodes: current.barcodes.filter(
        (_, itemIndex) =>
          itemIndex !== index
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

  const savePhoto = async (
    uri: string
  ) => {
    const persistedUri =
      await persistDeliveryFile(
        uri,
        delivery.id,
        'photo'
      );

    setDelivery((current) => ({
      ...current,
      photoUri: persistedUri,
    }));
  };

  const saveSignature = async (
    uri: string
  ) => {
    const persistedUri =
      await persistDeliveryFile(
        uri,
        delivery.id,
        'signature'
      );

    setDelivery((current) => ({
      ...current,
      signatureUri: persistedUri,
    }));
  };

  const discardCurrentDelivery =
    async () => {
      const discardedId = delivery.id;

      await removeActiveDelivery();
      await deleteDeliveryFiles(
        discardedId
      );

      setDelivery(createEmptyDelivery());
      setMode('normal');
    };

  const queueCurrentDelivery = async (
    error?: string
  ) => {
    if (deliveryHasInformation(delivery)) {
      await addDeliveryToQueue(
        delivery,
        error
      );
    }

    await removeActiveDelivery();

    setDelivery(createEmptyDelivery());
    setMode('normal');
  };

  const clearCurrentDeliveryAfterUpload =
    async () => {
      const completedId = delivery.id;

      await removeActiveDelivery();
      await deleteDeliveryFiles(
        completedId
      );

      setDelivery(createEmptyDelivery());
      setMode('normal');
    };

  const value = useMemo(
    () => ({
      delivery,
      mode,
      loading,
      hasActiveDelivery:
        deliveryHasInformation(delivery),

      setMode,
      startNewDelivery,
      recoverActiveDelivery,

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
    [delivery, mode, loading]
  );

  return (
    <DeliveryContext.Provider value={value}>
      {children}
    </DeliveryContext.Provider>
  );
}

export function useDelivery() {
  const context = useContext(
    DeliveryContext
  );

  if (!context) {
    throw new Error(
      'useDelivery must be used inside DeliveryProvider.'
    );
  }

  return context;
}