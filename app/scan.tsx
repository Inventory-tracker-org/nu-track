import {
  BarcodeScanningResult,
  CameraView,
  useCameraPermissions,
} from 'expo-camera';

import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';

import {
  Alert,
  Button,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { useDelivery } from '../context/DeliveryContext';
import {
  Carrier,
  ScannedPackage,
} from '../types/delivery';

const MESSAGE_DURATION = 3000;
const REPEAT_SCAN_DELAY = 1500;

type ScanMode = 'standard' | 'custom';

type NormalizedBarcode = {
  rawBarcode: string;
  trackingNumber: string;
  carrier: Carrier;
};

const getCarrierLabel = (carrier: Carrier): string => {
  const labels: Record<Carrier, string> = {
    usps: 'USPS',
    ups: 'UPS',
    amazon: 'Amazon',
    gofo: 'GOFO',
    ontrac: 'OnTrac',
    custom: 'Custom',
    fedex: 'FedEx',
    unknown: 'Unknown',
  };

  return labels[carrier];
};

const isValidGenericStandardBarcode = (
  value: string
): boolean => {
  if (value.length < 6 || value.length > 60) {
    return false;
  }

  if (
    /^https?:\/\//i.test(value) ||
    /^www\./i.test(value)
  ) {
    return false;
  }

  if (!/^[A-Z0-9-]+$/.test(value)) {
    return false;
  }

  const digitCount = value.match(/\d/g)?.length ?? 0;

  return digitCount >= 6;
};

const normalizeStandardBarcode = (
  value: string
): NormalizedBarcode | null => {
  const rawBarcode = value.trim().toUpperCase();

  if (!rawBarcode) {
    return null;
  }

  // Amazon Logistics: TBA followed by digits.
  if (/^TBA\d+$/.test(rawBarcode)) {
    return {
      rawBarcode,
      trackingNumber: rawBarcode,
      carrier: 'amazon',
    };
  }

  // GOFO: GFUS followed by alphanumeric characters.
  if (/^GFUS[A-Z0-9]+$/.test(rawBarcode)) {
    return {
      rawBarcode,
      trackingNumber: rawBarcode,
      carrier: 'gofo',
    };
  }

  /*
   * OnTrac: C1 immediately followed by digits.
   * This cannot match C1|digits because the pipe is absent.
   */
  if (/^C1\d+$/.test(rawBarcode)) {
    return {
      rawBarcode,
      trackingNumber: rawBarcode,
      carrier: 'ontrac',
    };
  }

  // UPS: 1Z followed by 16 alphanumeric characters.
  if (/^1Z[A-Z0-9]{16}$/.test(rawBarcode)) {
    return {
      rawBarcode,
      trackingNumber: rawBarcode,
      carrier: 'ups',
    };
  }

  /*
   * USPS scanner output can contain routing/service data
   * or non-digit characters before the final printed
   * 22-digit tracking number.
   */
  const uspsSuffix = rawBarcode.match(/\d{22}$/);

  if (uspsSuffix && rawBarcode.length > 22) {
    const digitsOnly = rawBarcode.replace(/[^0-9]/g, '');

    if (digitsOnly.length >= 22) {
      return {
        rawBarcode,
        trackingNumber: digitsOnly.slice(-22),
        carrier: 'usps',
      };
    }
  }

  /*
   * Plain printed USPS tracking values are commonly
   * 20–22 numeric digits.
   */
  if (/^\d{20,22}$/.test(rawBarcode)) {
    return {
      rawBarcode,
      trackingNumber: rawBarcode,
      carrier: 'usps',
    };
  }

  /*
   * A plain 12-digit value is labeled FedEx because that
   * matches the visible tracking values you tested.
   *
   * Longer FedEx barcode wrappers are intentionally left
   * unchanged and marked unknown because prefixes such as
   * 509 and 470 are not reliable enough to safely truncate.
   */
  if (/^\d{12}$/.test(rawBarcode)) {
    return {
      rawBarcode,
      trackingNumber: rawBarcode,
      carrier: 'fedex',
    };
  }

  if (!isValidGenericStandardBarcode(rawBarcode)) {
    return null;
  }

  return {
    rawBarcode,
    trackingNumber: rawBarcode,
    carrier: 'unknown',
  };
};

const normalizeCustomBarcode = (
  value: string
): NormalizedBarcode | null => {
  const rawBarcode = value.trim().toUpperCase();

  if (!/^C1\|\d+$/.test(rawBarcode)) {
    return null;
  }

  return {
    rawBarcode,
    trackingNumber: rawBarcode,
    carrier: 'custom',
  };
};

export default function ScanScreen() {
  const [permission, requestPermission] =
    useCameraPermissions();

  const {
    delivery,
    addPackage,
    discardCurrentDelivery,
  } = useDelivery();

  const packages = delivery.packages;

  const [scanMode, setScanMode] =
    useState<ScanMode>('standard');

  const [message, setMessage] = useState('');

  const messageTimerRef =
    useRef<ReturnType<typeof setTimeout> | null>(null);

  const lastScanRef = useRef<{
    rawValue: string;
    mode: ScanMode;
    time: number;
  } | null>(null);

  useEffect(() => {
    return () => {
      if (messageTimerRef.current) {
        clearTimeout(messageTimerRef.current);
      }
    };
  }, []);

  const showMessage = (value: string) => {
    if (messageTimerRef.current) {
      clearTimeout(messageTimerRef.current);
    }

    setMessage(value);

    messageTimerRef.current = setTimeout(() => {
      setMessage('');
      messageTimerRef.current = null;
    }, MESSAGE_DURATION);
  };

  const leaveAndDiscard = async () => {
    try {
      await discardCurrentDelivery();
      router.replace('/home-screen');
    } catch (error) {
      Alert.alert(
        'Unable to Remove Delivery',
        error instanceof Error
          ? error.message
          : 'Unable to remove the delivery.'
      );
    }
  };

  const handleBack = () => {
    const hasAnyInformation =
      packages.length > 0 ||
      delivery.lastName.trim().length > 0 ||
      delivery.notes.trim().length > 0 ||
      Boolean(delivery.photoUri) ||
      Boolean(delivery.signatureUri);

    if (!hasAnyInformation) {
      router.replace('/home-screen');
      return;
    }

    Alert.alert(
      'Remove All Packages',
      'Are you sure you want to remove all packages and delivery information?',
      [
        {
          text: 'No',
          style: 'cancel',
        },
        {
          text: 'Yes',
          style: 'destructive',
          onPress: leaveAndDiscard,
        },
      ]
    );
  };

  const handleScanModeChange = (nextMode: ScanMode) => {
    if (nextMode === scanMode) {
      return;
    }

    setScanMode(nextMode);
    lastScanRef.current = null;

    if (messageTimerRef.current) {
      clearTimeout(messageTimerRef.current);
      messageTimerRef.current = null;
    }

    setMessage('');
  };

  const handleBarcodeScanned = (
    result: BarcodeScanningResult
  ) => {
    const rawValue = result.data.trim().toUpperCase();

    if (!rawValue) {
      return;
    }

    const now = Date.now();
    const lastScan = lastScanRef.current;

    if (
      lastScan &&
      lastScan.rawValue === rawValue &&
      lastScan.mode === scanMode &&
      now - lastScan.time < REPEAT_SCAN_DELAY
    ) {
      return;
    }

    lastScanRef.current = {
      rawValue,
      mode: scanMode,
      time: now,
    };

    const normalized =
      scanMode === 'standard'
        ? normalizeStandardBarcode(rawValue)
        : normalizeCustomBarcode(rawValue);

    if (!normalized) {
      showMessage(
        scanMode === 'custom'
          ? 'Custom barcodes must use C1| followed by digits.'
          : `"${rawValue}" is not a recognized package barcode.`
      );
      return;
    }

    const duplicate = packages.some(
      (item) =>
        item.trackingNumber === normalized.trackingNumber
    );

    if (duplicate) {
      showMessage(
        `Package ${normalized.trackingNumber} was already scanned.`
      );
      return;
    }

    const scannedPackage: ScannedPackage = {
      ...normalized,
      scannedAt: new Date().toISOString(),
    };

    if (!addPackage(scannedPackage)) {
      showMessage(
        `Package ${normalized.trackingNumber} could not be added.`
      );
    }
  };

  const handleFinish = () => {
    if (packages.length === 0) {
      Alert.alert(
        'No Packages Scanned',
        'Scan at least one package before continuing.'
      );
      return;
    }

    router.push('/package');
  };

  if (!permission) {
    return (
      <View style={styles.centered}>
        <Text>Checking camera permission...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.centered}>
        <Text style={styles.permissionText}>
          Camera access is required to scan package barcodes.
        </Text>

        <Button
          title="Allow Camera Access"
          onPress={requestPermission}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        onBarcodeScanned={handleBarcodeScanned}
        barcodeScannerSettings={{
          barcodeTypes: [
            'code128',
            'code39',
            'code93',
            'ean13',
            'ean8',
            'upc_a',
            'upc_e',
            'itf14',
            'codabar',
          ],
        }}
      />

      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={handleBack}
          style={styles.topButton}
          activeOpacity={0.7}
        >
          <Text style={styles.topButtonText}>‹ Back</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleFinish}
          style={[
            styles.finishButton,
            packages.length === 0
              ? styles.disabledButton
              : null,
          ]}
          disabled={packages.length === 0}
          activeOpacity={0.7}
        >
          <Text style={styles.finishButtonText}>Finish</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[
            styles.tabButton,
            scanMode === 'standard'
              ? styles.activeTabButton
              : null,
          ]}
          onPress={() => handleScanModeChange('standard')}
        >
          <Text
            style={[
              styles.tabText,
              scanMode === 'standard'
                ? styles.activeTabText
                : null,
            ]}
          >
            Standard
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tabButton,
            scanMode === 'custom'
              ? styles.activeTabButton
              : null,
          ]}
          onPress={() => handleScanModeChange('custom')}
        >
          <Text
            style={[
              styles.tabText,
              scanMode === 'custom'
                ? styles.activeTabText
                : null,
            ]}
          >
            Custom
          </Text>
        </TouchableOpacity>
      </View>

      {message ? (
        <View style={styles.messageBox}>
          <Text style={styles.messageText}>{message}</Text>
        </View>
      ) : null}

      <View style={styles.scannerContent}>
        <Text style={styles.modeTitle}>
          {scanMode === 'standard'
            ? 'Carrier Barcode'
            : 'Custom Barcode'}
        </Text>

        <Text style={styles.instructions}>
          {scanMode === 'standard'
            ? 'Scan USPS, UPS, Amazon, GOFO, OnTrac, FedEx, or another package barcode.'
            : 'Scan a barcode using C1| followed by digits.'}
        </Text>

        <View style={styles.scanFrame} />

        {scanMode === 'custom' ? (
          <View style={styles.formatBox}>
            <Text style={styles.formatLabel}>
              Required format
            </Text>

            <Text style={styles.formatExample}>
              C1|123456789
            </Text>
          </View>
        ) : null}

        <View style={styles.countBadge}>
          <Text style={styles.countText}>
            {packages.length}{' '}
            {packages.length === 1
              ? 'package'
              : 'packages'}{' '}
            scanned
          </Text>
        </View>
      </View>

      <View style={styles.scannedPanel}>
        <Text style={styles.scannedTitle}>
          Scanned Packages
        </Text>

        {packages.length === 0 ? (
          <Text style={styles.emptyText}>
            No packages scanned yet.
          </Text>
        ) : (
          <FlatList
            data={packages}
            keyExtractor={(item, index) =>
              `${item.trackingNumber}-${index}`
            }
            showsVerticalScrollIndicator={false}
            renderItem={({ item, index }) => (
              <View style={styles.barcodeRow}>
                <View style={styles.barcodeHeader}>
                  <Text style={styles.packageNumber}>
                    Package {index + 1}
                  </Text>

                  <View style={styles.typeBadge}>
                    <Text style={styles.typeBadgeText}>
                      {getCarrierLabel(item.carrier)}
                    </Text>
                  </View>
                </View>

                <Text
                  style={styles.barcodeText}
                  numberOfLines={1}
                >
                  {item.trackingNumber}
                </Text>

                {item.rawBarcode !== item.trackingNumber ? (
                  <Text
                    style={styles.rawBarcodeText}
                    numberOfLines={1}
                  >
                    Raw: {item.rawBarcode}
                  </Text>
                ) : null}
              </View>
            )}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    backgroundColor: '#ffffff',
  },
  permissionText: {
    textAlign: 'center',
    fontSize: 16,
    marginBottom: 20,
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 54,
    paddingHorizontal: 18,
    paddingBottom: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  topButton: {
    paddingVertical: 8,
    paddingRight: 12,
  },
  topButtonText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '600',
  },
  finishButton: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  finishButtonText: {
    color: '#222222',
    fontSize: 16,
    fontWeight: '700',
  },
  disabledButton: {
    opacity: 0.45,
  },
  tabContainer: {
    position: 'absolute',
    top: 112,
    left: 24,
    right: 24,
    zIndex: 20,
    flexDirection: 'row',
    padding: 4,
    borderRadius: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    borderRadius: 7,
    paddingVertical: 11,
  },
  activeTabButton: {
    backgroundColor: '#ffffff',
  },
  tabText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  activeTabText: {
    color: '#222222',
  },
  messageBox: {
    position: 'absolute',
    top: 174,
    left: 24,
    right: 24,
    zIndex: 30,
    borderRadius: 8,
    padding: 14,
    backgroundColor: '#b00020',
  },
  messageText: {
    color: '#ffffff',
    textAlign: 'center',
    fontWeight: '600',
  },
  scannerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 100,
    paddingBottom: 190,
  },
  modeTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  instructions: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 22,
  },
  scanFrame: {
    width: '90%',
    height: 180,
    borderWidth: 3,
    borderColor: '#ffffff',
    borderRadius: 12,
  },
  formatBox: {
    marginTop: 16,
    borderRadius: 8,
    paddingHorizontal: 18,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  formatLabel: {
    color: '#dddddd',
    fontSize: 12,
    marginBottom: 3,
  },
  formatExample: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  countBadge: {
    marginTop: 18,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  countText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  scannedPanel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: 230,
    paddingTop: 18,
    paddingHorizontal: 20,
    paddingBottom: 24,
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  scannedTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 10,
  },
  emptyText: {
    color: '#666666',
  },
  barcodeRow: {
    borderTopWidth: 1,
    borderTopColor: '#eeeeee',
    paddingVertical: 10,
  },
  barcodeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 3,
  },
  packageNumber: {
    fontSize: 13,
    fontWeight: '700',
  },
  typeBadge: {
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: '#eeeeee',
  },
  typeBadgeText: {
    color: '#444444',
    fontSize: 11,
    fontWeight: '700',
  },
  barcodeText: {
    color: '#333333',
    fontSize: 14,
    fontWeight: '600',
  },
  rawBarcodeText: {
    color: '#777777',
    fontSize: 11,
    marginTop: 3,
  },
});
