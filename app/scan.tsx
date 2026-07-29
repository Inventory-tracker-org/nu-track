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

import { useDelivery } from
  '../context/DeliveryContext';

const MESSAGE_DURATION = 3000;
const REPEAT_SCAN_DELAY = 1500;

const isValidPackageBarcode = (
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

export default function ScanScreen() {
  const [permission, requestPermission] =
    useCameraPermissions();

  const {
    delivery,
    addBarcode,
    discardCurrentDelivery,
  } = useDelivery();

  const barcodes = delivery.barcodes;

  const [message, setMessage] =
    useState('');

  const messageTimerRef =
    useRef<ReturnType<
      typeof setTimeout
    > | null>(null);

  const lastScanRef = useRef<{
    value: string;
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
      }, MESSAGE_DURATION);
  };

  const leaveAndDiscard = async () => {
    await discardCurrentDelivery();
    router.replace('/home-screen');
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

  const handleBarcodeScanned = (
    result: BarcodeScanningResult
  ) => {
    const scannedValue =
      result.data.trim().toUpperCase();

    if (!scannedValue) {
      return;
    }

    const now = Date.now();
    const lastScan = lastScanRef.current;

    if (
      lastScan &&
      lastScan.value === scannedValue &&
      now - lastScan.time <
        REPEAT_SCAN_DELAY
    ) {
      return;
    }

    lastScanRef.current = {
      value: scannedValue,
      time: now,
    };

    if (
      !isValidPackageBarcode(
        scannedValue
      )
    ) {
      showMessage(
        `"${scannedValue}" is not a valid package barcode.`
      );
      return;
    }

    if (
      barcodes.includes(scannedValue)
    ) {
      showMessage(
        `Package ${scannedValue} was already scanned.`
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
        >
          <Text
            style={styles.finishButtonText}
          >
            Finish
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
        <Text style={styles.instructions}>
          Position a package barcode inside
          the frame
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
            renderItem={({
              item,
              index,
            }) => (
              <View style={styles.barcodeRow}>
                <Text
                  style={styles.packageNumber}
                >
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
    zIndex: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 54,
    paddingHorizontal: 18,
    paddingBottom: 12,
    backgroundColor:
      'rgba(0, 0, 0, 0.55)',
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
    paddingBottom: 190,
  },
  instructions: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 24,
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
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor:
      'rgba(0, 0, 0, 0.65)',
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
    maxHeight: 210,
    padding: 20,
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
  packageNumber: {
    fontSize: 13,
    fontWeight: '700',
  },
  barcodeText: {
    color: '#555555',
    fontSize: 14,
  },
});