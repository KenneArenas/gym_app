import { supabase } from './supabase';

/**
 * Sends a push notification via Expo Push API (best-effort, never throws).
 */
export async function sendPushNotification(
  pushToken: string,
  title: string,
  body: string,
) {
  if (!pushToken || !pushToken.startsWith('ExponentPushToken[')) return;

  try {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ to: pushToken, sound: 'default', title, body }),
    });
  } catch (err) {
    console.warn('[Push] Error sending notification:', err);
  }
}

/**
 * Fetches the push token for a user by their profile ID and sends a notification.
 */
export async function notifyUser(userId: string, title: string, body: string) {
  const { data } = await supabase
    .from('profiles')
    .select('push_token')
    .eq('id', userId)
    .single();

  if (data?.push_token) {
    await sendPushNotification(data.push_token, title, body);
  }
}

/**
 * Fetches the push token for a user by their email and sends a notification.
 */
export async function notifyUserByEmail(email: string, title: string, body: string) {
  const { data } = await supabase
    .from('profiles')
    .select('push_token')
    .eq('email', email)
    .single();

  if (data?.push_token) {
    await sendPushNotification(data.push_token, title, body);
  }
}
