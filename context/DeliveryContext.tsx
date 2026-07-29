import {
  createContext,
  ReactNode,
  useContext,
  useMemo,
  useState,
} from 'react';

type DeliveryContextValue = {
  photoUri: string | null;
  signatureUri: string | null;
  setPhotoUri: (uri: string | null) => void;
  setSignatureUri: (uri: string | null) => void;
  clearDeliveryMedia: () => void;
};

const DeliveryContext =
  createContext<DeliveryContextValue | null>(null);

type DeliveryProviderProps = {
  children: ReactNode;
};

export function DeliveryProvider({
  children,
}: DeliveryProviderProps) {
  const [photoUri, setPhotoUri] =
    useState<string | null>(null);

  const [signatureUri, setSignatureUri] =
    useState<string | null>(null);

  const clearDeliveryMedia = () => {
    setPhotoUri(null);
    setSignatureUri(null);
  };

  const value = useMemo(
    () => ({
      photoUri,
      signatureUri,
      setPhotoUri,
      setSignatureUri,
      clearDeliveryMedia,
    }),
    [photoUri, signatureUri]
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