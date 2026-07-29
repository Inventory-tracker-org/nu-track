import { Redirect } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

export default function Index() {
    const [loading, setLoading] = useState(true);
    const [token, setToken] = useState<string | null>(null);

    useEffect(() => {
        async function checkToken() {
            const storedToken =
                await SecureStore.getItemAsync("token");

            setToken(storedToken);
            setLoading(false);
        }

        checkToken();
    }, []);

    if (loading) {
        return (
            <View>
                <ActivityIndicator />
            </View>
        );
    }

    if (token) {
        return <Redirect href="/(tabs)" />;
    }

    return <Redirect href="/login" />;
}