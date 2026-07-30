type CreatePackageInput = {
  barcode: string;
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

type CreatePackageResponse = {
  success: boolean;
  message?: string;
  error?: string;
  data?: unknown;
};

export async function createPackage(
  input: CreatePackageInput
): Promise<CreatePackageResponse> {
  const formData = new FormData();

  formData.append('barcode', input.barcode);
  formData.append('date', input.date);
  formData.append('time', input.time);
  formData.append('comment', input.comment);
  formData.append('lastName', input.lastName);

  if (input.latitude !== null) {
    formData.append(
      'latitude',
      String(input.latitude)
    );
  }

  if (input.longitude !== null) {
    formData.append(
      'longitude',
      String(input.longitude)
    );
  }

if (input.photoUri) {
  formData.append(
    'photo',
    {
      uri: input.photoUri,
      name: 'package-photo.jpg',
      type: 'image/jpeg',
    } as any
  );
}

  formData.append(
    'signature',
    {
      uri: input.signatureUri,
      name: 'signature.png',
      type: 'image/png',
    } as any
  );

  const response = await fetch(
    'https://dataworks-7b7x.onrender.com/api/create-package.php',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${input.token}`,
        Accept: 'application/json',
      },
      body: formData,
    }
  );

  let data: CreatePackageResponse;

  try {
    data = await response.json();
  } catch {
    throw new Error(
      'The server returned an invalid response.'
    );
  }

  if (!response.ok || !data.success) {
    throw new Error(
      data.error ?? 'Unable to upload package.'
    );
  }

  return data;
}