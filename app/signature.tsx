import * as FileSystem from 'expo-file-system/legacy';

import { router } from 'expo-router';
import { useRef, useState } from 'react';

import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import SignatureScreenCanvas from
  'react-native-signature-canvas';

import {
  useDelivery,
} from '../context/DeliveryContext';

type SignatureCanvasHandle = {
  readSignature: () => void;
  clearSignature: () => void;
};

export default function SignatureScreen() {
  const signatureRef =
    useRef<SignatureCanvasHandle | null>(null);

  const [saving, setSaving] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  const { setSignatureUri } = useDelivery();

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/package');
  };

  const handleClear = () => {
    signatureRef.current?.clearSignature();
    setHasDrawn(false);
  };

  const handleSaveButton = () => {
    if (!hasDrawn || saving) {
      Alert.alert(
        'Signature Required',
        'Please provide a signature before continuing.'
      );

      return;
    }

    signatureRef.current?.readSignature();
  };

  const handleSignatureComplete = async (
    signatureData: string
  ) => {
    if (saving) {
      return;
    }

    setSaving(true);

    try {
      const base64Data = signatureData.replace(
        /^data:image\/png;base64,/,
        ''
      );

      if (!base64Data) {
        throw new Error(
          'The signature image was empty.'
        );
      }

      const signatureDirectory =
        `${FileSystem.documentDirectory}signatures/`;

      const directoryInformation =
        await FileSystem.getInfoAsync(
          signatureDirectory
        );

      if (!directoryInformation.exists) {
        await FileSystem.makeDirectoryAsync(
          signatureDirectory,
          {
            intermediates: true,
          }
        );
      }

      const signatureUri =
        `${signatureDirectory}signature-${Date.now()}.png`;

      await FileSystem.writeAsStringAsync(
        signatureUri,
        base64Data,
        {
          encoding:
            FileSystem.EncodingType.Base64,
        }
      );

      setSignatureUri(signatureUri);
      router.back();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unable to save the signature.';

      Alert.alert('Signature Error', message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.topButton}
            onPress={handleBack}
            disabled={saving}
          >
            <Text style={styles.backText}>
              ‹ Back
            </Text>
          </TouchableOpacity>

          <Text style={styles.title}>
            Recipient Signature
          </Text>

          <View style={styles.topBarSpacer} />
        </View>

        <Text style={styles.instructions}>
          Ask the recipient to sign inside the box.
        </Text>

        <View style={styles.signatureContainer}>
          <SignatureScreenCanvas
            ref={signatureRef as never}
            onOK={handleSignatureComplete}
            onBegin={() => setHasDrawn(true)}
            onEmpty={() => {
              Alert.alert(
                'Signature Required',
                'Please provide a signature before continuing.'
              );
            }}
            descriptionText=""
            clearText="Clear"
            confirmText="Save"
            webStyle={signatureWebStyle}
            autoClear={false}
            imageType="image/png"
            backgroundColor="#ffffff"
            penColor="#000000"
          />
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.clearButton}
            onPress={handleClear}
            disabled={saving}
          >
            <Text style={styles.clearButtonText}>
              Clear
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.saveButton,
              (!hasDrawn || saving)
                ? styles.disabledButton
                : null,
            ]}
            onPress={handleSaveButton}
            disabled={!hasDrawn || saving}
          >
            {saving ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.saveButtonText}>
                Use Signature
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const signatureWebStyle = `
  .m-signature-pad {
    box-shadow: none;
    border: none;
    margin: 0;
    width: 100%;
    height: 100%;
  }

  .m-signature-pad--body {
    border: none;
    left: 0;
    right: 0;
    top: 0;
    bottom: 0;
  }

  .m-signature-pad--footer {
    display: none;
  }

  body,
  html {
    width: 100%;
    height: 100%;
    margin: 0;
    background-color: #ffffff;
  }
`;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#eeeeee',
  },
  topButton: {
    minWidth: 70,
    paddingVertical: 8,
  },
  backText: {
    color: '#222222',
    fontSize: 17,
    fontWeight: '600',
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
  },
  topBarSpacer: {
    width: 70,
  },
  instructions: {
    fontSize: 15,
    textAlign: 'center',
    color: '#555555',
    paddingHorizontal: 24,
    paddingVertical: 18,
  },
  signatureContainer: {
    flex: 1,
    marginHorizontal: 20,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#222222',
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#ffffff',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  clearButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#222222',
    borderRadius: 8,
    paddingVertical: 15,
    alignItems: 'center',
  },
  clearButtonText: {
    color: '#222222',
    fontSize: 16,
    fontWeight: '700',
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#222222',
    borderRadius: 8,
    paddingVertical: 15,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  disabledButton: {
    opacity: 0.5,
  },
});