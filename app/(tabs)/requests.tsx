import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
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
import { useAppColors, type AppColors } from '../../hooks/use-app-colors';
import { formatDateTime } from '../../src/lib/dates';
import { notifyUserByEmail } from '../../src/lib/notifications';
import { supabase } from '../../src/lib/supabase';
import type { Solicitud } from '../../src/types';

export default function SolicitudesScreen() {
  const colors = useAppColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<number | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadSolicitudes();
    }, [])
  );

  async function loadSolicitudes() {
    setLoading(true);
    const { data, error } = await supabase
      .from('solicitudes')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      Alert.alert('Error', 'No se pudieron cargar las solicitudes');
    } else {
      setSolicitudes(data || []);
    }
    setLoading(false);
  }

  async function aprobar(item: Solicitud) {
    Alert.alert(
      'Aprobar solicitud',
      `¿Aprobar acceso para ${item.full_name}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Aprobar',
          onPress: async () => {
            setProcessingId(item.id);

            // 1. Actualizar solicitud
            const { error: solError } = await supabase
              .from('solicitudes')
              .update({ status: 'aprobada' })
              .eq('id', item.id);

            if (solError) {
              setProcessingId(null);
              Alert.alert('Error', 'No se pudo actualizar la solicitud');
              return;
            }

            // 2. Aprobar el perfil del usuario
            const { error: profileError } = await supabase
              .from('profiles')
              .update({ is_approved: true })
              .eq('email', item.email);

            setProcessingId(null);

            if (profileError) {
              Alert.alert('Advertencia', 'Solicitud aprobada pero no se encontró el perfil del usuario');
            } else {
              // 3. Notificar al cliente
              await notifyUserByEmail(
                item.email,
                '¡Bienvenido al gimnasio! 🎉',
                'Tu solicitud fue aprobada. Ya puedes iniciar sesión y reservar tus días.',
              );
              Alert.alert('Aprobado', `${item.full_name} ya puede acceder a la app`);
            }

            loadSolicitudes();
          },
        },
      ]
    );
  }

  async function rechazar(item: Solicitud) {
    Alert.alert(
      'Rechazar solicitud',
      `¿Rechazar la solicitud de ${item.full_name}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Rechazar',
          style: 'destructive',
          onPress: async () => {
            setProcessingId(item.id);

            const { error } = await supabase
              .from('solicitudes')
              .update({ status: 'rechazada' })
              .eq('id', item.id);

            setProcessingId(null);

            if (error) {
              Alert.alert('Error', 'No se pudo rechazar la solicitud');
            } else {
              // Notificar al cliente
              await notifyUserByEmail(
                item.email,
                'Solicitud de acceso',
                'Tu solicitud no fue aprobada. Contacta al gimnasio para más información.',
              );
              loadSolicitudes();
            }
          },
        },
      ]
    );
  }

  const pendientes = solicitudes.filter((s) => s.status === 'pendiente');
  const procesadas = solicitudes.filter((s) => s.status !== 'pendiente');

  function renderItem({ item }: { item: Solicitud }) {
    const isProcesando = processingId === item.id;
    const isPendiente = item.status === 'pendiente';

    return (
      <View style={[styles.card, !isPendiente && styles.cardProcessed]}>
        <View style={styles.cardHeader}>
          <Text style={styles.name}>{item.full_name}</Text>
          <View style={[styles.badge, styles[`badge_${item.status}`]]}>
            <Text style={styles.badgeText}>
              {item.status === 'pendiente' ? 'Pendiente' : item.status === 'aprobada' ? 'Aprobada' : 'Rechazada'}
            </Text>
          </View>
        </View>

        <Text style={styles.detail}>📧 {item.email}</Text>
        {item.phone ? <Text style={styles.detail}>📞 {item.phone}</Text> : null}
        {item.document ? <Text style={styles.detail}>🪪 {item.document}</Text> : null}
        <Text style={styles.date}>{formatDateTime(item.created_at)}</Text>

        {isPendiente && (
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.btnAprobar, isProcesando && styles.btnDisabled]}
              onPress={() => aprobar(item)}
              disabled={isProcesando}
            >
              {isProcesando ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.btnText}>✓ Aprobar</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.btnRechazar, isProcesando && styles.btnDisabled]}
              onPress={() => rechazar(item)}
              disabled={isProcesando}
            >
              <Text style={styles.btnText}>✗ Rechazar</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator style={{ flex: 1 }} size="large" color="#007aff" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <FlatList
        data={[...pendientes, ...procesadas]}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <Text style={styles.title}>
            Solicitudes ({pendientes.length} pendientes)
          </Text>
        }
        ListEmptyComponent={
          <Text style={styles.empty}>No hay solicitudes registradas</Text>
        }
        renderItem={renderItem}
      />
    </SafeAreaView>
  );
}

function createStyles(c: AppColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    list: { padding: 16, paddingBottom: 40 },
    title: { fontSize: 22, fontWeight: 'bold', marginBottom: 16, color: c.text },
    empty: { textAlign: 'center', color: c.textMuted, marginTop: 40, fontSize: 15 },
    card: {
      backgroundColor: c.card,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      shadowColor: '#000',
      shadowOpacity: 0.06,
      shadowRadius: 6,
      elevation: 2,
    },
    cardProcessed: { opacity: 0.7 },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    name: { fontSize: 16, fontWeight: '700', color: c.text, flex: 1 },
    badge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
    badge_pendiente: { backgroundColor: '#ff9500' },
    badge_aprobada: { backgroundColor: '#34c759' },
    badge_rechazada: { backgroundColor: '#ff3b30' },
    badgeText: { color: '#fff', fontSize: 12, fontWeight: '600' },
    detail: { fontSize: 14, color: c.textSec, marginBottom: 3 },
    date: { fontSize: 12, color: c.textMuted, marginTop: 4 },
    actions: { flexDirection: 'row', gap: 10, marginTop: 12 },
    btnAprobar: { flex: 1, backgroundColor: '#34c759', borderRadius: 8, padding: 10, alignItems: 'center' },
    btnRechazar: { flex: 1, backgroundColor: '#ff3b30', borderRadius: 8, padding: 10, alignItems: 'center' },
    btnDisabled: { opacity: 0.5 },
    btnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  });
}
