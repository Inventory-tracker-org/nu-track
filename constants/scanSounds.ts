import {
    FailedScanSound,
} from '../storage/soundSettings';

export type AudibleFailedScanSound =
  Exclude<FailedScanSound, 'default'>;

/*
 * Successful scans always use this fixed sound.
 */
export const SUCCESS_SCAN_SOUND =
  require('../assets/sounds/scan.mp3');

/*
 * "default" is intentionally not included here.
 * Default means vibration only, so it has no audio file.
 */
export const FAILED_SCAN_SOUND_SOURCES:
  Record<AudibleFailedScanSound, number> = {
    buzz: require(
      '../assets/sounds/A1.mp3'
    ),

    FAHH: require(
      '../assets/sounds/F2.mp3'
    ),
};

export const FAILED_SCAN_SOUND_LABELS:
  Record<FailedScanSound, string> = {
    default: 'Vibration Only',
    buzz: 'Buzz',
    FAHH: 'FAHH',
  };