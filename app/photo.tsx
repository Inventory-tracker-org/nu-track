import {
  CameraView,
  useCameraPermissions,
} from 'expo-camera';

import { router } from 'expo-router';
import { useRef, useState } from 'react';

import {
  ActivityIndicator,
  Alert,
  Button,
  Image,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  useDelivery,
} from '../context/DeliveryContext';

export default function PhotoScreen() {
  const [permission, requestPermission] =
    useCameraPermissions();

  const cameraRef = useRef<CameraView | null>(null);

  const [previewUri, setPreviewUri] =
    useState<string | null>(null);

  const [cameraReady, setCameraReady] =
    useState(false);

  const [takingPhoto, setTakingPhoto] =
    useState(false);

  const { setPhotoUri } = useDelivery();

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/package');
  };

  const handleTakePhoto = async () => {
    if (
      !cameraRef.current ||
      !cameraReady ||
      takingPhoto
    ) {
      return;
    }

    setTakingPhoto(true);

    try {
      const photo =
        await cameraRef.current.takePictureAsync({
          quality: 0.75,
          skipProcessing: false,
        });

      if (!photo?.uri) {
        throw new Error(
          'The camera did not return a photo.'
        );
      }

      setPreviewUri(photo.uri);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unable to take the photo.';

      Alert.alert('Camera Error', message);
    } finally {
      setTakingPhoto(false);
    }
  };

  const handleRetake = () => {
    setPreviewUri(null);
  };

  const handleUsePhoto = () => {
    if (!previewUri) {
      return;
    }

    setPhotoUri(previewUri);
    router.back();
  };

  if (!permission) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>
          Checking camera permission...
        </Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.centered}>
        <Text style={styles.permissionTitle}>
          Camera Permission Required
        </Text>

        <Text style={styles.permissionText}>
          Camera access is required to take a delivery
          photo.
        </Text>

        <Button
          title="Allow Camera Access"
          onPress={requestPermission}
        />

        <TouchableOpacity
          style={styles.cancelPermissionButton}
          onPress={handleBack}
        >
          <Text style={styles.cancelPermissionText}>
            Cancel
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (previewUri) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.previewContainer}>
          <Image
            source={{ uri: previewUri }}
            style={styles.previewImage}
            resizeMode="contain"
          />

          <View style={styles.previewTopBar}>
            <TouchableOpacity
              style={styles.topButton}
              onPress={handleBack}
            >
              <Text style={styles.topButtonText}>
                Cancel
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.previewActions}>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={handleRetake}
            >
              <Text style={styles.secondaryButtonText}>
                Retake
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleUsePhoto}
            >
              <Text style={styles.primaryButtonText}>
                Use Photo
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.cameraContainer}>
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFillObject}
        facing="back"
        mode="picture"
        onCameraReady={() => setCameraReady(true)}
      />

      <SafeAreaView style={styles.cameraOverlay}>
        <View style={styles.cameraTopBar}>
          <TouchableOpacity
            style={styles.topButton}
            onPress={handleBack}
          >
            <Text style={styles.topButtonText}>
              ‹ Back
            </Text>
          </TouchableOpacity>

          <Text style={styles.cameraTitle}>
            Delivery Photo
          </Text>

          <View style={styles.topBarSpacer} />
        </View>

        <View style={styles.photoInstructions}>
          <Text style={styles.instructionsText}>
            Make sure the delivered package is clearly
            visible.
          </Text>
        </View>

        <View style={styles.shutterArea}>
          <TouchableOpacity
            style={[
              styles.shutterOuter,
              !cameraReady || takingPhoto
                ? styles.disabledButton
                : null,
            ]}
            onPress={handleTakePhoto}
            disabled={!cameraReady || takingPhoto}
          >
            {takingPhoto ? (
              <ActivityIndicator color="#222222" />
            ) : (
              <View style={styles.shutterInner} />
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
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
  loadingText: {
    fontSize: 15,
    marginTop: 12,
  },
  permissionTitle: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
  },
  permissionText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 22,
    color: '#555555',
  },
  cancelPermissionButton: {
    marginTop: 20,
    padding: 12,
  },
  cancelPermissionText: {
    color: '#b00020',
    fontSize: 16,
    fontWeight: '600',
  },
  cameraContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  cameraOverlay: {
    flex: 1,
    justifyContent: 'space-between',
  },
  cameraTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  topButton: {
    minWidth: 70,
    paddingVertical: 8,
  },
  topButtonText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '600',
  },
  cameraTitle: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '700',
  },
  topBarSpacer: {
    width: 70,
  },
  photoInstructions: {
    alignSelf: 'center',
    marginHorizontal: 24,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  instructionsText: {
    color: '#ffffff',
    fontSize: 15,
    textAlign: 'center',
  },
  shutterArea: {
    alignItems: 'center',
    paddingBottom: 34,
  },
  shutterOuter: {
    width: 82,
    height: 82,
    borderRadius: 41,
    borderWidth: 5,
    borderColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: '#ffffff',
  },
  disabledButton: {
    opacity: 0.5,
  },
  previewContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  previewImage: {
    flex: 1,
    width: '100%',
  },
  previewTopBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 18,
    paddingTop: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  previewActions: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    backgroundColor: '#ffffff',
  },
  secondaryButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#222222',
    borderRadius: 8,
    paddingVertical: 15,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#222222',
    fontSize: 16,
    fontWeight: '700',
  },
  primaryButton: {
    flex: 1,
    backgroundColor: '#222222',
    borderRadius: 8,
    paddingVertical: 15,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
});