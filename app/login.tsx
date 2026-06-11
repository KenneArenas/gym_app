import { View, Text, Button, StyleSheet } from 'react-native';
import { supabase } from '../src/lib/supabase';
import { router } from 'expo-router';

export default function LoginScreen() {

  async function signIn() {
    const { data } = await supabase.auth.signInWithPassword({
      email: 'prueba@gym.com',
      password: '123456',
    });

    if (data.user) {
      router.replace('/'); // 👉 ir a Home
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Login</Text>
      <Button title="Iniciar sesión" onPress={signIn} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    marginBottom: 20,
  },
});