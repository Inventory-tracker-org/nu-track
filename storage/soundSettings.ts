import AsyncStorage from '@react-native-async-storage/async-storage';

export type FailedScanSound =
  | 'default'
  | 'buzz'
  | 'FAHH';

export const DEFAULT_FAILED_SCAN_SOUND:
  FailedScanSound = 'default';

const FAILED_SCAN_SOUND_KEY =
  '@packageTracker/failedScanSound';

const isFailedScanSound = (
  value: string
): value is FailedScanSound => {
  return [
    'default',
    'buzz',
    'FAHH',
  ].includes(value);
};

export const getFailedScanSound =
  async (): Promise<FailedScanSound> => {
    const value =
      await AsyncStorage.getItem(
        FAILED_SCAN_SOUND_KEY
      );

    if (
      value &&
      isFailedScanSound(value)
    ) {
      return value;
    }

    return DEFAULT_FAILED_SCAN_SOUND;
  };

export const saveFailedScanSound =
  async (
    sound: FailedScanSound
  ): Promise<void> => {
    await AsyncStorage.setItem(
      FAILED_SCAN_SOUND_KEY,
      sound
    );
  };