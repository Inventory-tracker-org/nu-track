import * as SecureStore from 'expo-secure-store';

import { router } from 'expo-router';

import {
  useCallback,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
  FlatList,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  useFocusEffect,
} from '@react-navigation/native';

import {
  createPackages,
} from '../api/packages';

import {
  deleteDeliveryFiles,
  getQueuedDeliveries,
  removeQueuedDelivery,
  updateQueuedDelivery,
} from '../storage/deliveryStorage';

import {
  QueuedDelivery,
} from '../types/delivery';

const getDateAndTime = (
  createdAt: string
): {
  date: string;
  time: string;
} => {
  const dateObject =
    new Date(createdAt);

  return {
    date:
      dateObject
        .toISOString()
        .split('T')[0],

    time:
      dateObject
        .toLocaleTimeString(
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

export default function SyncScreen() {
  const [
    deliveries,
    setDeliveries,
  ] = useState<QueuedDelivery[]>(
    []
  );

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    syncing,
    setSyncing,
  ] = useState(false);

  const [
    syncingDeliveryId,
    setSyncingDeliveryId,
  ] = useState<string | null>(
    null
  );

  const loadDeliveries =
    useCallback(async () => {
      setLoading(true);

      try {
        const queue =
          await getQueuedDeliveries();

        setDeliveries(queue);
      } catch (error) {
        console.error(
          'Unable to load queued deliveries:',
          error
        );

        Alert.alert(
          'Unable to Load',
          'Saved deliveries could not be loaded.'
        );
      } finally {
        setLoading(false);
      }
    }, []);

  useFocusEffect(
    useCallback(() => {
      void loadDeliveries();
    }, [loadDeliveries])
  );

  const uploadDelivery = async (
    delivery: QueuedDelivery,
    token: string
  ): Promise<number> => {
    if (
      delivery.packages.length === 0
    ) {
      throw new Error(
        'The saved delivery does not contain any packages.'
      );
    }

    if (
      !delivery.lastName.trim()
    ) {
      throw new Error(
        'The saved delivery is missing the recipient last name.'
      );
    }

    if (!delivery.signatureUri) {
      throw new Error(
        'The saved delivery is missing its signature.'
      );
    }

    const {
      date,
      time,
    } = getDateAndTime(
      delivery.createdAt
    );

    const response =
      await createPackages({
        packages:
          delivery.packages,

        date,
        time,

        comment:
          delivery.notes.trim(),

        lastName:
          delivery.lastName.trim(),

        latitude:
          delivery.latitude,

        longitude:
          delivery.longitude,

        photoUri:
          delivery.photoUri,

        signatureUri:
          delivery.signatureUri,

        token,
      });

    return (
      response.package_count ??
      delivery.packages.length
    );
  };

  const markDeliveryFailed = async (
    delivery: QueuedDelivery,
    error: unknown
  ): Promise<void> => {
    const message =
      error instanceof Error
        ? error.message
        : 'Upload failed.';

    await updateQueuedDelivery({
      ...delivery,

      uploadAttempts:
        delivery.uploadAttempts + 1,

      lastError:
        message,
    });
  };

  const completeDeliverySync = async (
    delivery: QueuedDelivery
  ): Promise<void> => {
    await removeQueuedDelivery(
      delivery.id
    );

    await deleteDeliveryFiles(
      delivery.id
    );
  };

  const handleSyncOne = async (
    delivery: QueuedDelivery
  ): Promise<void> => {
    if (
      syncing ||
      syncingDeliveryId
    ) {
      return;
    }

    const token =
      await SecureStore
        .getItemAsync('token');

    if (!token) {
      Alert.alert(
        'Login Required',
        'Please log in again.'
      );

      router.replace('/login');
      return;
    }

    setSyncingDeliveryId(
      delivery.id
    );

    try {
      const packageCount =
        await uploadDelivery(
          delivery,
          token
        );

      await completeDeliverySync(
        delivery
      );

      await loadDeliveries();

      Alert.alert(
        'Delivery Synced',
        `${packageCount} ${
          packageCount === 1
            ? 'package was'
            : 'packages were'
        } uploaded successfully.`
      );
    } catch (error) {
      await markDeliveryFailed(
        delivery,
        error
      );

      await loadDeliveries();

      Alert.alert(
        'Sync Failed',
        error instanceof Error
          ? error.message
          : 'The delivery could not be uploaded.'
      );
    } finally {
      setSyncingDeliveryId(null);
    }
  };

  const handleSyncAll =
    async (): Promise<void> => {
      if (
        syncing ||
        syncingDeliveryId ||
        deliveries.length === 0
      ) {
        return;
      }

      const token =
        await SecureStore
          .getItemAsync('token');

      if (!token) {
        Alert.alert(
          'Login Required',
          'Please log in again.'
        );

        router.replace('/login');
        return;
      }

      setSyncing(true);

      let successfulDeliveries = 0;
      let failedDeliveries = 0;
      let successfulPackages = 0;

      try {
        for (
          const delivery
          of deliveries
        ) {
          setSyncingDeliveryId(
            delivery.id
          );

          try {
            const packageCount =
              await uploadDelivery(
                delivery,
                token
              );

            await completeDeliverySync(
              delivery
            );

            successfulDeliveries += 1;
            successfulPackages +=
              packageCount;
          } catch (error) {
            await markDeliveryFailed(
              delivery,
              error
            );

            failedDeliveries += 1;
          }
        }

        await loadDeliveries();

        Alert.alert(
          'Sync Complete',
          `${successfulDeliveries} ${
            successfulDeliveries === 1
              ? 'delivery'
              : 'deliveries'
          } uploaded successfully.\n` +
          `${successfulPackages} ${
            successfulPackages === 1
              ? 'package'
              : 'packages'
          } uploaded.\n` +
          `${failedDeliveries} ${
            failedDeliveries === 1
              ? 'delivery remains'
              : 'deliveries remain'
          } saved.`
        );
      } finally {
        setSyncingDeliveryId(null);
        setSyncing(false);
      }
    };

  const handleDelete = (
    delivery: QueuedDelivery
  ) => {
    Alert.alert(
      'Delete Saved Delivery',
      'This permanently deletes the saved delivery, photo, and signature.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',

          onPress: async () => {
            try {
              await removeQueuedDelivery(
                delivery.id
              );

              await deleteDeliveryFiles(
                delivery.id
              );

              await loadDeliveries();
            } catch (error) {
              Alert.alert(
                'Unable to Delete',
                error instanceof Error
                  ? error.message
                  : 'The saved delivery could not be deleted.'
              );
            }
          },
        },
      ]
    );
  };

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
          disabled={
            syncing ||
            syncingDeliveryId !== null
          }
        >
          <Text
            style={styles.backText}
          >
            ‹ Back
          </Text>
        </TouchableOpacity>

        <Text
          style={styles.title}
        >
          Saved Deliveries
        </Text>

        <Text
          style={styles.subtitle}
        >
          {deliveries.length}{' '}
          {deliveries.length === 1
            ? 'delivery'
            : 'deliveries'}{' '}
          waiting to sync
        </Text>

        {loading ? (
          <ActivityIndicator
            size="large"
          />
        ) : deliveries.length === 0 ? (
          <View
            style={styles.emptyBox}
          >
            <Text
              style={
                styles.emptyTitle
              }
            >
              Nothing to sync
            </Text>

            <Text
              style={
                styles.emptyText
              }
            >
              Saved deliveries will appear
              here.
            </Text>
          </View>
        ) : (
          <FlatList
            data={deliveries}
            keyExtractor={(item) =>
              item.id
            }
            contentContainerStyle={
              styles.listContent
            }
            showsVerticalScrollIndicator={
              false
            }
            renderItem={({ item }) => {
              const isThisDeliverySyncing =
                syncingDeliveryId ===
                item.id;

              return (
                <View
                  style={
                    styles.deliveryCard
                  }
                >
                  <Text
                    style={
                      styles.deliveryTitle
                    }
                  >
                    {item.packages.length}{' '}
                    {item.packages.length ===
                    1
                      ? 'package'
                      : 'packages'}
                  </Text>

                  <Text
                    style={
                      styles.deliveryDetail
                    }
                  >
                    Recipient:{' '}
                    {item.lastName ||
                      'Not entered'}
                  </Text>

                  <Text
                    style={
                      styles.deliveryDetail
                    }
                  >
                    Saved:{' '}
                    {new Date(
                      item.queuedAt
                    ).toLocaleString()}
                  </Text>

                  <Text
                    style={
                      styles.deliveryDetail
                    }
                  >
                    Upload attempts:{' '}
                    {item.uploadAttempts}
                  </Text>

                  {item.lastError ? (
                    <Text
                      style={
                        styles.errorText
                      }
                    >
                      Last error:{' '}
                      {item.lastError}
                    </Text>
                  ) : null}

                  <View
                    style={
                      styles.cardActions
                    }
                  >
                    <TouchableOpacity
                      style={[
                        styles.syncOneButton,

                        isThisDeliverySyncing
                          ? styles.disabledButton
                          : null,
                      ]}
                      onPress={() => {
                        void handleSyncOne(
                          item
                        );
                      }}
                      disabled={
                        syncing ||
                        syncingDeliveryId !== null
                      }
                    >
                      {isThisDeliverySyncing ? (
                        <ActivityIndicator
                          color="#ffffff"
                          size="small"
                        />
                      ) : (
                        <Text
                          style={
                            styles.syncOneText
                          }
                        >
                          Sync
                        </Text>
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={
                        styles.deleteButton
                      }
                      onPress={() =>
                        handleDelete(item)
                      }
                      disabled={
                        syncing ||
                        syncingDeliveryId !== null
                      }
                    >
                      <Text
                        style={
                          styles.deleteText
                        }
                      >
                        Delete
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            }}
          />
        )}

        <TouchableOpacity
          style={[
            styles.syncButton,

            syncing ||
            syncingDeliveryId !== null ||
            deliveries.length === 0
              ? styles.disabledButton
              : null,
          ]}
          onPress={() => {
            void handleSyncAll();
          }}
          disabled={
            syncing ||
            syncingDeliveryId !== null ||
            deliveries.length === 0
          }
        >
          {syncing ? (
            <ActivityIndicator
              color="#ffffff"
            />
          ) : (
            <Text
              style={
                styles.syncButtonText
              }
            >
              Sync All Deliveries
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles =
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: '#ffffff',
    },

    container: {
      flex: 1,
      paddingHorizontal: 24,
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

    title: {
      fontSize: 28,
      fontWeight: '700',
      marginTop: 8,
    },

    subtitle: {
      color: '#555555',
      marginTop: 6,
      marginBottom: 22,
    },

    listContent: {
      paddingBottom: 20,
    },

    deliveryCard: {
      borderWidth: 1,
      borderColor: '#cccccc',
      borderRadius: 8,

      padding: 16,
      marginBottom: 14,

      backgroundColor: '#ffffff',
    },

    deliveryTitle: {
      fontSize: 17,
      fontWeight: '700',
      marginBottom: 8,
    },

    deliveryDetail: {
      color: '#555555',
      marginBottom: 4,
    },

    errorText: {
      color: '#b00020',
      marginTop: 8,
    },

    cardActions: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 14,
      gap: 14,
    },

    syncOneButton: {
      minWidth: 88,
      alignItems: 'center',

      borderRadius: 7,

      paddingHorizontal: 16,
      paddingVertical: 10,

      backgroundColor: '#222222',
    },

    syncOneText: {
      color: '#ffffff',
      fontWeight: '700',
    },

    deleteButton: {
      paddingVertical: 8,
      paddingHorizontal: 4,
    },

    deleteText: {
      color: '#b00020',
      fontWeight: '600',
    },

    emptyBox: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },

    emptyTitle: {
      fontSize: 20,
      fontWeight: '700',
      marginBottom: 8,
    },

    emptyText: {
      color: '#666666',
    },

    syncButton: {
      backgroundColor: '#222222',
      borderRadius: 8,
      paddingVertical: 16,
      alignItems: 'center',
      marginVertical: 18,
    },

    syncButtonText: {
      color: '#ffffff',
      fontSize: 16,
      fontWeight: '700',
    },

    disabledButton: {
      opacity: 0.5,
    },
  });