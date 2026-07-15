import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppColors, type AppColors } from '../hooks/use-app-colors';
import { supabase } from '../src/lib/supabase';


export default function LoginScreen() {
  const colors = useAppColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function signIn() {
    if (!email.trim() || !password) {
      Alert.alert('Campos requeridos', 'Ingresa tu email y contraseña');
      return;
    }

    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    setLoading(false);

    if (error) {
      Alert.alert('Error al iniciar sesión', error.message);
      return;
    }

    if (data.user) {
      // Verificar si está aprobado
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_approved')
        .eq('email', data.user.email)
        .maybeSingle();

      if (profile && profile.is_approved === false) {
        router.replace('/pending' as any);
      } else {
        router.replace('/');
      }
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Text style={styles.title}>Gimnasio</Text>
        <Text style={styles.subtitle}>Inicia sesión para continuar</Text>

        <TextInput
          style={styles.input}
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
        />

        <TextInput
          style={styles.input}
          placeholder="Contraseña"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="password"
        />

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={signIn}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Iniciar sesión</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.registerButton}
          onPress={() => router.push('/register' as any)}
        >
          <Text style={styles.registerText}>¿No tienes cuenta? Solicitar acceso</Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function createStyles(c: AppColors) {
  return StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: c.bg,
    },
    container: {
      flex: 1,
      justifyContent: 'center',
      padding: 24,
      backgroundColor: c.bg,
    },
    title: {
      fontSize: 32,
      fontWeight: 'bold',
      textAlign: 'center',
      marginBottom: 8,
      color: '#007aff',
    },
    subtitle: {
      fontSize: 16,
      textAlign: 'center',
      color: c.textSec,
      marginBottom: 32,
    },
    input: {
      backgroundColor: c.card,
      borderRadius: 10,
      padding: 14,
      marginBottom: 12,
      fontSize: 16,
      borderWidth: 1,
      borderColor: c.border,
      color: c.text,
    },
    button: {
      backgroundColor: '#007aff',
      borderRadius: 10,
      padding: 14,
      alignItems: 'center',
      marginTop: 8,
    },
    buttonDisabled: { backgroundColor: '#aaa' },
    buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
    registerButton: { marginTop: 20, alignItems: 'center' },
    registerText: { color: '#007aff', fontSize: 14 },
  });
}