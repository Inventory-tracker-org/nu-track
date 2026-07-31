import * as SecureStore from 'expo-secure-store';

import { router } from 'expo-router';

import {
    useEffect,
    useState,
} from 'react';

import {
    ActivityIndicator,
    Alert,
    SafeAreaView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

import {
    FAILED_SCAN_SOUND_LABELS
} from '../constants/scanSounds';

import {
    FailedScanSound,
    getFailedScanSound,
    saveFailedScanSound,
} from '../storage/soundSettings';

/*
 * Must match the ID in home-screen.tsx and scan.tsx.
 */
const SOUND_SETTINGS_USER_ID = 193;

type StoredUser = {
  id: number | string;
};

const SOUND_OPTIONS:
  FailedScanSound[] = [
    'buzz',
    'FAHH',
    'default'
  ];

  const [
  selectedSound,
  setSelectedSound,
] = useState<FailedScanSound>(
  'default'
);

export default function SettingsScreen() {
  const [
    selectedSound,
    setSelectedSound,
  ] = useState<FailedScanSound>(
    'default'
  );

  const [
    authorized,
    setAuthorized,
  ] = useState(false);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  useEffect(() => {
    const initialize =
      async () => {
        try {
          const storedUser =
            await SecureStore.getItemAsync(
              'current_user'
            );

          if (!storedUser) {
            setAuthorized(false);
            return;
          }

          const user =
            JSON.parse(
              storedUser
            ) as StoredUser;

          const userIsAuthorized =
            Number(user.id) ===
            SOUND_SETTINGS_USER_ID;

          setAuthorized(
            userIsAuthorized
          );

          if (!userIsAuthorized) {
            return;
          }

          const savedSound =
            await getFailedScanSound();

          setSelectedSound(
            savedSound
          );

        } catch (error) {
          console.warn(
            'Unable to initialize failed-scan settings:',
            error
          );

          setAuthorized(false);
        } finally {
          setLoading(false);
        }
      };

    void initialize();
  }, []);

  const handleSelectSound =
    async (
      sound: FailedScanSound
    ): Promise<void> => {
      if (
        saving ||
        !authorized
      ) {
        return;
      }

      setSaving(true);

      try {
        setSelectedSound(sound);

        await saveFailedScanSound(
          sound
        );

      } catch (error) {
        Alert.alert(
          'Unable to Save',
          error instanceof Error
            ? error.message
            : 'The sound setting could not be saved.'
        );
      } finally {
        setSaving(false);
      }
    };

  if (loading) {
    return (
      <SafeAreaView
        style={styles.safeArea}
      >
        <View
          style={styles.centered}
        >
          <ActivityIndicator
            size="large"
          />

          <Text
            style={
              styles.loadingText
            }
          >
            Loading settings...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!authorized) {
    return (
      <SafeAreaView
        style={styles.safeArea}
      >
        <View
          style={styles.container}
        >
          <TouchableOpacity
            style={styles.backButton}
            onPress={() =>
              router.replace(
                '/home-screen'
              )
            }
          >
            <Text
              style={styles.backText}
            >
              ‹ Back
            </Text>
          </TouchableOpacity>

          <View
            style={
              styles.unauthorizedBox
            }
          >
            <Text
              style={
                styles.unauthorizedTitle
              }
            >
              Settings Unavailable
            </Text>

            <Text
              style={
                styles.unauthorizedText
              }
            >
              This account does not have
              access to failed-scan sound
              settings.
            </Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={styles.safeArea}
    >
      <View
        style={styles.container}
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={() =>
            router.back()
          }
          disabled={saving}
        >
          <Text
            style={styles.backText}
          >
            ‹ Back
          </Text>
        </TouchableOpacity>

        <Text style={styles.title}>
          Failed Scan Sound
        </Text>

        <Text
          style={styles.subtitle}
        >
          Choose the sound played when
          a barcode is duplicated,
          invalid, or rejected.
        </Text>

        <View
          style={styles.options}
        >
          {SOUND_OPTIONS.map(
            (sound) => {
              const selected =
                selectedSound ===
                sound;

              return (
                <TouchableOpacity
                  key={sound}
                  style={[
                    styles.soundOption,
                    selected
                      ? styles.selectedOption
                      : null,
                  ]}
                  onPress={() =>
                    void handleSelectSound(
                      sound
                    )
                  }
                  disabled={saving}
                  activeOpacity={0.8}
                >
                  <View
                    style={
                      styles.optionText
                    }
                  >
                    <Text
                      style={
                        styles.soundLabel
                      }
                    >
                      {
                        FAILED_SCAN_SOUND_LABELS[
                          sound
                        ]
                      }
                    </Text>

                    <Text
                      style={
                        styles.soundDescription
                      }
                    >
                      {selected
                        ? 'Currently selected'
                        : 'Tap to select'}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.radioOuter,
                      selected
                        ? styles.radioOuterSelected
                        : null,
                    ]}
                  >
                    {selected ? (
                      <View
                        style={
                          styles.radioInner
                        }
                      />
                    ) : null}
                  </View>
                </TouchableOpacity>
              );
            }
          )}
        </View>

        <Text
          style={styles.helpText}
        >
          Successful scans will continue
          using the normal fixed scanner
          sound. This setting affects
          rejected scans only.
        </Text>
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
    paddingHorizontal: 24,
  },

  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },

  loadingText: {
    marginTop: 14,
    color: '#555555',
  },

  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: 16,
    paddingRight: 20,
  },

  backText: {
    fontSize: 17,
    fontWeight: '600',
  },

  title: {
    marginTop: 10,
    fontSize: 28,
    fontWeight: '700',
  },

  subtitle: {
    marginTop: 8,
    marginBottom: 26,
    color: '#555555',
    fontSize: 15,
    lineHeight: 21,
  },

  options: {
    gap: 12,
  },

  soundOption: {
    minHeight: 76,

    flexDirection: 'row',
    alignItems: 'center',
    justifyContent:
      'space-between',

    borderWidth: 1,
    borderColor: '#cccccc',
    borderRadius: 8,

    paddingHorizontal: 16,
    paddingVertical: 14,

    backgroundColor: '#ffffff',
  },

  selectedOption: {
    borderWidth: 2,
    borderColor: '#222222',
    backgroundColor: '#f5f5f5',
  },

  optionText: {
    flex: 1,
    paddingRight: 16,
  },

  soundLabel: {
    color: '#222222',
    fontSize: 17,
    fontWeight: '700',
  },

  soundDescription: {
    marginTop: 5,
    color: '#666666',
    fontSize: 13,
  },

  radioOuter: {
    width: 22,
    height: 22,

    alignItems: 'center',
    justifyContent: 'center',

    borderWidth: 2,
    borderColor: '#aaaaaa',
    borderRadius: 11,
  },

  radioOuterSelected: {
    borderColor: '#222222',
  },

  radioInner: {
    width: 10,
    height: 10,

    borderRadius: 5,
    backgroundColor: '#222222',
  },

  helpText: {
    marginTop: 24,

    color: '#666666',
    fontSize: 13,
    lineHeight: 19,
  },

  unauthorizedBox: {
    marginTop: 80,

    borderWidth: 1,
    borderColor: '#cccccc',
    borderRadius: 8,

    padding: 22,

    backgroundColor: '#f7f7f7',
  },

  unauthorizedTitle: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },

  unauthorizedText: {
    marginTop: 8,

    color: '#555555',
    lineHeight: 20,
    textAlign: 'center',
  },
});