import {
  createContext,
  ReactNode,
  useContext,
  useMemo,
  useState,
} from 'react';

type PackageScanContextValue = {
  barcodes: string[];
  addBarcode: (barcode: string) => boolean;
  removeBarcode: (index: number) => void;
  clearBarcodes: () => void;
};

const PackageScanContext =
  createContext<PackageScanContextValue | null>(null);

type PackageScanProviderProps = {
  children: ReactNode;
};

export function PackageScanProvider({
  children,
}: PackageScanProviderProps) {
  const [barcodes, setBarcodes] = useState<string[]>([]);

  const addBarcode = (barcode: string): boolean => {
    const cleanedBarcode = barcode.trim();

    if (!cleanedBarcode) {
      return false;
    }

    if (barcodes.includes(cleanedBarcode)) {
      return false;
    }

    setBarcodes((currentBarcodes) => [
      ...currentBarcodes,
      cleanedBarcode,
    ]);

    return true;
  };

  const removeBarcode = (indexToRemove: number) => {
    setBarcodes((currentBarcodes) =>
      currentBarcodes.filter(
        (_, index) => index !== indexToRemove
      )
    );
  };

  const clearBarcodes = () => {
    setBarcodes([]);
  };

  const value = useMemo(
    () => ({
      barcodes,
      addBarcode,
      removeBarcode,
      clearBarcodes,
    }),
    [barcodes]
  );

  return (
    <PackageScanContext.Provider value={value}>
      {children}
    </PackageScanContext.Provider>
  );
}

export function usePackageScan() {
  const context = useContext(PackageScanContext);

  if (!context) {
    throw new Error(
      'usePackageScan must be used inside PackageScanProvider.'
    );
  }

  return context;
}