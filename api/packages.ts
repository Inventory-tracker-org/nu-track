import {
  Carrier,
  ScannedPackage,
} from '../types/delivery';

export type CreatePackagesInput = {
  packages: ScannedPackage[];

  date: string;
  time: string;

  comment: string;
  lastName: string;

  latitude: number | null;
  longitude: number | null;

  photoUri: string | null;
  signatureUri: string;

  token: string;
};

export type CreatePackagesResponse = {
  success: boolean;
  message?: string;

  package_count?: number;
  inserted_count?: number;
  updated_count?: number;

  barcodes?: string[];

  photo_path?: string | null;
  signature_path?: string | null;

  error?: string;
  details?: string;
};

type PackageRequestItem = {
  barcode: string;
  carrier: Carrier;
};

const getPhotoFileName = (
  uri: string
): string => {
  const extension =
    uri
      .split('?')[0]
      .match(/\.([A-Za-z0-9]+)$/)
      ?.[1]
      ?.toLowerCase();

  if (extension === 'png') {
    return 'package-photo.png';
  }

  if (extension === 'webp') {
    return 'package-photo.webp';
  }

  return 'package-photo.jpg';
};

const getPhotoMimeType = (
  uri: string
): string => {
  const extension =
    uri
      .split('?')[0]
      .match(/\.([A-Za-z0-9]+)$/)
      ?.[1]
      ?.toLowerCase();

  if (extension === 'png') {
    return 'image/png';
  }

  if (extension === 'webp') {
    return 'image/webp';
  }

  return 'image/jpeg';
};

const getSignatureFileName = (
  uri: string
): string => {
  const extension =
    uri
      .split('?')[0]
      .match(/\.([A-Za-z0-9]+)$/)
      ?.[1]
      ?.toLowerCase();

  if (
    extension === 'jpg' ||
    extension === 'jpeg'
  ) {
    return 'signature.jpg';
  }

  return 'signature.png';
};

const getSignatureMimeType = (
  uri: string
): string => {
  const extension =
    uri
      .split('?')[0]
      .match(/\.([A-Za-z0-9]+)$/)
      ?.[1]
      ?.toLowerCase();

  if (
    extension === 'jpg' ||
    extension === 'jpeg'
  ) {
    return 'image/jpeg';
  }

  return 'image/png';
};

export async function createPackages(
  input: CreatePackagesInput
): Promise<CreatePackagesResponse> {
  if (!input.token.trim()) {
    throw new Error(
      'No authentication token was provided.'
    );
  }

  if (input.packages.length === 0) {
    throw new Error(
      'At least one package is required.'
    );
  }

  if (!input.lastName.trim()) {
    throw new Error(
      'Recipient last name is required.'
    );
  }

  if (!input.signatureUri) {
    throw new Error(
      'A signature is required.'
    );
  }

  const requestPackages:
    PackageRequestItem[] =
      input.packages.map(
        (item) => ({
          barcode:
            item.trackingNumber.trim(),

          carrier:
            item.carrier ?? 'unknown',
        })
      );

  const invalidPackage =
    requestPackages.find(
      (item) =>
        item.barcode.length === 0
    );

  if (invalidPackage) {
    throw new Error(
      'One or more packages are missing a barcode.'
    );
  }

  const formData =
    new FormData();

  /*
   * The PHP API decodes this JSON array and
   * inserts or updates every package in one request.
   */
  formData.append(
    'packages',
    JSON.stringify(
      requestPackages
    )
  );

  formData.append(
    'date',
    input.date
  );

  formData.append(
    'time',
    input.time
  );

  formData.append(
    'comment',
    input.comment
  );

  formData.append(
    'lastName',
    input.lastName.trim()
  );

  if (
    input.latitude !== null &&
    Number.isFinite(
      input.latitude
    )
  ) {
    formData.append(
      'latitude',
      String(input.latitude)
    );
  }

  if (
    input.longitude !== null &&
    Number.isFinite(
      input.longitude
    )
  ) {
    formData.append(
      'longitude',
      String(input.longitude)
    );
  }

  /*
   * The photo is uploaded once and its Supabase
   * path is shared by every package in the array.
   */
  if (input.photoUri) {
    formData.append(
      'photo',
      {
        uri: input.photoUri,

        name:
          getPhotoFileName(
            input.photoUri
          ),

        type:
          getPhotoMimeType(
            input.photoUri
          ),
      } as any
    );
  }

  /*
   * The signature is also uploaded once and its
   * path is shared by every package in the array.
   */
  formData.append(
    'signature',
    {
      uri:
        input.signatureUri,

      name:
        getSignatureFileName(
          input.signatureUri
        ),

      type:
        getSignatureMimeType(
          input.signatureUri
        ),
    } as any
  );

  const response =
    await fetch(
      'https://dataworks-7b7x.onrender.com/api/create-package.php',
      {
        method: 'POST',

        headers: {
          Authorization:
            `Bearer ${input.token}`,

          Accept:
            'application/json',
        },

        body: formData,
      }
    );

  const responseText =
    await response.text();

  let data:
    CreatePackagesResponse;

  try {
    data =
      JSON.parse(
        responseText
      ) as CreatePackagesResponse;
  } catch {
    console.error(
      'Non-JSON package API response:',
      responseText
    );

    throw new Error(
      `The server returned an invalid response (HTTP ${response.status}).`
    );
  }

  if (
    !response.ok ||
    !data.success
  ) {
    throw new Error(
      data.details ??
        data.error ??
        'Unable to upload the delivery.'
    );
  }

  return data;
}