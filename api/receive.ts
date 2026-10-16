import {
    descriptionLength,
    FREIGHT_DESCRIPTION_MAX_LENGTH,
    FreightReceipt,
    normalizeFreightBarcode,
} from '../types/freight';

export type ReceiveFreightInput = {
  barcode: string;
  description: string;
  token: string;
};

export type ReceiveFreightResponse = {
  success: true;
  message: string;
  already_received: boolean;
  freight: FreightReceipt;
};

export class ReceiveFreightError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = 'ReceiveFreightError';
  }
}

export async function receiveFreight(
  input: ReceiveFreightInput
): Promise<ReceiveFreightResponse> {
  const barcode = normalizeFreightBarcode(input.barcode);
  const description = input.description.trim();

  if (!input.token.trim()) {
    throw new Error('No authentication token was provided.');
  }

  if (!barcode) {
    throw new Error('Enter a freight barcode in the format FP12345.');
  }

  if (!description) {
    throw new Error('A freight description is required.');
  }

  if (descriptionLength(description) > FREIGHT_DESCRIPTION_MAX_LENGTH) {
    throw new Error('The description must be 250 characters or fewer.');
  }

  const formData = new FormData();
  formData.append('barcode', barcode);
  formData.append('description', description);

  // Receipt status, package type, and receipt date are assigned by PHP.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(
      'https://dataworks-7b7x.onrender.com/api/receive-package.php',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${input.token}`,
          Accept: 'application/json',
        },
        body: formData,
        signal: controller.signal,
      }
    );

    let data: unknown;
    try {
      data = JSON.parse(await response.text());
    } catch {
      throw new ReceiveFreightError(
        `The server returned an invalid response (HTTP ${response.status}).`,
        response.status
      );
    }

    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new ReceiveFreightError(
        'The server returned an invalid receiving response.',
        response.status
      );
    }

    const result = data as Partial<ReceiveFreightResponse> & { error?: unknown };

    if (!response.ok || result.success !== true) {
      throw new ReceiveFreightError(
        typeof result.error === 'string'
          ? result.error
          : 'Unable to receive the freight.',
        response.status
      );
    }

    if (
      typeof result.message !== 'string' ||
      typeof result.already_received !== 'boolean' ||
      result.freight?.barcode !== barcode ||
      result.freight.package_type !== 'freight' ||
      result.freight.delivered_status !== 'received' ||
      typeof result.freight.received_date !== 'string' ||
      result.freight.description !== description
    ) {
      throw new ReceiveFreightError(
        'The server did not confirm the freight receipt. Retry with the same details.',
        response.status
      );
    }

    return result as ReceiveFreightResponse;
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(
        'The request timed out. Retry with the same barcode and description to confirm receipt.'
      );
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
