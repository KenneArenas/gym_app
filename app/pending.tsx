import { router } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppColors, type AppColors } from '../hooks/use-app-colors';
import { supabase } from '../src/lib/supabase';

export default function PendienteScreen() {
  const colors = useAppColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  async function logout() {
    await supabase.auth.signOut();
    router.replace('/login');
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <Text style={styles.icon}>⏳</Text>
      <Text style={styles.title}>Solicitud en revisión</Text>
      <Text style={styles.message}>
        Tu solicitud de acceso está siendo revisada por el administrador.{'\n\n'}
        Recibirás acceso una vez que sea aprobada. Por favor vuelve a intentar iniciar sesión
        más tarde.
      </Text>
      <TouchableOpacity style={styles.button} onPress={logout}>
        <Text style={styles.buttonText}>Cerrar sesión</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

function createStyles(c: AppColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 32,
      backgroundColor: c.bg,
    },
    icon: { fontSize: 64, marginBottom: 20 },
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      color: c.text,
      marginBottom: 16,
      textAlign: 'center',
    },
    message: {
      fontSize: 15,
      color: c.textSec,
      textAlign: 'center',
      lineHeight: 22,
      marginBottom: 40,
    },
    button: {
      backgroundColor: '#ff3b30',
      borderRadius: 10,
      paddingVertical: 12,
      paddingHorizontal: 32,
    },
    buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  });
}
