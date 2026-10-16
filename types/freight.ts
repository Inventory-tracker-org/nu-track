export const FREIGHT_DESCRIPTION_MAX_LENGTH = 250;

export type FreightReceipt = {
  barcode: string;
  delivered_status: 'received';
  received_date: string;
  package_type: 'freight';
  description: string | null;
};

// Freight uses the existing FP label followed by exactly five digits.
// Camera scans and manual entry use the same rule; there is no custom mode.
export const normalizeFreightBarcode = (value: string): string | null => {
  const barcode = value.trim().toUpperCase();
  return /^FP[0-9]{5}$/.test(barcode) ? barcode : null;
};

export const descriptionLength = (value: string): number =>
  Array.from(value).length;
