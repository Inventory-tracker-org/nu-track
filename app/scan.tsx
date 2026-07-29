import { useState } from 'react';
import {
  Button,
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

export default function ScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

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

  const handleBarcodeScanned = (
    result: BarcodeScanningResult
  ) => {
    if (scanned) {
      return;
    }

    setScanned(true);

    router.push({
      pathname: '/package',
      params: {
        barcode: result.data,
      },
    });
  };

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        onBarcodeScanned={
          scanned ? undefined : handleBarcodeScanned
        }
        barcodeScannerSettings={{
          barcodeTypes: [
            'code128',
            'code39',
            'code93',
            'ean13',
            'ean8',
            'upc_a',
            'upc_e',
            'qr',
          ],
        }}
      />

      <View style={styles.overlay}>
        <Text style={styles.instructions}>
          Position the package barcode inside the frame
        </Text>

        <View style={styles.scanFrame} />

        {scanned ? (
          <TouchableOpacity
            style={styles.button}
            onPress={() => setScanned(false)}
          >
            <Text style={styles.buttonText}>
              Scan Again
            </Text>
          </TouchableOpacity>
        ) : null}
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
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  instructions: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 24,
  },
  scanFrame: {
    width: '90%',
    height: 180,
    borderWidth: 3,
    borderColor: '#ffffff',
    borderRadius: 12,
    backgroundColor: 'transparent',
  },
  button: {
    marginTop: 30,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  buttonText: {
    color: '#222222',
    fontSize: 16,
    fontWeight: '700',
  },
});