import {
  setAudioModeAsync,
  useAudioPlayer,
} from 'expo-audio';

import {
  BarcodeScanningResult,
  CameraView,
  useCameraPermissions,
} from 'expo-camera';

import * as Haptics from 'expo-haptics';
import * as SecureStore from 'expo-secure-store';

import { router, useFocusEffect, useIsFocused, } from 'expo-router';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  Alert,
  Button,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  FAILED_SCAN_SOUND_SOURCES,
  SUCCESS_SCAN_SOUND,
} from '../constants/scanSounds';

import {
  useDelivery,
} from '../context/DeliveryContext';

import {
  FailedScanSound,
  getFailedScanSound,
} from '../storage/soundSettings';

import {
  Carrier,
  ScannedPackage,
} from '../types/delivery';

const MESSAGE_DURATION = 3000;
const REPEAT_SCAN_DELAY = 750;

const SOUND_SETTINGS_USER_ID = 193;

type ScanMode =
  | 'standard'
  | 'custom';

type StoredUser = {
  id: number | string;
};

type NormalizedBarcode = {
  rawBarcode: string;
  trackingNumber: string;
  carrier: Carrier;
};

type ScanRegion = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const getCarrierLabel = (
  carrier: Carrier
): string => {
  const labels: Record<Carrier, string> = {
    usps: 'USPS',
    fedex: 'FedEx',
    ups: 'UPS',
    amazon: 'Amazon',
    gofo: 'GOFO',
    ontrac: 'OnTrac',
    custom: 'Custom',
    gls: 'GLS',
    Distribution: 'Distribution'
  };

  return labels[carrier];
};

const cleanRawBarcode = (
  value: string
): string => {
  return value
    .trim()
    .toUpperCase()
    .replace(
      /[\u0000-\u001F\u007F]/g,
      ''
    );
};

const compactBarcode = (
  value: string
): string => {
  return value.replace(
    /[\s-]+/g,
    ''
  );
};

const isKnownJunkBarcode = (
  value: string
): boolean => {
  const compact =
    compactBarcode(value);

  return (
    /^SF\d+$/i.test(compact) ||
    /^D\d+LOCAL$/i.test(compact) ||
    /^LOCAL/i.test(compact) ||
    /^https?:\/\//i.test(value) ||
    /^www\./i.test(value)
  );
};

const normalizeAmazonBarcode = (
  rawBarcode: string
): NormalizedBarcode | null => {
  const compact =
    compactBarcode(rawBarcode);

  if (
    !/^TBA\d{9,18}$/.test(
      compact
    )
  ) {
    return null;
  }

  return {
    rawBarcode,
    trackingNumber: compact,
    carrier: 'amazon',
  };
};

const normalizeGlsBarcode = (
  rawBarcode: string
): NormalizedBarcode | null => {
  /*
   * Preserve the pipe for the C1| format,
   * but remove whitespace.
   */
  const compact =
    rawBarcode.replace(/\s+/g, '');

  /*
   * GLS format observed in your workflow:
   *
   * C1| followed by digits.
   *
   * Example:
   * C1|12345678
   */
  if (/^C1\|\d{1,30}$/.test(compact)) {
    return {
      rawBarcode,
      trackingNumber: compact,
      carrier: 'gls',
    };
  }

  /*
   * GLS numeric format observed on your label:
   *
   * 305022026627915505
   *
   * This rule is intentionally narrow:
   * exactly 18 digits beginning with 305.
   *
   * Do not change this to accept every 18-digit
   * number, because that could reintroduce random
   * product and routing barcodes.
   */
  if (/^305\d{15}$/.test(compact)) {
    return {
      rawBarcode,
      trackingNumber: compact,
      carrier: 'gls',
    };
  }

  return null;
};

const normalizeFullPalette = (
  rawBarcode: string
): NormalizedBarcode | null => {
  const compact =
    compactBarcode(rawBarcode);

  if (!/^FP\d{10}$/.test(compact)) {
    return null;
  }

  return {
    rawBarcode,
    trackingNumber: compact,
    carrier: 'Distribution',
  };
};

const normalizeUpsBarcode = (
  rawBarcode: string
): NormalizedBarcode | null => {
  const compact =
    compactBarcode(rawBarcode);

  if (
    !/^1Z[A-Z0-9]{16}$/.test(
      compact
    )
  ) {
    return null;
  }

  return {
    rawBarcode,
    trackingNumber: compact,
    carrier: 'ups',
  };
};

const normalizeGofoBarcode = (
  rawBarcode: string
): NormalizedBarcode | null => {
  const compact =
    compactBarcode(rawBarcode);

  if (
    !/^GFUS[A-Z0-9]{8,30}$/.test(
      compact
    )
  ) {
    return null;
  }

  return {
    rawBarcode,
    trackingNumber: compact,
    carrier: 'gofo',
  };
};

const normalizeOnTracBarcode = (
  rawBarcode: string
): NormalizedBarcode | null => {
  const compact =
    compactBarcode(rawBarcode);

  /*
   * This matches C1 followed directly by digits.
   * It does not match the custom C1|digits format.
   */
  if (
    !/^C1\d{8,24}$/.test(
      compact
    )
  ) {
    return null;
  }

  return {
    rawBarcode,
    trackingNumber: compact,
    carrier: 'ontrac',
  };
};

const normalizeFedExBarcode = (
  rawBarcode: string
): NormalizedBarcode | null => {
  const digits =
    rawBarcode.replace(
      /\D/g,
      ''
    );

  /*
   * Plain printed FedEx tracking number.
   */
  if (/^\d{12}$/.test(digits)) {
    return {
      rawBarcode,
      trackingNumber: digits,
      carrier: 'fedex',
    };
  }

  /*
   * FedEx ASTRA format:
   * 32 digits, with the 12-digit tracking
   * number in positions 17 through 28.
   */
  if (digits.length === 32) {
    const trackingNumber =
      digits.slice(16, 28);

    if (
      /^\d{12}$/.test(
        trackingNumber
      )
    ) {
      return {
        rawBarcode,
        trackingNumber,
        carrier: 'fedex',
      };
    }
  }

  /*
   * FedEx FDX1D format:
   * Final 14-digit field is commonly
   * 00 plus the 12-digit tracking number.
   */
  if (digits.length === 34) {
    const trackingField =
      digits.slice(20, 34);

    if (
      /^00\d{12}$/.test(
        trackingField
      )
    ) {
      return {
        rawBarcode,
        trackingNumber:
          trackingField.slice(2),
        carrier: 'fedex',
      };
    }
  }

  /*
   * Wrapper patterns observed on your FedEx
   * package labels.
   *
   * Example:
   * 5091397300875071056348
   * becomes:
   * 875071056348
   */
  if (
    digits.length === 22 &&
    (
      digits.startsWith('509') ||
      digits.startsWith('470')
    )
  ) {
    return {
      rawBarcode,
      trackingNumber:
        digits.slice(-12),
      carrier: 'fedex',
    };
  }

  return null;
};

const normalizeUspsBarcode = (
  rawBarcode: string
): NormalizedBarcode | null => {
  const digits =
    rawBarcode.replace(
      /\D/g,
      ''
    );

  const compact =
    compactBarcode(rawBarcode);

  /*
   * USPS international/S10 format.
   */
  if (
    /^[A-Z]{2}\d{9}US$/.test(
      compact
    )
  ) {
    return {
      rawBarcode,
      trackingNumber: compact,
      carrier: 'usps',
    };
  }

  /*
   * Plain domestic USPS tracking numbers.
   *
   * Do not accept every random 20- or
   * 22-digit barcode. Require a USPS-style
   * service prefix.
   */
  if (
    (
      digits.length === 20 ||
      digits.length === 22
    ) &&
    /^(70|91|92|93|94|95)\d+$/.test(
      digits
    )
  ) {
    return {
      rawBarcode,
      trackingNumber: digits,
      carrier: 'usps',
    };
  }

  /*
   * USPS scanner output may contain routing,
   * control, or non-digit information before
   * the final printed 22-digit number.
   */
  if (digits.length > 22) {
    const candidate =
      digits.slice(-22);

    if (
      /^(91|92|93|94|95)\d{20}$/.test(
        candidate
      )
    ) {
      return {
        rawBarcode,
        trackingNumber: candidate,
        carrier: 'usps',
      };
    }
  }

  return null;
};

const normalizeStandardBarcode = (
  value: string
): NormalizedBarcode | null => {
  const rawBarcode =
    cleanRawBarcode(value);

  if (
    !rawBarcode ||
    isKnownJunkBarcode(
      rawBarcode
    )
  ) {
    return null;
  }

  /*
   * Order matters.
   *
   * FedEx is checked before USPS so a
   * numeric FedEx wrapper is not incorrectly
   * classified as USPS.
   */
  return (
    normalizeAmazonBarcode(
      rawBarcode
    ) ??
    normalizeUpsBarcode(
      rawBarcode
    ) ??
    normalizeGofoBarcode(
      rawBarcode
    ) ??
    normalizeOnTracBarcode(
      rawBarcode
    ) ??
    normalizeGlsBarcode(
      rawBarcode) 
      ??
    normalizeFedExBarcode(
      rawBarcode
    ) ??
    normalizeUspsBarcode(
      rawBarcode
    ) ??
    normalizeFullPalette(
      rawBarcode
    ) ??
    null
  );
};

const normalizeCustomBarcode = (
  value: string
): NormalizedBarcode | null => {
  const rawBarcode =
    cleanRawBarcode(value);

  if (!rawBarcode) {
    return null;
  }

  /*
   * Custom mode intentionally performs no carrier
   * format validation. It accepts any nonempty value
   * returned by the enabled 1D barcode scanners.
   */
  return {
    rawBarcode,
    trackingNumber: rawBarcode,
    carrier: 'custom',
  };
};

export default function ScanScreen() {
  const isFocused =
    useIsFocused();

  const [
    permission,
    requestPermission,
  ] = useCameraPermissions();

  const {
    delivery,
    addPackage,
    discardCurrentDelivery,
  } = useDelivery();

  const packages =
    delivery.packages;

  const [
    scanMode,
    setScanMode,
  ] = useState<ScanMode>(
    'standard'
  );

  const [
    message,
    setMessage,
  ] = useState('');

  const [
    manualVisible,
    setManualVisible,
  ] = useState(false);

  const [
    manualBarcode,
    setManualBarcode,
  ] = useState('');

  const [
    scanRegion,
    setScanRegion,
  ] = useState<ScanRegion | null>(
    null
  );

  const [
    canUseFailedScanSound,
    setCanUseFailedScanSound,
  ] = useState(false);

  const [
    selectedFailedSound,
    setSelectedFailedSound,
  ] = useState<FailedScanSound>(
    'default'
  );

  const successScanPlayer =
    useAudioPlayer(
      SUCCESS_SCAN_SOUND
    );

  /*
   * This must begin with a real sound.
   * It is not played when "default"
   * vibration-only mode is selected.
   */
  const failedScanPlayer =
    useAudioPlayer(
      FAILED_SCAN_SOUND_SOURCES.buzz
    );

  const manualInputRef =
    useRef<TextInput>(null);

  const scanFrameRef =
    useRef<View>(null);

  const messageTimerRef =
    useRef<ReturnType<
      typeof setTimeout
    > | null>(null);

  const lastScanRef =
    useRef<{
      value: string;
      mode: ScanMode;
      time: number;
    } | null>(null);

  const processingScanRef =
    useRef(false);

  useEffect(() => {
    const configureAudio =
      async () => {
        try {
          await setAudioModeAsync({
            playsInSilentMode: true,
            shouldPlayInBackground:
              false,
          });
        } catch (error) {
          console.warn(
            'Unable to configure audio:',
            error
          );
        }
      };

    void configureAudio();
  }, []);

  useEffect(() => {
    return () => {
      if (
        messageTimerRef.current
      ) {
        clearTimeout(
          messageTimerRef.current
        );
      }
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      const loadFailedSound =
        async () => {
          try {
            const storedUser =
              await SecureStore
                .getItemAsync(
                  'current_user'
                );

            let authorized = false;

            if (storedUser) {
              const user =
                JSON.parse(
                  storedUser
                ) as StoredUser;

              authorized =
                Number(user.id) ===
                SOUND_SETTINGS_USER_ID;
            }

            if (!active) {
              return;
            }

            setCanUseFailedScanSound(
              authorized
            );

            if (!authorized) {
              setSelectedFailedSound(
                'default'
              );

              return;
            }

            const savedSound =
              await getFailedScanSound();

            if (!active) {
              return;
            }

            setSelectedFailedSound(
              savedSound
            );

            if (
              savedSound !==
              'default'
            ) {
              failedScanPlayer.replace(
                FAILED_SCAN_SOUND_SOURCES[
                  savedSound
                ]
              );
            }
          } catch (error) {
            console.warn(
              'Unable to load failed-scan setting:',
              error
            );

            if (active) {
              setCanUseFailedScanSound(
                false
              );

              setSelectedFailedSound(
                'default'
              );
            }
          }
        };

      void loadFailedSound();

      return () => {
        active = false;
      };
    }, [failedScanPlayer])
  );

  const showMessage = (
    value: string
  ) => {
    if (
      messageTimerRef.current
    ) {
      clearTimeout(
        messageTimerRef.current
      );
    }

    setMessage(value);

    messageTimerRef.current =
      setTimeout(() => {
        setMessage('');

        messageTimerRef.current =
          null;
      }, MESSAGE_DURATION);
  };

  const playSuccessfulScanFeedback =
    async (): Promise<void> => {
      try {
        await successScanPlayer
          .seekTo(0);

        successScanPlayer.play();
      } catch (error) {
        console.warn(
          'Unable to play successful scan sound:',
          error
        );
      }
    };

  const playErrorHaptic =
    async (): Promise<void> => {
      try {
        if (
          Platform.OS ===
          'android'
        ) {
          await Haptics
            .performAndroidHapticsAsync(
              Haptics
                .AndroidHaptics
                .Reject
            );

          return;
        }

        await Haptics
          .notificationAsync(
            Haptics
              .NotificationFeedbackType
              .Error
          );
      } catch (error) {
        console.warn(
          'Unable to play error haptic:',
          error
        );

        try {
          await Haptics
            .impactAsync(
              Haptics
                .ImpactFeedbackStyle
                .Heavy
            );
        } catch {
          // Haptics may not be available.
        }
      }
    };

  const playRejectedScanFeedback =
    async (): Promise<void> => {
      const shouldVibrate =
        !canUseFailedScanSound ||
        selectedFailedSound ===
          'default';

      if (shouldVibrate) {
        await playErrorHaptic();

        return;
      }

      try {
        await failedScanPlayer
          .seekTo(0);

        failedScanPlayer.play();
      } catch (error) {
        console.warn(
          'Unable to play failed-scan sound:',
          error
        );

        await playErrorHaptic();
      }
    };

  const rejectBarcode = async (
    rejectionMessage: string
  ): Promise<void> => {
    await playRejectedScanFeedback();

    showMessage(
      rejectionMessage
    );
  };

  const processBarcodeValue = async (
    value: string,
    mode: ScanMode
  ): Promise<boolean> => {
    const rawValue =
      value.trim().toUpperCase();

    if (!rawValue) {
      await rejectBarcode(
        'Enter a barcode before adding it.'
      );

      return false;
    }

    const normalized =
      mode === 'standard'
        ? normalizeStandardBarcode(
            rawValue
          )
        : normalizeCustomBarcode(
            rawValue
          );

    if (!normalized) {
      await rejectBarcode(
        mode === 'custom'
          ? 'Enter or scan a barcode.'
          : 'This is not a recognized package tracking barcode.'
      );

      return false;
    }

    const duplicate =
      packages.some(
        (
          item: ScannedPackage
        ) =>
          item.trackingNumber ===
          normalized.trackingNumber
      );

    if (duplicate) {
      await rejectBarcode(
        `Package ${normalized.trackingNumber} was already scanned.`
      );

      return false;
    }

    const scannedPackage:
      ScannedPackage = {
        ...normalized,
        scannedAt:
          new Date()
            .toISOString(),
      };

    const wasAdded =
      addPackage(
        scannedPackage
      );

    if (!wasAdded) {
      await rejectBarcode(
        `Package ${normalized.trackingNumber} could not be added.`
      );

      return false;
    }

    await playSuccessfulScanFeedback();

    return true;
  };

  const updateScanRegion = () => {
    requestAnimationFrame(() => {
      scanFrameRef.current
        ?.measureInWindow(
          (
            x,
            y,
            width,
            height
          ) => {
            setScanRegion({
              x,
              y,
              width,
              height,
            });
          }
        );
    });
  };

  const isBarcodeInsideScanRegion = (
    result: BarcodeScanningResult
  ): boolean => {
    if (!scanRegion) {
      /*
       * Do not scan before the frame has
       * been measured.
       */
      return false;
    }

    let centerX:
      number | null = null;

    let centerY:
      number | null = null;

    if (
      Array.isArray(
        result.cornerPoints
      ) &&
      result.cornerPoints.length > 0
    ) {
      centerX =
        result.cornerPoints.reduce(
          (
            total,
            point
          ) =>
            total + point.x,
          0
        ) /
        result.cornerPoints.length;

      centerY =
        result.cornerPoints.reduce(
          (
            total,
            point
          ) =>
            total + point.y,
          0
        ) /
        result.cornerPoints.length;
    } else if (
      result.bounds &&
      result.bounds.size.width > 0 &&
      result.bounds.size.height > 0
    ) {
      centerX =
        result.bounds.origin.x +
        result.bounds.size.width /
          2;

      centerY =
        result.bounds.origin.y +
        result.bounds.size.height /
          2;
    }

    /*
     * Some devices do not return usable
     * bounds. Reject those callbacks so the
     * frame restriction remains meaningful.
     *
     * Manual entry remains available as the
     * fallback.
     */
    if (
      centerX === null ||
      centerY === null
    ) {
      return false;
    }

    const right =
      scanRegion.x +
      scanRegion.width;

    const bottom =
      scanRegion.y +
      scanRegion.height;

    return (
      centerX >= scanRegion.x &&
      centerX <= right &&
      centerY >= scanRegion.y &&
      centerY <= bottom
    );
  };

  const handleBarcodeScanned =
    async (
      result:
        BarcodeScanningResult
    ): Promise<void> => {
      if (
        !isFocused ||
        manualVisible ||
        processingScanRef.current
      ) {
        return;
      }

      if (
        !isBarcodeInsideScanRegion(
          result
        )
      ) {
        return;
      }

      const rawValue =
        cleanRawBarcode(
          result.data
        );

      if (!rawValue) {
        return;
      }

      const now =
        Date.now();

      const lastScan =
        lastScanRef.current;

      if (
        lastScan &&
        lastScan.value ===
          rawValue &&
        lastScan.mode ===
          scanMode &&
        now - lastScan.time <
          REPEAT_SCAN_DELAY
      ) {
        return;
      }

      lastScanRef.current = {
        value: rawValue,
        mode: scanMode,
        time: now,
      };

      processingScanRef.current =
        true;

      try {
        await processBarcodeValue(
          rawValue,
          scanMode
        );
      } finally {
        processingScanRef.current =
          false;
      }
    };

  const openManualEntry = () => {
    /*
     * Stop the camera from immediately
     * processing another callback.
     */
    processingScanRef.current =
      false;

    setManualBarcode('');
    setManualVisible(true);
  };

  const closeManualEntry = () => {
    Keyboard.dismiss();

    setManualBarcode('');
    setManualVisible(false);

    /*
     * Prevent the barcode behind the modal
     * from immediately being treated as a
     * repeat scan when the modal closes.
     */
    lastScanRef.current = null;
  };

  const handleManualAdd =
    async (): Promise<void> => {
      if (
        processingScanRef.current
      ) {
        return;
      }

      processingScanRef.current =
        true;

      try {
        const added =
          await processBarcodeValue(
            manualBarcode,
            scanMode
          );

        if (added) {
          Keyboard.dismiss();

          setManualBarcode('');
          setManualVisible(false);
          lastScanRef.current =
            null;
        }
      } finally {
        processingScanRef.current =
          false;
      }
    };

  const leaveAndDiscard =
    async () => {
      try {
        await discardCurrentDelivery();

        router.replace(
          '/home-screen'
        );
      } catch (error) {
        Alert.alert(
          'Unable to Remove Delivery',
          error instanceof Error
            ? error.message
            : 'Unable to remove the delivery.'
        );
      }
    };

  const handleBack = () => {
    const hasAnyInformation =
      packages.length > 0 ||
      delivery.lastName
        .trim()
        .length > 0 ||
      delivery.notes
        .trim()
        .length > 0 ||
      Boolean(
        delivery.photoUri
      ) ||
      Boolean(
        delivery.signatureUri
      );

    if (!hasAnyInformation) {
      router.replace(
        '/home-screen'
      );

      return;
    }

    Alert.alert(
      'Remove All Packages',
      'Are you sure you want to remove all packages and delivery information?',
      [
        {
          text: 'No',
          style: 'cancel',
        },
        {
          text: 'Yes',
          style: 'destructive',
          onPress:
            leaveAndDiscard,
        },
      ]
    );
  };

  const handleScanModeChange = (
    nextMode: ScanMode
  ) => {
    if (
      nextMode === scanMode
    ) {
      return;
    }

    setScanMode(nextMode);

    lastScanRef.current =
      null;

    if (
      messageTimerRef.current
    ) {
      clearTimeout(
        messageTimerRef.current
      );

      messageTimerRef.current =
        null;
    }

    setMessage('');
  };

  const handleFinish = () => {
    if (packages.length === 0) {
      Alert.alert(
        'No Packages Scanned',
        'Scan at least one package before continuing.'
      );

      return;
    }

    Keyboard.dismiss();

    router.push('/package');
  };

  if (!permission) {
    return (
      <View
        style={styles.centered}
      >
        <Text>
          Checking camera
          permission...
        </Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View
        style={styles.centered}
      >
        <Text
          style={
            styles.permissionText
          }
        >
          Camera access is required
          to scan package barcodes.
        </Text>

        <Button
          title="Allow Camera Access"
          onPress={
            requestPermission
          }
        />
      </View>
    );
  }

  return (
    <View
      style={styles.container}
    >
      {isFocused &&
      !manualVisible ? (
        <CameraView
          style={
            StyleSheet
              .absoluteFill
          }
          facing="back"
          onBarcodeScanned={
            handleBarcodeScanned
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
              'itf14',
              'codabar',
            ],
          }}
        />
      ) : (
        <View
          style={
            StyleSheet
              .absoluteFill
          }
        />
      )}

      <View
        style={styles.topBar}
      >
        <TouchableOpacity
          onPress={handleBack}
          style={
            styles.topButton
          }
          activeOpacity={0.7}
        >
          <Text
            style={
              styles.topButtonText
            }
          >
            ‹ Back
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleFinish}
          style={[
            styles.finishButton,
            packages.length === 0
              ? styles.disabledButton
              : null,
          ]}
          disabled={
            packages.length === 0
          }
          activeOpacity={0.7}
        >
          <Text
            style={
              styles.finishButtonText
            }
          >
            Finish
          </Text>
        </TouchableOpacity>
      </View>

      <View
        style={
          styles.tabContainer
        }
      >
        <TouchableOpacity
          style={[
            styles.tabButton,
            scanMode === 'standard'
              ? styles.activeTabButton
              : null,
          ]}
          onPress={() =>
            handleScanModeChange(
              'standard'
            )
          }
          activeOpacity={0.8}
        >
          <Text
            style={[
              styles.tabText,
              scanMode === 'standard'
                ? styles.activeTabText
                : null,
            ]}
          >
            Standard
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tabButton,
            scanMode === 'custom'
              ? styles.activeTabButton
              : null,
          ]}
          onPress={() =>
            handleScanModeChange(
              'custom'
            )
          }
          activeOpacity={0.8}
        >
          <Text
            style={[
              styles.tabText,
              scanMode === 'custom'
                ? styles.activeTabText
                : null,
            ]}
          >
            Custom
          </Text>
        </TouchableOpacity>
      </View>

      {message ? (
        <View
          style={
            styles.messageBox
          }
        >
          <Text
            style={
              styles.messageText
            }
          >
            {message}
          </Text>
        </View>
      ) : null}

      <View
        style={
          styles.scannerContent
        }
      >
        <Text
          style={
            styles.modeTitle
          }
        >
          {scanMode === 'standard'
            ? 'Carrier Barcode'
            : 'Custom Barcode'}
        </Text>

        <Text
          style={
            styles.instructions
          }
        >
          {scanMode === 'standard'
            ? 'Center a recognized package tracking barcode inside the frame.'
            : 'Scan any supported 1D barcode. The carrier will be saved as Custom.'}
        </Text>

        <View
          ref={scanFrameRef}
          style={
            styles.scanFrame
          }
          onLayout={
            updateScanRegion
          }
        />

        <View
          style={
            styles.countBadge
          }
        >
          <Text
            style={
              styles.countText
            }
          >
            {packages.length}{' '}
            {packages.length === 1
              ? 'package'
              : 'packages'}{' '}
            scanned
          </Text>
        </View>
      </View>

      <TouchableOpacity
        style={
          styles.manualButton
        }
        onPress={
          openManualEntry
        }
        activeOpacity={0.8}
      >
        <Text
          style={
            styles.manualButtonText
          }
        >
          Manual Entry
        </Text>
      </TouchableOpacity>

      <View
        style={
          styles.scannedPanel
        }
      >
        <Text
          style={
            styles.scannedTitle
          }
        >
          Scanned Packages
        </Text>

        {packages.length === 0 ? (
          <Text
            style={
              styles.emptyText
            }
          >
            No packages scanned yet.
          </Text>
        ) : (
          <FlatList
            data={packages}
            keyExtractor={(
              item,
              index
            ) =>
              `${item.trackingNumber}-${index}`
            }
            showsVerticalScrollIndicator={
              false
            }
            keyboardShouldPersistTaps="handled"
            renderItem={({
              item,
              index,
            }) => (
              <View
                style={
                  styles.barcodeRow
                }
              >
                <View
                  style={
                    styles.barcodeHeader
                  }
                >
                  <Text
                    style={
                      styles.packageNumber
                    }
                  >
                    Package {index + 1}
                  </Text>

                  <View
                    style={
                      styles.typeBadge
                    }
                  >
                    <Text
                      style={
                        styles.typeBadgeText
                      }
                    >
                      {getCarrierLabel(
                        item.carrier
                      )}
                    </Text>
                  </View>
                </View>

                <Text
                  style={
                    styles.barcodeText
                  }
                  numberOfLines={1}
                >
                  {
                    item.trackingNumber
                  }
                </Text>

                {item.rawBarcode !==
                item.trackingNumber ? (
                  <Text
                    style={
                      styles.rawBarcodeText
                    }
                    numberOfLines={1}
                  >
                    Raw: {item.rawBarcode}
                  </Text>
                ) : null}
              </View>
            )}
          />
        )}
      </View>

      <Modal
        visible={manualVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onShow={() => {
          setTimeout(() => {
            manualInputRef.current
              ?.focus();
          }, 250);
        }}
        onRequestClose={
          closeManualEntry
        }
      >
        <KeyboardAvoidingView
          style={
            styles.modalKeyboardView
          }
          behavior={
            Platform.OS === 'ios'
              ? 'padding'
              : 'height'
          }
        >
          <TouchableOpacity
            style={
              styles.modalOverlay
            }
            activeOpacity={1}
            onPress={
              closeManualEntry
            }
          >
            <TouchableOpacity
              style={
                styles.manualModal
              }
              activeOpacity={1}
              onPress={() => {
                /*
                 * Prevent taps inside the modal
                 * from closing it.
                 */
              }}
            >
              <Text
                style={
                  styles.manualModalTitle
                }
              >
                Enter Barcode Manually
              </Text>

              <Text
                style={
                  styles.manualModalDescription
                }
              >
                {scanMode ===
                'standard'
                  ? 'Enter the tracking number printed on the package.'
                  : 'Enter a custom barcode.'}
              </Text>

              <TextInput
                ref={
                  manualInputRef
                }
                style={
                  styles.manualInput
                }
                value={
                  manualBarcode
                }
                onChangeText={
                  setManualBarcode
                }
                placeholder={
                  scanMode ===
                  'standard'
                    ? 'Tracking number'
                    : 'Custom Barcode'
                }
                placeholderTextColor="#888888"
                autoFocus
                autoCapitalize="characters"
                autoCorrect={false}
                spellCheck={false}
                keyboardType="default"
                returnKeyType="done"
                blurOnSubmit={false}
                editable={
                  !processingScanRef.current
                }
                onSubmitEditing={() => {
                  void handleManualAdd();
                }}
              />

              <View
                style={
                  styles.modalButtons
                }
              >
                <TouchableOpacity
                  style={
                    styles.cancelManualButton
                  }
                  onPress={
                    closeManualEntry
                  }
                  activeOpacity={0.8}
                >
                  <Text
                    style={
                      styles.cancelManualText
                    }
                  >
                    Cancel
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.addManualButton,
                    !manualBarcode.trim()
                      ? styles.disabledButton
                      : null,
                  ]}
                  disabled={
                    !manualBarcode.trim()
                  }
                  onPress={() => {
                    void handleManualAdd();
                  }}
                  activeOpacity={0.8}
                >
                  <Text
                    style={
                      styles.addManualText
                    }
                  >
                    Add Package
                  </Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles =
  StyleSheet.create({
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
      zIndex: 20,

      flexDirection: 'row',
      justifyContent:
        'space-between',
      alignItems: 'center',

      paddingTop: 54,
      paddingHorizontal: 18,
      paddingBottom: 12,

      backgroundColor:
        'rgba(0, 0, 0, 0.65)',
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
      borderRadius: 8,
      paddingHorizontal: 18,
      paddingVertical: 10,
      backgroundColor: '#ffffff',
    },

    finishButtonText: {
      color: '#222222',
      fontSize: 16,
      fontWeight: '700',
    },

    disabledButton: {
      opacity: 0.45,
    },

    tabContainer: {
      position: 'absolute',
      top: 112,
      left: 24,
      right: 24,
      zIndex: 20,

      flexDirection: 'row',

      padding: 4,
      borderRadius: 10,

      backgroundColor:
        'rgba(0, 0, 0, 0.7)',
    },

    tabButton: {
      flex: 1,
      alignItems: 'center',
      borderRadius: 7,
      paddingVertical: 11,
    },

    activeTabButton: {
      backgroundColor: '#ffffff',
    },

    tabText: {
      color: '#ffffff',
      fontSize: 15,
      fontWeight: '700',
    },

    activeTabText: {
      color: '#222222',
    },

    messageBox: {
      position: 'absolute',
      top: 174,
      left: 24,
      right: 24,
      zIndex: 30,

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
      paddingTop: 100,
      paddingBottom: 230,
    },

    modeTitle: {
      color: '#ffffff',
      fontSize: 20,
      fontWeight: '700',
      marginBottom: 8,
    },

    instructions: {
      color: '#ffffff',
      fontSize: 15,
      fontWeight: '600',
      textAlign: 'center',
      marginBottom: 22,
    },

    scanFrame: {
      width: '90%',
      height: 180,

      borderWidth: 3,
      borderColor: '#ffffff',
      borderRadius: 12,
    },

    formatBox: {
      marginTop: 16,

      borderRadius: 8,

      paddingHorizontal: 18,
      paddingVertical: 10,

      alignItems: 'center',

      backgroundColor:
        'rgba(0, 0, 0, 0.7)',
    },

    formatLabel: {
      color: '#dddddd',
      fontSize: 12,
      marginBottom: 3,
    },

    formatExample: {
      color: '#ffffff',
      fontSize: 16,
      fontWeight: '700',
    },

    countBadge: {
      marginTop: 18,

      paddingHorizontal: 18,
      paddingVertical: 10,

      borderRadius: 20,

      backgroundColor:
        'rgba(0, 0, 0, 0.7)',
    },

    countText: {
      color: '#ffffff',
      fontWeight: '700',
    },

    manualButton: {
      position: 'absolute',
      bottom: 230,
      alignSelf: 'center',
      zIndex: 25,

      minWidth: 145,

      alignItems: 'center',

      borderWidth: 1,
      borderColor: '#ffffff',
      borderRadius: 22,

      paddingHorizontal: 22,
      paddingVertical: 11,

      backgroundColor:
        'rgba(0, 0, 0, 0.85)',
    },

    manualButtonText: {
      color: '#ffffff',
      fontSize: 15,
      fontWeight: '700',
    },

    scannedPanel: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,

      height: 210,

      paddingTop: 18,
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
    },

    barcodeRow: {
      borderTopWidth: 1,
      borderTopColor: '#eeeeee',
      paddingVertical: 10,
    },

    barcodeHeader: {
      flexDirection: 'row',
      justifyContent:
        'space-between',
      alignItems: 'center',
      marginBottom: 3,
    },

    packageNumber: {
      fontSize: 13,
      fontWeight: '700',
    },

    typeBadge: {
      borderRadius: 10,
      paddingHorizontal: 8,
      paddingVertical: 3,
      backgroundColor: '#eeeeee',
    },

    typeBadgeText: {
      color: '#444444',
      fontSize: 11,
      fontWeight: '700',
    },

    barcodeText: {
      color: '#333333',
      fontSize: 14,
      fontWeight: '600',
    },

    rawBarcodeText: {
      color: '#777777',
      fontSize: 11,
      marginTop: 3,
    },

    modalKeyboardView: {
      flex: 1,
    },

    modalOverlay: {
      flex: 1,
      justifyContent: 'center',

      paddingHorizontal: 24,

      backgroundColor:
        'rgba(0, 0, 0, 0.65)',
    },

    manualModal: {
      borderRadius: 12,
      padding: 22,
      backgroundColor: '#ffffff',
    },

    manualModalTitle: {
      color: '#222222',
      fontSize: 21,
      fontWeight: '700',
      marginBottom: 8,
    },

    manualModalDescription: {
      color: '#555555',
      fontSize: 14,
      lineHeight: 20,
      marginBottom: 18,
    },

    manualInput: {
      borderWidth: 1,
      borderColor: '#aaaaaa',
      borderRadius: 8,

      paddingHorizontal: 12,
      paddingVertical: 13,

      color: '#222222',
      fontSize: 16,

      marginBottom: 20,

      backgroundColor: '#ffffff',
    },

    modalButtons: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      alignItems: 'center',
      gap: 10,
    },

    cancelManualButton: {
      paddingHorizontal: 16,
      paddingVertical: 12,
    },

    cancelManualText: {
      color: '#444444',
      fontSize: 15,
      fontWeight: '600',
    },

    addManualButton: {
      borderRadius: 8,

      paddingHorizontal: 18,
      paddingVertical: 12,

      backgroundColor: '#222222',
    },

    addManualText: {
      color: '#ffffff',
      fontSize: 15,
      fontWeight: '700',
    },
  });
