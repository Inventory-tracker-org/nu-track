import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';

import { router } from 'expo-router';
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

const getDateAndTime = () => {
  const now = new Date();

  return {
    date: now.toISOString().split('T')[0],
    time: now.toLocaleTimeString(
      'en-US',
      {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }
    ),
  };
};

export default function PackageScreen() {
  const {
    delivery,
    mode,
    removeBarcode,
    setLastName,
    setNotes,
    setLocation,
    queueCurrentDelivery,
    clearCurrentDeliveryAfterUpload,
  } = useDelivery();

  const [submitting, setSubmitting] =
    useState(false);

  const {
    barcodes,
    lastName,
    notes,
    photoUri,
    signatureUri,
  } = delivery;

  const handleBack = () => {
    if (submitting) {
      return;
    }

    if (mode === 'recovered') {
      Alert.alert(
        'Save for Later',
        'Save this delivery on the device so it can be synced later?',
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Save',
            onPress: async () => {
              await queueCurrentDelivery();
              router.replace(
                '/home-screen'
              );
            },
          },
        ]
      );

      return;
    }

    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/scan');
    }
  };

  const handleRemove = (
    index: number
  ) => {
    Alert.alert(
      'Remove Package',
      `Remove package ${index + 1}?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () =>
            removeBarcode(index),
        },
      ]
    );
  };

  const getLocation = async () => {
    const permission =
      await Location
        .requestForegroundPermissionsAsync();

    if (
      permission.status !== 'granted'
    ) {
      return {
        latitude: null,
        longitude: null,
      };
    }

    const result =
      await Location
        .getCurrentPositionAsync({
          accuracy:
            Location.Accuracy.Balanced,
        });

    return {
      latitude:
        result.coords.latitude,
      longitude:
        result.coords.longitude,
    };
  };

  const handleSubmit = async () => {
    if (submitting) {
      return;
    }

    if (barcodes.length === 0) {
      Alert.alert(
        'No Packages',
        'At least one package is required.'
      );
      return;
    }

    if (!lastName.trim()) {
      Alert.alert(
        'Last Name Required',
        'Enter the recipient last name.'
      );
      return;
    }
/*
    if (!photoUri) {
      Alert.alert(
        'Photo Required',
        'Add a delivery photo.'
      );
      return;
    }
*/
    if (!signatureUri) {
      Alert.alert(
        'Signature Required',
        'Capture the recipient signature.'
      );
      return;
    }

    const token =
      await SecureStore.getItemAsync(
        'token'
      );

    if (!token) {
      Alert.alert(
        'Login Required',
        'Please log in again.'
      );

      router.replace('/login');
      return;
    }

    setSubmitting(true);

    try {
      const location =
        await getLocation();

      setLocation(
        location.latitude,
        location.longitude
      );

      const { date, time } =
        getDateAndTime();

      for (const barcode of barcodes) {
        await createPackage({
          barcode,
          date,
          time,
          comment: notes.trim(),
          lastName: lastName.trim(),
          latitude:
            location.latitude,
          longitude:
            location.longitude,
          photoUri,
          signatureUri,
          token,
        });
      }

      const uploadedCount =
        barcodes.length;

      await clearCurrentDeliveryAfterUpload();

      Alert.alert(
        'Delivery Submitted',
        `${uploadedCount} ${
          uploadedCount === 1
            ? 'package was'
            : 'packages were'
        } uploaded successfully.`,
        [
          {
            text: 'OK',
            onPress: () =>
              router.replace(
                '/home-screen'
              ),
          },
        ]
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unable to upload the delivery.';

      await queueCurrentDelivery(message);

      Alert.alert(
        'Saved for Sync',
        `The upload failed, so the delivery was saved on this device.\n\n${message}`,
        [
          {
            text: 'OK',
            onPress: () =>
              router.replace(
                '/home-screen'
              ),
          },
        ]
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={
          Platform.OS === 'ios'
            ? 'padding'
            : undefined
        }
      >
        <ScrollView
          contentContainerStyle={
            styles.content
          }
          keyboardShouldPersistTaps="handled"
        >
          <TouchableOpacity
            style={styles.backButton}
            onPress={handleBack}
            disabled={submitting}
          >
            <Text style={styles.backText}>
              ‹ Back
            </Text>
          </TouchableOpacity>

          {mode === 'recovered' ? (
            <View
              style={styles.recoveredBox}
            >
              <Text
                style={
                  styles.recoveredTitle
                }
              >
                Unfinished Delivery
              </Text>

              <Text
                style={
                  styles.recoveredText
                }
              >
                This delivery was restored
                from the device.
              </Text>
            </View>
          ) : null}

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
            <Text
              style={styles.sectionTitle}
            >
              Scanned Packages
            </Text>

            <FlatList
              data={barcodes}
              scrollEnabled={false}
              keyExtractor={(
                item,
                index
              ) => `${item}-${index}`}
              renderItem={({
                item,
                index,
              }) => (
                <View
                  style={styles.barcodeBox}
                >
                  <View
                    style={
                      styles.packageHeader
                    }
                  >
                    <Text
                      style={
                        styles.packageNumber
                      }
                    >
                      Package {index + 1}
                    </Text>

                    <TouchableOpacity
                      onPress={() =>
                        handleRemove(index)
                      }
                      disabled={submitting}
                    >
                      <Text
                        style={
                          styles.removeText
                        }
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
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>
              Recipient Last Name
            </Text>

            <TextInput
              style={styles.input}
              value={lastName}
              onChangeText={setLastName}
              placeholder="Enter last name"
              autoCapitalize="words"
              editable={!submitting}
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
              value={notes}
              onChangeText={setNotes}
              placeholder="Optional delivery notes"
              multiline
              maxLength={1000}
              editable={!submitting}
              textAlignVertical="top"
            />

            <Text
              style={
                styles.characterCount
              }
            >
              {notes.length}/1000
            </Text>
          </View>

          <View style={styles.section}>
            <Text
              style={styles.sectionTitle}
            >
              Delivery Confirmation
            </Text>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() =>
                router.push('/photo')
              }
              disabled={submitting}
            >
              <Text
                style={
                  styles.actionButtonText
                }
              >
                {photoUri
                  ? 'Retake Delivery Photo'
                  : 'Add Delivery Photo'}
              </Text>
            </TouchableOpacity>

            {photoUri ? (
              <Image
                source={{ uri: photoUri }}
                style={styles.photoPreview}
              />
            ) : null}

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() =>
                router.push('/signature')
              }
              disabled={submitting}
            >
              <Text
                style={
                  styles.actionButtonText
                }
              >
                {signatureUri
                  ? 'Replace Signature'
                  : 'Capture Signature'}
              </Text>
            </TouchableOpacity>

            {signatureUri ? (
              <Image
                source={{
                  uri: signatureUri,
                }}
                style={
                  styles.signaturePreview
                }
                resizeMode="contain"
              />
            ) : null}
          </View>

          <TouchableOpacity
            style={[
              styles.submitButton,
              submitting
                ? styles.disabledButton
                : null,
            ]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator
                color="#ffffff"
              />
            ) : (
              <Text
                style={
                  styles.submitButtonText
                }
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
  flex: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  content: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: 14,
    paddingRight: 20,
  },
  backText: {
    fontSize: 17,
    fontWeight: '600',
  },
  recoveredBox: {
    borderWidth: 1,
    borderColor: '#9a6700',
    backgroundColor: '#fff8dc',
    borderRadius: 8,
    padding: 14,
    marginBottom: 18,
  },
  recoveredTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  recoveredText: {
    color: '#555555',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
  },
  summary: {
    color: '#555555',
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
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  packageNumber: {
    fontSize: 13,
    fontWeight: '700',
  },
  removeText: {
    color: '#b00020',
    fontWeight: '600',
  },
  barcode: {
    fontSize: 17,
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
    padding: 12,
    fontSize: 16,
    marginBottom: 18,
  },
  notesInput: {
    minHeight: 110,
    marginBottom: 5,
  },
  characterCount: {
    textAlign: 'right',
    color: '#666666',
  },
  actionButton: {
    borderWidth: 1,
    borderColor: '#222222',
    borderRadius: 8,
    paddingVertical: 15,
    alignItems: 'center',
    marginBottom: 12,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  photoPreview: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginBottom: 18,
  },
  signaturePreview: {
    width: '100%',
    height: 140,
    borderWidth: 1,
    borderColor: '#dddddd',
    borderRadius: 8,
    marginBottom: 18,
  },
  submitButton: {
    backgroundColor: '#222222',
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  disabledButton: {
    opacity: 0.5,
  },
});