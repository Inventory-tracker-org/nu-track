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

import { useFocusEffect } from '@react-navigation/native';

import { createPackage } from '../api/packages';

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
) => {
  const dateObject = new Date(createdAt);

  return {
    date:
      dateObject.toISOString().split(
        'T'
      )[0],
    time:
      dateObject.toLocaleTimeString(
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
  const [deliveries, setDeliveries] =
    useState<QueuedDelivery[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [syncing, setSyncing] =
    useState(false);

  const loadDeliveries =
    useCallback(async () => {
      setLoading(true);

      try {
        const queue =
          await getQueuedDeliveries();

        setDeliveries(queue);
      } finally {
        setLoading(false);
      }
    }, []);

  useFocusEffect(
    useCallback(() => {
      loadDeliveries();
    }, [loadDeliveries])
  );

  const uploadDelivery = async (
    delivery: QueuedDelivery,
    token: string
  ) => {
    if (!delivery.signatureUri) {
      throw new Error(
        'The saved delivery is missing its photo or signature.'
      );
    }

    const { date, time } =
      getDateAndTime(
        delivery.createdAt
      );

    for (
      const barcode of
      delivery.barcodes
    ) {
      await createPackage({
        barcode,
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
    }
  };

  const handleSyncAll = async () => {
    if (
      syncing ||
      deliveries.length === 0
    ) {
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

    setSyncing(true);

    let successCount = 0;
    let failureCount = 0;

    for (const delivery of deliveries) {
      try {
        await uploadDelivery(
          delivery,
          token
        );

        await removeQueuedDelivery(
          delivery.id
        );

        await deleteDeliveryFiles(
          delivery.id
        );

        successCount += 1;
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'Upload failed.';

        await updateQueuedDelivery({
          ...delivery,
          uploadAttempts:
            delivery.uploadAttempts + 1,
          lastError: message,
        });

        failureCount += 1;
      }
    }

    await loadDeliveries();
    setSyncing(false);

    Alert.alert(
      'Sync Complete',
      `${successCount} ${
        successCount === 1
          ? 'delivery'
          : 'deliveries'
      } uploaded.\n${failureCount} ${
        failureCount === 1
          ? 'delivery'
          : 'deliveries'
      } remain saved.`
    );
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
            await removeQueuedDelivery(
              delivery.id
            );

            await deleteDeliveryFiles(
              delivery.id
            );

            await loadDeliveries();
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          disabled={syncing}
        >
          <Text style={styles.backText}>
            ‹ Back
          </Text>
        </TouchableOpacity>

        <Text style={styles.title}>
          Saved Deliveries
        </Text>

        <Text style={styles.subtitle}>
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
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>
              Nothing to sync
            </Text>

            <Text style={styles.emptyText}>
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
            renderItem={({ item }) => (
              <View
                style={styles.deliveryCard}
              >
                <Text
                  style={
                    styles.deliveryTitle
                  }
                >
                  {item.barcodes.length}{' '}
                  {item.barcodes.length ===
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

                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() =>
                    handleDelete(item)
                  }
                  disabled={syncing}
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
            )}
          />
        )}

        <TouchableOpacity
          style={[
            styles.syncButton,
            syncing ||
            deliveries.length === 0
              ? styles.disabledButton
              : null,
          ]}
          onPress={handleSyncAll}
          disabled={
            syncing ||
            deliveries.length === 0
          }
        >
          {syncing ? (
            <ActivityIndicator
              color="#ffffff"
            />
          ) : (
            <Text
              style={styles.syncButtonText}
            >
              Sync All Deliveries
            </Text>
          )}
        </TouchableOpacity>
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
  deleteButton: {
    alignSelf: 'flex-start',
    marginTop: 12,
    paddingVertical: 6,
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