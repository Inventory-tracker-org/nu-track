import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
    Alert,
    FlatList,
    SafeAreaView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

export default function PackageScreen() {
  const { barcodes } = useLocalSearchParams<{
    barcodes?: string | string[];
  }>();

  const [scannedBarcodes, setScannedBarcodes] =
    useState<string[]>([]);

  useEffect(() => {
    try {
      const barcodeParameter = Array.isArray(barcodes)
        ? barcodes[0]
        : barcodes;

      const parsedBarcodes = JSON.parse(
        barcodeParameter ?? '[]'
      );

      if (!Array.isArray(parsedBarcodes)) {
        setScannedBarcodes([]);
        return;
      }

      setScannedBarcodes(
        parsedBarcodes.filter(
          (barcode): barcode is string =>
            typeof barcode === 'string'
        )
      );
    } catch {
      setScannedBarcodes([]);
    }
  }, [barcodes]);

  const handleBack = () => {
  router.replace({
    pathname: '/scan',
    params: {
      savedBarcodes: JSON.stringify(scannedBarcodes),
    },
  });
};

  const handleRemoveBarcode = (
    indexToRemove: number
  ) => {
    const barcodeToRemove =
      scannedBarcodes[indexToRemove];

    if (!barcodeToRemove) {
      return;
    }

    Alert.alert(
      'Remove Package',
      `Remove package ${indexToRemove + 1}?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            setScannedBarcodes(
              (currentBarcodes) =>
                currentBarcodes.filter(
                  (_, index) =>
                    index !== indexToRemove
                )
            );
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleBack}
          activeOpacity={0.7}
        >
          <Text style={styles.backButtonText}>
            ‹ Back
          </Text>
        </TouchableOpacity>

        <View style={styles.content}>
          <Text style={styles.title}>
            Package Information
          </Text>

          <Text style={styles.summary}>
            {scannedBarcodes.length}{' '}
            {scannedBarcodes.length === 1
              ? 'package'
              : 'packages'}{' '}
            scanned
          </Text>

          <FlatList
            data={scannedBarcodes}
            keyExtractor={(item, index) =>
              `${item}-${index}`
            }
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.errorText}>
                  No package barcodes remain.
                </Text>

                <TouchableOpacity
                  style={styles.scanAgainButton}
                  onPress={handleBack}
                  activeOpacity={0.8}
                >
                  <Text style={styles.scanAgainText}>
                    Scan Packages
                  </Text>
                </TouchableOpacity>
              </View>
            }
            renderItem={({ item, index }) => (
              <View style={styles.barcodeBox}>
                <View style={styles.packageHeader}>
                  <Text style={styles.packageNumber}>
                    Package {index + 1}
                  </Text>

                  <TouchableOpacity
                    onPress={() =>
                      handleRemoveBarcode(index)
                    }
                    activeOpacity={0.7}
                  >
                    <Text style={styles.removeText}>
                      Remove
                    </Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.barcode}>
                  {item}
                </Text>
              </View>
            )}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  backButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#222222',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
  },
  summary: {
    color: '#555555',
    fontSize: 15,
    marginBottom: 24,
  },
  barcodeBox: {
    borderWidth: 1,
    borderColor: '#aaaaaa',
    borderRadius: 8,
    padding: 14,
    marginBottom: 12,
    backgroundColor: '#f7f7f7',
  },
  packageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  packageNumber: {
    fontSize: 13,
    fontWeight: '700',
  },
  removeText: {
    color: '#b00020',
    fontSize: 14,
    fontWeight: '600',
  },
  barcode: {
    fontSize: 17,
    color: '#222222',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 32,
  },
  errorText: {
    color: '#b00020',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 18,
  },
  scanAgainButton: {
    backgroundColor: '#222222',
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  scanAgainText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
});