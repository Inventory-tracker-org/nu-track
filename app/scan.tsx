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
import {
  BarcodeScanningResult,
  CameraView,
  useCameraPermissions,
} from 'expo-camera';
import {
  router,
  useLocalSearchParams,
} from 'expo-router';

const MESSAGE_DURATION = 3000;
const REPEAT_SCAN_DELAY = 1500;

const isValidPackageBarcode = (value: string): boolean => {
  const cleanedValue = value.trim();

  // Reject empty, extremely short, or unusually long values.
  if (
    cleanedValue.length < 8 ||
    cleanedValue.length > 40
  ) {
    return false;
  }

  // Reject website links.
  if (
    /^https?:\/\//i.test(cleanedValue) ||
    /^www\./i.test(cleanedValue)
  ) {
    return false;
  }

  // Allow only letters, numbers, and hyphens.
  if (!/^[A-Z0-9-]+$/i.test(cleanedValue)) {
    return false;
  }

  // Reject values containing no numbers, such as "FVF".
  if (!/\d/.test(cleanedValue)) {
    return false;
  }

  return true;
};

export default function ScanScreen() {
  const [permission, requestPermission] =
    useCameraPermissions();

  const { savedBarcodes } = useLocalSearchParams<{
    savedBarcodes?: string | string[];
  }>();

  const [barcodes, setBarcodes] = useState<string[]>([]);
  const [duplicateMessage, setDuplicateMessage] =
    useState('');
  const [invalidMessage, setInvalidMessage] =
    useState('');

  const duplicateTimerRef =
    useRef<ReturnType<typeof setTimeout> | null>(null);

  const invalidTimerRef =
    useRef<ReturnType<typeof setTimeout> | null>(null);

  const lastScanRef = useRef<{
    value: string;
    time: number;
  } | null>(null);

  /*
   * Receive the updated barcode list when the user
   * returns from package.tsx after removing packages.
   */
  useEffect(() => {
    const barcodeParameter = Array.isArray(savedBarcodes)
      ? savedBarcodes[0]
      : savedBarcodes;

    if (!barcodeParameter) {
      return;
    }

    try {
      const parsedBarcodes = JSON.parse(barcodeParameter);

      if (!Array.isArray(parsedBarcodes)) {
        return;
      }

      setBarcodes(
        parsedBarcodes.filter(
          (barcode): barcode is string =>
            typeof barcode === 'string'
        )
      );
    } catch (error) {
      console.warn(
        'Unable to read returned barcodes:',
        error
      );
    }
  }, [savedBarcodes]);

  /*
   * Clear notification timers when this screen closes.
   */
  useEffect(() => {
    return () => {
      if (duplicateTimerRef.current) {
        clearTimeout(duplicateTimerRef.current);
      }

      if (invalidTimerRef.current) {
        clearTimeout(invalidTimerRef.current);
      }
    };
  }, []);

  const showDuplicateMessage = (barcode: string) => {
    if (duplicateTimerRef.current) {
      clearTimeout(duplicateTimerRef.current);
    }

    setInvalidMessage('');

    setDuplicateMessage(
      `Package ${barcode} has already been scanned.`
    );

    duplicateTimerRef.current = setTimeout(() => {
      setDuplicateMessage('');
      duplicateTimerRef.current = null;
    }, MESSAGE_DURATION);
  };

  const showInvalidMessage = (barcode: string) => {
    if (invalidTimerRef.current) {
      clearTimeout(invalidTimerRef.current);
    }

    setDuplicateMessage('');

    setInvalidMessage(
      `"${barcode}" does not appear to be a valid package barcode.`
    );

    invalidTimerRef.current = setTimeout(() => {
      setInvalidMessage('');
      invalidTimerRef.current = null;
    }, MESSAGE_DURATION);
  };

  const handleBack = () => {
    router.replace('/home-screen');
  };

  const handleBarcodeScanned = (
    result: BarcodeScanningResult
  ) => {
    const scannedValue = result.data.trim();

    if (!scannedValue) {
      return;
    }

    const now = Date.now();
    const lastScan = lastScanRef.current;

    /*
     * Prevent the camera from repeatedly firing while
     * the same barcode remains visible.
     */
    if (
      lastScan &&
      lastScan.value === scannedValue &&
      now - lastScan.time < REPEAT_SCAN_DELAY
    ) {
      return;
    }

    lastScanRef.current = {
      value: scannedValue,
      time: now,
    };

    if (!isValidPackageBarcode(scannedValue)) {
      showInvalidMessage(scannedValue);
      return;
    }

    if (barcodes.includes(scannedValue)) {
      showDuplicateMessage(scannedValue);
      return;
    }

    setBarcodes((currentBarcodes) => [
      ...currentBarcodes,
      scannedValue,
    ]);
  };

  const handleFinish = () => {
    if (barcodes.length === 0) {
      Alert.alert(
        'No Packages Scanned',
        'Scan at least one package before continuing.'
      );
      return;
    }

    router.push({
      pathname: '/package',
      params: {
        barcodes: JSON.stringify(barcodes),
      },
    });
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
          Camera access is required to scan package
          barcodes.
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
          ],
        }}
      />

      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.topButton}
          onPress={handleBack}
          activeOpacity={0.7}
        >
          <Text style={styles.topButtonText}>
            ‹ Back
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.finishButton,
            barcodes.length === 0
              ? styles.disabledButton
              : null,
          ]}
          onPress={handleFinish}
          disabled={barcodes.length === 0}
          activeOpacity={0.7}
        >
          <Text style={styles.finishButtonText}>
            Finish
          </Text>
        </TouchableOpacity>
      </View>

      {duplicateMessage ? (
        <View style={styles.messageBox}>
          <Text style={styles.messageText}>
            {duplicateMessage}
          </Text>
        </View>
      ) : null}

      {invalidMessage ? (
        <View style={styles.messageBox}>
          <Text style={styles.messageText}>
            {invalidMessage}
          </Text>
        </View>
      ) : null}

      <View style={styles.scannerContent}>
        <Text style={styles.instructions}>
          Position a package barcode inside the frame
        </Text>

        <View style={styles.scanFrame} />

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
            style={styles.barcodeList}
            showsVerticalScrollIndicator={false}
            renderItem={({ item, index }) => (
              <View style={styles.barcodeRow}>
                <Text style={styles.packageNumber}>
                  Package {index + 1}
                </Text>

                <Text
                  style={styles.barcodeText}
                  numberOfLines={1}
                >
                  {item}
                </Text>
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
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: '#ffffff',
  },
  permissionText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 54,
    paddingHorizontal: 18,
    paddingBottom: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
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
  messageBox: {
    position: 'absolute',
    top: 112,
    left: 24,
    right: 24,
    zIndex: 20,
    backgroundColor: '#b00020',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  messageText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  scannerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingBottom: 190,
  },
  instructions: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 24,
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
  countBadge: {
    marginTop: 24,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  countText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  scannedPanel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: 210,
    paddingTop: 16,
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
    fontSize: 14,
    paddingBottom: 8,
  },
  barcodeList: {
    maxHeight: 145,
  },
  barcodeRow: {
    borderTopWidth: 1,
    borderTopColor: '#eeeeee',
    paddingVertical: 10,
  },
  packageNumber: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  barcodeText: {
    color: '#555555',
    fontSize: 14,
  },
});