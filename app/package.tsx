import * as Location from 'expo-location';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useState } from 'react';

import {
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
    KeyboardAvoidingView,
    Platform,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

import { createPackage } from '../api/packages';
import { useDelivery } from '../context/DeliveryContext';
import { usePackageScan } from '../context/PackageScanContext';

const getCurrentDateAndTime = () => {
  const now = new Date();

  const date = now.toISOString().split('T')[0];

  const time = now.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return {
    date,
    time,
  };
};

export default function PackageScreen() {
  const {
    barcodes,
    removeBarcode,
    clearBarcodes,
  } = usePackageScan();

  const {
    photoUri,
    signatureUri,
    clearDeliveryMedia,
  } = useDelivery();

  const [lastName, setLastName] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/scan');
  };

  const handleRemoveBarcode = (
    indexToRemove: number
  ) => {
    const barcode = barcodes[indexToRemove];

    if (!barcode) {
      return;
    }

    Alert.alert(
      'Remove Package',
      `Are you sure you want to remove package ${indexToRemove + 1}?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            removeBarcode(indexToRemove);
          },
        },
      ]
    );
  };

  const handleAddPhoto = () => {
    router.push('/photo');
  };

  const handleAddSignature = () => {
    router.push('/signature');
  };

  const getLocation = async () => {
    const permission =
      await Location.requestForegroundPermissionsAsync();

    if (permission.status !== 'granted') {
      return {
        latitude: null,
        longitude: null,
      };
    }

    const currentLocation =
      await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

    return {
      latitude: currentLocation.coords.latitude,
      longitude: currentLocation.coords.longitude,
    };
  };

  const resetDelivery = () => {
    clearBarcodes();
    clearDeliveryMedia();
    setLastName('');
    setNotes('');
  };

  const handleSubmit = async () => {
    if (submitting) {
      return;
    }

    if (barcodes.length === 0) {
      Alert.alert(
        'No Packages',
        'At least one package must be scanned before submitting.'
      );
      return;
    }

    if (!lastName.trim()) {
      Alert.alert(
        'Last Name Required',
        'Enter the last name of the person receiving the package.'
      );
      return;
    }

    if (!photoUri) {
      Alert.alert(
        'Photo Required',
        'Add a delivery photo before submitting.'
      );
      return;
    }

    if (!signatureUri) {
      Alert.alert(
        'Signature Required',
        'Capture a recipient signature before submitting.'
      );
      return;
    }

    const token =
      await SecureStore.getItemAsync('token');

    if (!token) {
      Alert.alert(
        'Authentication Required',
        'Your login session could not be found. Please log in again.'
      );

      router.replace('/login');
      return;
    }

    setSubmitting(true);

    try {
      const { date, time } =
        getCurrentDateAndTime();

      const {
        latitude,
        longitude,
      } = await getLocation();

      const failedUploads: string[] = [];

      for (const barcode of barcodes) {
        try {
          await createPackage({
            barcode,
            date,
            time,
            comment: notes.trim(),
            lastName: lastName.trim(),
            latitude,
            longitude,
            photoUri,
            signatureUri,
            token,
          });
        } catch (error) {
          console.error(
            `Unable to upload package ${barcode}:`,
            error
          );

          failedUploads.push(barcode);
        }
      }

      if (failedUploads.length > 0) {
        Alert.alert(
          'Some Packages Failed',
          `${failedUploads.length} of ${barcodes.length} packages could not be uploaded. They still need to be saved to the offline queue.`
        );

        return;
      }

      resetDelivery();

      Alert.alert(
        'Delivery Submitted',
        `${barcodes.length} ${
          barcodes.length === 1
            ? 'package was'
            : 'packages were'
        } uploaded successfully.`,
        [
          {
            text: 'OK',
            onPress: () => {
              router.replace('/home-screen');
            },
          },
        ]
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unable to submit the delivery.';

      Alert.alert(
        'Submission Failed',
        message
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={
          Platform.OS === 'ios'
            ? 'padding'
            : undefined
        }
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={
            styles.scrollContent
          }
          keyboardShouldPersistTaps="handled"
        >
          <TouchableOpacity
            style={styles.backButton}
            onPress={handleBack}
            disabled={submitting}
            activeOpacity={0.7}
          >
            <Text style={styles.backButtonText}>
              ‹ Back
            </Text>
          </TouchableOpacity>

          <Text style={styles.title}>
            Package Information
          </Text>

          <Text style={styles.summary}>
            {barcodes.length}{' '}
            {barcodes.length === 1
              ? 'package'
              : 'packages'}{' '}
            scanned
          </Text>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Scanned Packages
            </Text>

            {barcodes.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.errorText}>
                  No package barcodes remain.
                </Text>

                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={handleBack}
                  activeOpacity={0.8}
                >
                  <Text
                    style={
                      styles.secondaryButtonText
                    }
                  >
                    Scan Packages
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <FlatList
                data={barcodes}
                scrollEnabled={false}
                keyExtractor={(item, index) =>
                  `${item}-${index}`
                }
                renderItem={({ item, index }) => (
                  <View style={styles.barcodeBox}>
                    <View
                      style={styles.packageHeader}
                    >
                      <Text
                        style={styles.packageNumber}
                      >
                        Package {index + 1}
                      </Text>

                      <TouchableOpacity
                        onPress={() =>
                          handleRemoveBarcode(index)
                        }
                        disabled={submitting}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={styles.removeText}
                        >
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
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>
              Recipient Last Name
            </Text>

            <TextInput
              style={styles.input}
              placeholder="Enter last name"
              value={lastName}
              onChangeText={setLastName}
              autoCapitalize="words"
              autoCorrect={false}
              editable={!submitting}
              returnKeyType="next"
              maxLength={100}
            />

            <Text style={styles.label}>
              Notes
            </Text>

            <TextInput
              style={[
                styles.input,
                styles.notesInput,
              ]}
              placeholder="Enter optional delivery notes"
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              editable={!submitting}
              maxLength={1000}
            />

            <Text style={styles.characterCount}>
              {notes.length}/1000
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Delivery Confirmation
            </Text>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleAddPhoto}
              disabled={submitting}
              activeOpacity={0.8}
            >
              <Text style={styles.actionButtonText}>
                {photoUri
                  ? 'Retake Delivery Photo'
                  : 'Add Delivery Photo'}
              </Text>
            </TouchableOpacity>

            {photoUri ? (
              <Image
                source={{ uri: photoUri }}
                style={styles.previewImage}
                resizeMode="cover"
              />
            ) : (
              <Text style={styles.missingText}>
                No delivery photo added.
              </Text>
            )}

            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleAddSignature}
              disabled={submitting}
              activeOpacity={0.8}
            >
              <Text style={styles.actionButtonText}>
                {signatureUri
                  ? 'Replace Signature'
                  : 'Capture Signature'}
              </Text>
            </TouchableOpacity>

            {signatureUri ? (
              <Image
                source={{ uri: signatureUri }}
                style={styles.signaturePreview}
                resizeMode="contain"
              />
            ) : (
              <Text style={styles.missingText}>
                No signature added.
              </Text>
            )}
          </View>

          <TouchableOpacity
            style={[
              styles.submitButton,
              submitting ||
              barcodes.length === 0
                ? styles.disabledButton
                : null,
            ]}
            onPress={handleSubmit}
            disabled={
              submitting ||
              barcodes.length === 0
            }
            activeOpacity={0.8}
          >
            {submitting ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text
                style={styles.submitButtonText}
              >
                Submit Delivery
              </Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: 14,
    paddingRight: 20,
  },
  backButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#222222',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginTop: 8,
    marginBottom: 8,
  },
  summary: {
    color: '#555555',
    fontSize: 15,
    marginBottom: 24,
  },
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
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
  label: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#aaaaaa',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#ffffff',
    marginBottom: 18,
  },
  notesInput: {
    minHeight: 110,
    paddingTop: 12,
    marginBottom: 5,
  },
  characterCount: {
    color: '#666666',
    fontSize: 12,
    textAlign: 'right',
  },
  actionButton: {
    borderWidth: 1,
    borderColor: '#222222',
    borderRadius: 8,
    paddingVertical: 15,
    alignItems: 'center',
    marginBottom: 12,
    backgroundColor: '#ffffff',
  },
  actionButtonText: {
    color: '#222222',
    fontSize: 16,
    fontWeight: '700',
  },
  previewImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginBottom: 18,
    backgroundColor: '#eeeeee',
  },
  signaturePreview: {
    width: '100%',
    height: 140,
    borderWidth: 1,
    borderColor: '#dddddd',
    borderRadius: 8,
    marginBottom: 18,
    backgroundColor: '#ffffff',
  },
  missingText: {
    color: '#777777',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 18,
  },
  submitButton: {
    backgroundColor: '#222222',
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  disabledButton: {
    opacity: 0.5,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  errorText: {
    color: '#b00020',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 18,
  },
  secondaryButton: {
    backgroundColor: '#222222',
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  secondaryButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
});