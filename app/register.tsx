import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
} from 'react-native';
import { useAppColors, type AppColors } from '../hooks/use-app-colors';
import { supabase } from '../src/lib/supabase';

export default function RegistroScreen() {
  const colors = useAppColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [document, setDocument] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function register() {
    if (!fullName.trim() || !email.trim() || !password || !confirmPassword) {
      Alert.alert('Campos requeridos', 'Completa nombre, email y contraseña');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Las contraseñas no coinciden');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Error', 'La contraseña debe tener al menos 6 caracteres');
      return;
    }

    setLoading(true);

    // 1. Crear cuenta en Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
    });

    if (authError) {
      setLoading(false);
      Alert.alert('Error al registrar', authError.message);
      return;
    }

    const userId = authData.user?.id;
    if (!userId) {
      setLoading(false);
      Alert.alert('Error', 'No se pudo obtener el ID del usuario');
      return;
    }

    // 2. Crear perfil (pendiente de aprobación)
    const { error: profileError } = await supabase.from('profiles').upsert({
      id: userId,
      email: email.trim().toLowerCase(),
      full_name: fullName.trim(),
      phone: phone.trim() || null,
      role: 'cliente',
      is_approved: false,
    });

    if (profileError) {
      setLoading(false);
      Alert.alert('Error', 'No se pudo crear el perfil: ' + profileError.message);
      return;
    }

    // 3. Insertar solicitud para que admin la revise
    const { error: solicitudError } = await supabase.from('solicitudes').insert({
      full_name: fullName.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim() || null,
      document: document.trim() || null,
      status: 'pendiente',
    });

    setLoading(false);

    if (solicitudError) {
      // No es bloqueante, la cuenta ya fue creada
      console.warn('Solicitud no insertada:', solicitudError.message);
    }

    Alert.alert(
      'Solicitud enviada',
      'Tu solicitud fue recibida. El administrador la revisará y recibirás acceso pronto.',
      [{ text: 'Entendido', onPress: () => router.replace('/login') }]
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Solicitud de acceso</Text>
        <Text style={styles.subtitle}>
          Completa el formulario y el administrador aprobará tu acceso
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Nombre completo *"
          value={fullName}
          onChangeText={setFullName}
          autoCapitalize="words"
        />

        <TextInput
          style={styles.input}
          placeholder="Correo electrónico *"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
        />

        <TextInput
          style={styles.input}
          placeholder="Teléfono"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
        />

        <TextInput
          style={styles.input}
          placeholder="Número de documento (cédula)"
          value={document}
          onChangeText={setDocument}
          keyboardType="numeric"
        />

        <TextInput
          style={styles.input}
          placeholder="Contraseña * (mín. 6 caracteres)"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TextInput
          style={styles.input}
          placeholder="Confirmar contraseña *"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
        />

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={register}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Enviar solicitud</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backText}>¿Ya tienes cuenta? Iniciar sesión</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function createStyles(c: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    scroll: { padding: 24, paddingBottom: 40 },
    title: {
      fontSize: 28,
      fontWeight: 'bold',
      textAlign: 'center',
      color: '#007aff',
      marginBottom: 8,
      marginTop: 20,
    },
    subtitle: {
      fontSize: 14,
      textAlign: 'center',
      color: c.textSec,
      marginBottom: 28,
      lineHeight: 20,
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
      padding: 15,
      alignItems: 'center',
      marginTop: 8,
    },
    buttonDisabled: { opacity: 0.6 },
    buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
    backButton: { marginTop: 20, alignItems: 'center' },
    backText: { color: '#007aff', fontSize: 14 },
  });
}
