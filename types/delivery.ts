export type DeliveryMode =
  | 'normal'
  | 'recovered';

export type Carrier =
  | 'usps'
  | 'ups'
  | 'fedex'
  | 'amazon'
  | 'gofo'
  | 'ontrac'
  | 'custom'
  | 'gls'
  | 'Distribution';

export type ScannedPackage = {
  rawBarcode: string;
  trackingNumber: string;
  carrier: Carrier;
  scannedAt: string;
};

export type StoredDelivery = {
  id: string;
  packages: ScannedPackage[];

  lastName: string;
  notes: string;

  photoUri: string | null;
  signatureUri: string | null;

  latitude: number | null;
  longitude: number | null;

  createdAt: string;
};

export type QueuedDelivery =
  StoredDelivery & {
    queuedAt: string;
    uploadAttempts: number;
    lastError?: string;
  };

export const createEmptyDelivery =
  (): StoredDelivery => ({
    id: `${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 10)}`,

    packages: [],

    lastName: '',
    notes: '',

    photoUri: null,
    signatureUri: null,

    latitude: null,
    longitude: null,

    createdAt:
      new Date().toISOString(),
  });

export const deliveryHasInformation =
  (
    delivery: StoredDelivery
  ): boolean => {
    return (
      delivery.packages.length >
        0 ||
      delivery.lastName
        .trim().length > 0 ||
      delivery.notes.trim()
        .length > 0 ||
      Boolean(
        delivery.photoUri
      ) ||
      Boolean(
        delivery.signatureUri
      )
    );
  };

/*
 * Converts deliveries saved by the
 * previous version:
 *
 * barcodes: string[]
 *
 * into:
 *
 * packages: ScannedPackage[]
 *
 * so existing saved deliveries
 * continue working after the update.
 */
export const normalizeStoredDelivery =
  (
    value: unknown
  ): StoredDelivery | null => {
    if (
      !value ||
      typeof value !== 'object'
    ) {
      return null;
    }

    const source =
      value as Partial<StoredDelivery> & {
        barcodes?: unknown;
      };

    let packages: ScannedPackage[] =
      [];

    if (
      Array.isArray(
        source.packages
      )
    ) {
      packages =
        source.packages.filter(
          (
            item
          ): item is ScannedPackage => {
            if (
              !item ||
              typeof item !==
                'object'
            ) {
              return false;
            }

            const candidate =
              item as Partial<ScannedPackage>;

            return (
              typeof candidate.rawBarcode ===
                'string' &&
              typeof candidate.trackingNumber ===
                'string' &&
              typeof candidate.carrier ===
                'string'
            );
          }
        );
    } else if (
      Array.isArray(
        source.barcodes
      )
    ) {
      packages =
        source.barcodes
          .filter(
            (
              barcode
            ): barcode is string =>
              typeof barcode ===
              'string'
          )
          .map((barcode) => ({
            rawBarcode: barcode,
            trackingNumber:
              barcode,
            carrier: 'custom',
            scannedAt:
              typeof source.createdAt ===
              'string'
                ? source.createdAt
                : new Date().toISOString(),
          }));
    }

    return {
      id:
        typeof source.id ===
        'string'
          ? source.id
          : `${Date.now()}-${Math.random()
              .toString(36)
              .slice(2, 10)}`,

      packages,

      lastName:
        typeof source.lastName ===
        'string'
          ? source.lastName
          : '',

      notes:
        typeof source.notes ===
        'string'
          ? source.notes
          : '',

      photoUri:
        typeof source.photoUri ===
        'string'
          ? source.photoUri
          : null,

      signatureUri:
        typeof source.signatureUri ===
        'string'
          ? source.signatureUri
          : null,

      latitude:
        typeof source.latitude ===
        'number'
          ? source.latitude
          : null,

      longitude:
        typeof source.longitude ===
        'number'
          ? source.longitude
          : null,

      createdAt:
        typeof source.createdAt ===
        'string'
          ? source.createdAt
          : new Date().toISOString(),
    };
  };