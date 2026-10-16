import {
    BarcodeScanningResult,
    CameraView,
    useCameraPermissions,
} from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { router, useFocusEffect, useIsFocused } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    AppState,
    BackHandler,
    Button,
    Keyboard,
    KeyboardAvoidingView,
    Linking,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { receiveFreight, ReceiveFreightError } from '../api/receive';
import {
    descriptionLength,
    FREIGHT_DESCRIPTION_MAX_LENGTH,
    normalizeFreightBarcode,
} from '../types/freight';

export default function ReceiveScreen() {
  const isFocused = useIsFocused();
  const [permission, requestPermission] = useCameraPermissions();
  const [appIsActive, setAppIsActive] = useState(AppState.currentState === 'active');
  const [barcode, setBarcode] = useState('');
  const [description, setDescription] = useState('');
  const [editingForm, setEditingForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [cameraError, setCameraError] = useState('');

  const barcodeRef = useRef('');
  const submittingRef = useRef(false);
  const editingFormRef = useRef(false);
  const lastRejectedScanRef = useRef(0);

  const normalizedBarcode = normalizeFreightBarcode(barcode);
  const characterCount = descriptionLength(description);
  const canReceive = Boolean(
    normalizedBarcode &&
    description.trim() &&
    characterCount <= FREIGHT_DESCRIPTION_MAX_LENGTH &&
    !submitting
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      setAppIsActive(state === 'active');
    });
    return () => subscription.remove();
  }, []);

  const goBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/home-screen');
    }
  }, []);

  const handleBack = useCallback(() => {
    if (submittingRef.current) {
      return;
    }
    if (barcodeRef.current.trim() || description.trim()) {
      Alert.alert('Leave Receiving?', 'This freight has not been submitted.', [
        { text: 'Stay', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: goBack },
      ]);
    } else {
      goBack();
    }
  }, [description, goBack]);

  useFocusEffect(useCallback(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      handleBack();
      return true;
    });
    return () => subscription.remove();
  }, [handleBack]));

  const handleBarcodeScanned = ({ data }: BarcodeScanningResult) => {
    if (
      !isFocused ||
      !appIsActive ||
      submittingRef.current ||
      barcodeRef.current ||
      editingFormRef.current
    ) {
      return;
    }

    const value = normalizeFreightBarcode(data);
    if (!value) {
      if (Date.now() - lastRejectedScanRef.current > 1500) {
        lastRejectedScanRef.current = Date.now();
        setError('Only freight labels in the format FP12345 can be received.');
      }
      return;
    }

    // Lock immediately so repeated camera callbacks cannot replace this label.
    barcodeRef.current = value;
    setBarcode(value);
    setError('');
    setConfirmation('');
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      .catch(() => undefined);
  };

  const handleReceive = async () => {
    if (submittingRef.current) {
      return;
    }
    if (!normalizedBarcode) {
      setError('Enter a freight barcode in the format FP12345.');
      return;
    }
    if (!description.trim()) {
      setError('A freight description is required.');
      return;
    }
    if (descriptionLength(description.trim()) > FREIGHT_DESCRIPTION_MAX_LENGTH) {
      setError('The description must be 250 characters or fewer.');
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    setError('');
    setConfirmation('');
    Keyboard.dismiss();

    try {
      const token = await SecureStore.getItemAsync('token');
      if (!token) {
        throw new ReceiveFreightError('Sign in again to receive freight.', 401);
      }

      const result = await receiveFreight({
        barcode: normalizedBarcode,
        description,
        token,
      });

      barcodeRef.current = '';
      setBarcode('');
      setDescription('');
      setConfirmation(
        `${result.freight.barcode}: ${result.message} Received ${result.freight.received_date}.`
      );
    } catch (receiveError) {
      setError(receiveError instanceof Error
        ? receiveError.message
        : 'Unable to receive freight. Check your connection and retry.');

      if (receiveError instanceof ReceiveFreightError && receiveError.status === 401) {
        Alert.alert('Sign In Required', 'Your session has expired. Sign in to continue.', [
          { text: 'Stay', style: 'cancel' },
          { text: 'Sign In', onPress: () => router.replace('/login') },
        ]);
      }
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const requestCameraAccess = async () => {
    try {
      if (permission?.canAskAgain === false) {
        await Linking.openSettings();
      } else {
        await requestPermission();
      }
    } catch {
      setError('Unable to open camera access. You can enter the freight barcode below.');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} disabled={submitting} accessibilityRole="button">
            <Text style={styles.backText}>‹ Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Receive Freight</Text>
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

          <View style={styles.camera}>
            {!permission ? (
              <ActivityIndicator color="#ffffff" accessibilityLabel="Checking camera permission" />
            ) : !permission.granted ? (
              <View style={styles.cameraMessage}>
                <Text style={styles.cameraText}>Allow camera access to scan, or enter the barcode below.</Text>
                <Button title={permission.canAskAgain ? 'Allow Camera Access' : 'Open Settings'} onPress={requestCameraAccess} />
              </View>
            ) : cameraError ? (
              <View style={styles.cameraMessage}>
                <Text style={styles.cameraText}>{cameraError}</Text>
                <Button title="Retry Camera" onPress={() => setCameraError('')} />
              </View>
            ) : isFocused && appIsActive && !barcode && !editingForm && !submitting && !confirmation ? (
              <>
                <CameraView
                  style={StyleSheet.absoluteFill}
                  facing="back"
                  onBarcodeScanned={handleBarcodeScanned}
                  barcodeScannerSettings={{ barcodeTypes: ['code128', 'code39', 'code93'] }}
                  onMountError={() => setCameraError('Camera unavailable. Retry or enter the barcode below.')}
                />
              </>
            ) : (
              <Text style={styles.cameraText}>
                {confirmation ? 'Freight received' : normalizedBarcode ? `${normalizedBarcode}\nReady to receive` : 'Camera paused'}
              </Text>
            )}
          </View>

          <Text style={styles.label}>Freight barcode *</Text>
          <View style={styles.barcodeRow}>
            <TextInput
              style={[styles.input, styles.flex]}
              value={barcode}
              placeholder="FP12345"
              placeholderTextColor="#737373"
              autoCapitalize="characters"
              autoCorrect={false}
              editable={!submitting}
              accessibilityLabel="Freight barcode, required"
              onFocus={() => {
                editingFormRef.current = true;
                setEditingForm(true);
              }}
              onBlur={() => {
                editingFormRef.current = false;
                setEditingForm(false);
              }}
              onChangeText={(value) => {
                barcodeRef.current = value;
                setBarcode(value);
                setError('');
                setConfirmation('');
              }}
            />
            <TouchableOpacity
              style={styles.clearButton}
              disabled={submitting || !barcode}
              accessibilityRole="button"
              accessibilityLabel="Clear barcode and resume scanning"
              onPress={() => {
                Keyboard.dismiss();
                barcodeRef.current = '';
                editingFormRef.current = false;
                setBarcode('');
                setEditingForm(false);
                setError('');
              }}
            >
              <Text style={styles.backText}>Clear</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>Description *</Text>
          <TextInput
            style={[styles.input, styles.description]}
            value={description}
            onChangeText={(value) => {
              setDescription(value);
              setError('');
              setConfirmation('');
            }}
            placeholder="For example: two pallets of office chairs"
            placeholderTextColor="#737373"
            multiline
            textAlignVertical="top"
            editable={!submitting}
            accessibilityLabel="Freight description, required, up to 250 characters"
            onFocus={() => {
              editingFormRef.current = true;
              setEditingForm(true);
            }}
            onBlur={() => {
              editingFormRef.current = false;
              setEditingForm(false);
            }}
          />
          <Text style={[styles.counter, characterCount > FREIGHT_DESCRIPTION_MAX_LENGTH && styles.errorText]}>
            {characterCount}/{FREIGHT_DESCRIPTION_MAX_LENGTH}
          </Text>

          {error ? <Text style={styles.errorText} accessibilityRole="alert">{error}</Text> : null}
          {confirmation ? (
            <View>
              <Text style={styles.successText} accessibilityLiveRegion="polite">{confirmation}</Text>
              <Button title="Scan Next Freight" onPress={() => setConfirmation('')} />
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.receiveButton, !canReceive && styles.disabled]}
            disabled={!canReceive}
            onPress={handleReceive}
            accessibilityRole="button"
            accessibilityState={{ disabled: !canReceive, busy: submitting }}
          >
            {submitting ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.receiveButtonText}>Receive Freight</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: '#ffffff' },
  header: { paddingHorizontal: 24, paddingVertical: 16, gap: 12 },
  backText: { color: '#222222', fontSize: 16, fontWeight: '600' },
  title: { color: '#222222', fontSize: 28, fontWeight: '700' },
  content: { paddingHorizontal: 24, paddingBottom: 32 },
  help: { color: '#555555', fontSize: 15, lineHeight: 22, marginBottom: 16 },
  camera: { height: 210, borderRadius: 12, backgroundColor: '#222222', overflow: 'hidden', alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  cameraMessage: { padding: 20, gap: 12 },
  cameraText: { color: '#ffffff', textAlign: 'center', fontSize: 16, lineHeight: 24 },
  scanHint: { position: 'absolute', bottom: 12, backgroundColor: '#000000aa', paddingHorizontal: 16, paddingVertical: 6, borderRadius: 8 },
  label: { color: '#222222', fontSize: 16, fontWeight: '600', marginBottom: 8 },
  barcodeRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  input: { borderWidth: 1, borderColor: '#bdbdbd', borderRadius: 8, padding: 14, color: '#222222', fontSize: 16 },
  clearButton: { paddingVertical: 14, paddingHorizontal: 4 },
  description: { minHeight: 110 },
  counter: { color: '#666666', textAlign: 'right', marginTop: 6, marginBottom: 16 },
  errorText: { color: '#b00020', lineHeight: 22, marginBottom: 12 },
  successText: { color: '#166534', lineHeight: 22, marginBottom: 12 },
  receiveButton: { backgroundColor: '#222222', borderRadius: 8, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  receiveButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
  disabled: { opacity: 0.45 },
});
