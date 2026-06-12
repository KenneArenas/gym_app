import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { supabase } from '../src/lib/supabase';

// expo-notifications is not available in Expo Go since SDK 53
const isExpoGo = Constants.appOwnership === 'expo';

/**
 * Registers the device for push notifications and saves the Expo push token
 * to the user's profile in Supabase.
 * Silently skipped when running inside Expo Go (requires a development build).
 */
export function usePushNotifications(userId: string | null) {
  useEffect(() => {
    if (!userId || isExpoGo || !Device.isDevice) return;
    registerAndSaveToken(userId);
  }, [userId]);
}

async function registerAndSaveToken(userId: string) {
  try {
    // Dynamic import to avoid crashing in environments where the module is unavailable
    const Notifications = await import('expo-notifications');

    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('[Push] Permission not granted');
      return;
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Gimnasio',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        sound: 'default',
      });
    }

    const tokenData = await Notifications.getExpoPushTokenAsync();
    const token = tokenData.data;

    await supabase
      .from('profiles')
      .update({ push_token: token })
      .eq('id', userId);

    console.log('[Push] Token registered:', token);
  } catch (err) {
    console.warn('[Push] Registration error:', err);
  }
}
