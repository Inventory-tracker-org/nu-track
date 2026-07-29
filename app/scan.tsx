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
import { router } from 'expo-router';

import { usePackageScan } from '../context/PackageScanContext';

const MESSAGE_DURATION = 3000;
const REPEAT_SCAN_DELAY = 1500;

const isValidPackageBarcode = (value: string): boolean => {
  const cleanedValue = value.trim();

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

  if (!/^[A-Z0-9-]+$/i.test(cleanedValue)) {
    return false;
  }

  const digitCount =
    cleanedValue.match(/\d/g)?.length ?? 0;

  if (digitCount < 6) {
    return false;
  }

  return true;
};

export default function ScanScreen() {
  const [permission, requestPermission] =
    useCameraPermissions();

  const {
    barcodes,
    addBarcode,
    clearBarcodes,
  } = usePackageScan();

  const [message, setMessage] = useState('');
  const [messageType, setMessageType] =
    useState<'duplicate' | 'invalid' | null>(null);

  const messageTimerRef =
    useRef<ReturnType<typeof setTimeout> | null>(null);

  const lastScanRef = useRef<{
    value: string;
    time: number;
  } | null>(null);

  useEffect(() => {
    return () => {
      if (messageTimerRef.current) {
        clearTimeout(messageTimerRef.current);
      }
    };
  }, []);

  const showTemporaryMessage = (
    text: string,
    type: 'duplicate' | 'invalid'
  ) => {
    if (messageTimerRef.current) {
      clearTimeout(messageTimerRef.current);
    }

    setMessage(text);
    setMessageType(type);

    messageTimerRef.current = setTimeout(() => {
      setMessage('');
      setMessageType(null);
      messageTimerRef.current = null;
    }, MESSAGE_DURATION);
  };

  const leaveScanner = () => {
    clearBarcodes();

    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/home-screen');
  };

  const handleBack = () => {
    if (barcodes.length === 0) {
      leaveScanner();
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
          onPress: leaveScanner,
        },
      ]
    );
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
      showTemporaryMessage(
        `"${scannedValue}" does not appear to be a valid package barcode.`,
        'invalid'
      );

      return;
    }

    if (barcodes.includes(scannedValue)) {
      showTemporaryMessage(
        `Package ${scannedValue} has already been scanned.`,
        'duplicate'
      );

      return;
    }

    addBarcode(scannedValue);
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
          barcodeTypes: ['code128', 'code39', 'code93'],
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

      {message ? (
        <View
          style={[
            styles.messageBox,
            messageType === 'duplicate'
              ? styles.duplicateMessageBox
              : styles.invalidMessageBox,
          ]}
        >
          <Text style={styles.messageText}>
            {message}
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
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  duplicateMessageBox: {
    backgroundColor: '#9a6700',
  },
  invalidMessageBox: {
    backgroundColor: '#b00020',
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