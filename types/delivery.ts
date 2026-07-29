export type DeliveryMode = 'normal' | 'recovered';

export type StoredDelivery = {
  id: string;
  barcodes: string[];
  lastName: string;
  notes: string;
  photoUri: string | null;
  signatureUri: string | null;
  latitude: number | null;
  longitude: number | null;
  createdAt: string;
};

export type QueuedDelivery = StoredDelivery & {
  queuedAt: string;
  uploadAttempts: number;
  lastError?: string;
};

export const createEmptyDelivery = (): StoredDelivery => ({
  id: `${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 10)}`,
  barcodes: [],
  lastName: '',
  notes: '',
  photoUri: null,
  signatureUri: null,
  latitude: null,
  longitude: null,
  createdAt: new Date().toISOString(),
});

export const deliveryHasInformation = (
  delivery: StoredDelivery
): boolean => {
  return (
    delivery.barcodes.length > 0 ||
    delivery.lastName.trim().length > 0 ||
    delivery.notes.trim().length > 0 ||
    Boolean(delivery.photoUri) ||
    Boolean(delivery.signatureUri)
  );
};