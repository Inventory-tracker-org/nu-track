import {
  BarcodeScanningResult,
  CameraView,
  useCameraPermissions,
} from 'expo-camera';

import { router } from 'expo-router';
import {
  useEffect,
  useRef,
  useState,
} from 'react';

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

const MESSAGE_DURATION = 3000;
const REPEAT_SCAN_DELAY = 1500;

type ScanMode =
  | 'standard'
  | 'custom';

/*
 * Standard package validation.
 *
 * This keeps your existing restrictions:
 * - Between 8 and 40 characters
 * - No URLs
 * - Only letters, numbers, and hyphens
 * - At least six digits
 */
const isValidStandardBarcode = (
  value: string
): boolean => {
  const cleanedValue =
    value.trim().toUpperCase();

  if (
    cleanedValue.length < 8 ||
    cleanedValue.length > 40
  ) {
    return false;
  }

  if (
    /^https?:\/\//i.test(cleanedValue) ||
    /^www\./i.test(cleanedValue)
  ) {
    return false;
  }

  if (!/^[A-Z0-9-]+$/.test(cleanedValue)) {
    return false;
  }

  const digitCount =
    cleanedValue.match(/\d/g)?.length ?? 0;

  return digitCount >= 6;
};

/*
 * Custom package validation.
 *
 * Accepted format:
 *
 * C1|123456789
 *
 * The value must:
 * - Start with C1|
 * - Contain only digits after the pipe
 * - Contain at least one digit
 */
const isValidCustomBarcode = (
  value: string
): boolean => {
  const cleanedValue =
    value.trim().toUpperCase();

  return /^C1\|\d+$/.test(cleanedValue);
};

export default function ScanScreen() {
  const [permission, requestPermission] =
    useCameraPermissions();

  const {
    delivery,
    addBarcode,
    discardCurrentDelivery,
  } = useDelivery();
  

  const barcodes = delivery.barcodes;

  const [scanMode, setScanMode] =
    useState<ScanMode>('standard');

  const [message, setMessage] =
    useState('');

  const messageTimerRef =
    useRef<ReturnType<
      typeof setTimeout
    > | null>(null);

  const lastScanRef = useRef<{
    value: string;
    mode: ScanMode;
    time: number;
  } | null>(null);

  useEffect(() => {
    return () => {
      if (messageTimerRef.current) {
        clearTimeout(
          messageTimerRef.current
        );
      }
    };
  }, []);

  const showMessage = (
    value: string
  ) => {
    if (messageTimerRef.current) {
      clearTimeout(
        messageTimerRef.current
      );
    }

    setMessage(value);

    messageTimerRef.current =
      setTimeout(() => {
        setMessage('');
        messageTimerRef.current = null;
      }, MESSAGE_DURATION);
  };

  const leaveAndDiscard = async () => {
    try {
      /*
       * Deletes:
       * - Every barcode
       * - Last name
       * - Notes
       * - Photo
       * - Signature
       * - Active-delivery storage
       * - Delivery files
       */
      await discardCurrentDelivery();

      router.replace('/home-screen');
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Unable to remove the delivery.';

      Alert.alert(
        'Unable to Remove Delivery',
        errorMessage
      );
    }
  };

  const handleBack = () => {
    const hasAnyInformation =
      barcodes.length > 0 ||
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
      'Are you sure you want to remove all packages?',
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

  const handleScanModeChange = (
    nextMode: ScanMode
  ) => {
    if (nextMode === scanMode) {
      return;
    }

    setScanMode(nextMode);

    /*
     * Reset the last scanned value so the same
     * physical barcode can immediately be tested
     * after changing tabs.
     */
    lastScanRef.current = null;

    if (messageTimerRef.current) {
      clearTimeout(
        messageTimerRef.current
      );

      messageTimerRef.current = null;
    }

    setMessage('');
  };

  const normalizeStandardBarcode = (
  value: string
): string => {
  const cleanedValue =
    value.trim().toUpperCase();

  /*
   * USPS labels may return extra numeric prefix data.
   * When the scanned value is all digits and longer
   * than 22 characters, keep the final 22 digits.
   */
  if (
    /^\d+$/.test(cleanedValue) &&
    cleanedValue.length > 22
  ) {
    return cleanedValue.slice(-22);
  }

  return cleanedValue;
};

  const handleBarcodeScanned = (
    result: BarcodeScanningResult
  ) => {
    const rawScannedValue =
  result.data.trim().toUpperCase();

const scannedValue =
  scanMode === 'standard'
    ? normalizeStandardBarcode(
        rawScannedValue
      )
    : rawScannedValue;

    if (!scannedValue) {
      return;
    }

    const now = Date.now();
    const lastScan = lastScanRef.current;

    /*
     * Prevent the camera from repeatedly processing
     * the same barcode while it remains visible.
     */
    if (
      lastScan &&
      lastScan.value === scannedValue &&
      lastScan.mode === scanMode &&
      now - lastScan.time <
        REPEAT_SCAN_DELAY
    ) {
      return;
    }

    lastScanRef.current = {
      value: scannedValue,
      mode: scanMode,
      time: now,
    };

    if (scanMode === 'standard') {
      if (
        !isValidStandardBarcode(
          scannedValue
        )
      ) {
        showMessage(
          `"${scannedValue}" is not a valid standard package barcode.`
        );

        return;
      }
    } else {
      if (
        !isValidCustomBarcode(
          scannedValue
        )
      ) {
        showMessage(
          'Custom barcodes must use the format C1| followed by digits.'
        );

        return;
      }
    }

    /*
     * Duplicate checking applies across both tabs.
     *
     * A barcode scanned in Standard cannot be added
     * again from Custom and vice versa.
     */
    if (
      barcodes.includes(scannedValue)
    ) {
      showMessage(
        `Package ${scannedValue} was already scanned.`
      );

      return;
    }

    const wasAdded =
      addBarcode(scannedValue);

    if (!wasAdded) {
      showMessage(
        `Package ${scannedValue} could not be added.`
      );
    }
  };

  const handleFinish = () => {
    if (barcodes.length === 0) {
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
        <Text>
          Checking camera permission...
        </Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.centered}>
        <Text style={styles.permissionText}>
          Camera access is required to scan
          package barcodes.
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
        onBarcodeScanned={
          handleBarcodeScanned
        }
        barcodeScannerSettings={{
          /*
           * C1|123456 may still be encoded as
           * Code 128, Code 39, or Code 93.
           *
           * The tab controls validation, not the
           * physical barcode symbology.
           */
          barcodeTypes: [
            'code128',
            'code39',
            'code93',
          ],
        }}
      />

      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={handleBack}
          style={styles.topButton}
          activeOpacity={0.7}
        >
          <Text style={styles.topButtonText}>
            ‹ Back
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleFinish}
          style={[
            styles.finishButton,
            barcodes.length === 0
              ? styles.disabledButton
              : null,
          ]}
          disabled={barcodes.length === 0}
          activeOpacity={0.7}
        >
          <Text style={styles.finishButtonText}>
            Finish
          </Text>
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
          onPress={() =>
            handleScanModeChange(
              'standard'
            )
          }
          activeOpacity={0.8}
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
          onPress={() =>
            handleScanModeChange(
              'custom'
            )
          }
          activeOpacity={0.8}
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
          <Text style={styles.messageText}>
            {message}
          </Text>
        </View>
      ) : null}

      <View style={styles.scannerContent}>
        <Text style={styles.modeTitle}>
          {scanMode === 'standard'
            ? 'Standard Barcode'
            : 'Custom Barcode'}
        </Text>

        <Text style={styles.instructions}>
          {scanMode === 'standard'
            ? 'Position a standard package barcode inside the frame.'
            : 'Scan a barcode using the format C1| followed by digits.'}
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
            {barcodes.length}{' '}
            {barcodes.length === 1
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

        {barcodes.length === 0 ? (
          <Text style={styles.emptyText}>
            No packages scanned yet.
          </Text>
        ) : (
          <FlatList
            data={barcodes}
            keyExtractor={(item, index) =>
              `${item}-${index}`
            }
            showsVerticalScrollIndicator={
              false
            }
            renderItem={({
              item,
              index,
            }) => {
              const isCustom =
                isValidCustomBarcode(item);

              return (
                <View
                  style={styles.barcodeRow}
                >
                  <View
                    style={
                      styles.barcodeHeader
                    }
                  >
                    <Text
                      style={
                        styles.packageNumber
                      }
                    >
                      Package {index + 1}
                    </Text>

                    <View
                      style={
                        styles.typeBadge
                      }
                    >
                      <Text
                        style={
                          styles.typeBadgeText
                        }
                      >
                        {isCustom
                          ? 'Custom'
                          : 'Standard'}
                      </Text>
                    </View>
                  </View>

                  <Text
                    style={
                      styles.barcodeText
                    }
                    numberOfLines={1}
                  >
                    {item}
                  </Text>
                </View>
              );
            }}
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
    backgroundColor:
      'rgba(0, 0, 0, 0.65)',
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
    backgroundColor:
      'rgba(0, 0, 0, 0.7)',
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
    textShadowColor: '#000000',
    textShadowOffset: {
      width: 0,
      height: 1,
    },
    textShadowRadius: 3,
  },
  instructions: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 22,
    textShadowColor: '#000000',
    textShadowOffset: {
      width: 0,
      height: 1,
    },
    textShadowRadius: 3,
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
    backgroundColor:
      'rgba(0, 0, 0, 0.7)',
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
    backgroundColor:
      'rgba(0, 0, 0, 0.7)',
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
    maxHeight: 220,
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
    paddingBottom: 4,
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
    color: '#555555',
    fontSize: 14,
  },
});