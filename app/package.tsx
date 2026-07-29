import { router, useLocalSearchParams } from 'expo-router';
import {
    SafeAreaView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

export default function PackageScreen() {
  const { barcode } = useLocalSearchParams<{
    barcode?: string | string[];
  }>();

  // Search parameters can technically be strings or arrays.
  const scannedBarcode = Array.isArray(barcode)
    ? barcode[0]
    : barcode;

  const handleBack = () => {
    if (router.canGoBack()) {
      router.push('/scan');
      return;
    }

    // Fallback in case this page was opened without navigation history.
    router.replace('/home-screen');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleBack}
          activeOpacity={0.7}
        >
          <Text style={styles.backButtonText}>‹ Back</Text>
        </TouchableOpacity>

        <View style={styles.content}>
          <Text style={styles.title}>Package Information</Text>

          <Text style={styles.label}>Scanned Barcode</Text>

          <View style={styles.barcodeBox}>
            <Text style={styles.barcode}>
              {scannedBarcode ?? 'No barcode received'}
            </Text>
          </View>

          {!scannedBarcode ? (
            <Text style={styles.errorText}>
              A barcode was not passed to this screen. Go back and scan the
              package again.
            </Text>
          ) : null}
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
    marginBottom: 32,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 8,
  },
  barcodeBox: {
    borderWidth: 1,
    borderColor: '#aaaaaa',
    borderRadius: 8,
    padding: 14,
    backgroundColor: '#f7f7f7',
  },
  barcode: {
    fontSize: 18,
    color: '#222222',
  },
  errorText: {
    color: '#b00020',
    fontSize: 14,
    marginTop: 12,
  },
});