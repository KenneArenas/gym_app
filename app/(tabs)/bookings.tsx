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
import { formatDate, todayBogota } from '../../src/lib/dates';
import { supabase } from '../../src/lib/supabase';
import type { Booking } from '../../src/types';

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  confirmada:  { label: 'Confirmada',  color: '#34c759' },
  cancelada:   { label: 'Cancelada',   color: '#ff3b30' },
  asistio:     { label: 'Asistió',     color: '#007aff' },
  no_asistio:  { label: 'No asistió',  color: '#ff9500' },
};

export default function BookingsScreen() {
  const colors = useAppColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [cancelHoursLimit, setCancelHoursLimit] = useState(2);

  useFocusEffect(
    useCallback(() => {
      loadAll();
    }, [])
  );

  async function loadAll() {
    setLoading(true);
    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session?.user;
    if (!user) { setLoading(false); return; }

    // Cargar límite de cancelación desde settings
    const { data: setting } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'cancel_hours_limit')
      .maybeSingle();
    if (setting) setCancelHoursLimit(parseInt(setting.value, 10) || 2);

    const { data, error } = await supabase
      .from('bookings')
      .select('*, days(*)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      Alert.alert('Error', 'No se pudieron cargar las reservas');
    } else {
      setBookings(data || []);
    }
    setLoading(false);
  }

  function canCancel(item: Booking): boolean {
    if (item.status !== 'confirmada') return false;
    if (!item.days?.date) return false;

    // Hora límite = medianoche del día de la reserva (zona local)
    const reservationDate = new Date(item.days.date + 'T00:00:00');
    const now = new Date();
    const hoursUntil = (reservationDate.getTime() - now.getTime()) / (1000 * 60 * 60);
    return hoursUntil >= cancelHoursLimit;
  }

  function confirmCancel(item: Booking) {
    if (!canCancel(item)) {
      Alert.alert(
        'No se puede cancelar',
        `Las cancelaciones deben hacerse con al menos ${cancelHoursLimit} hora(s) de anticipación.`
      );
      return;
    }
    Alert.alert('Cancelar reserva', '¿Seguro que quieres cancelar este día?', [
      { text: 'No', style: 'cancel' },
      { text: 'Sí', style: 'destructive', onPress: () => cancelBooking(item) },
    ]);
  }

  async function cancelBooking(item: Booking) {
    setProcessingId(item.id);

    const { error: updateError } = await supabase
      .from('bookings')
      .update({ status: 'cancelada' })
      .eq('id', item.id);

    if (updateError) {
      setProcessingId(null);
      Alert.alert('Error', 'No se pudo cancelar la reserva');
      return;
    }

    // Devolver día al plan
    const { data: planActual } = await supabase
      .from('user_plans')
      .select('remaining_days')
      .eq('id', item.user_plan_id)
      .single();

    if (planActual) {
      await supabase
        .from('user_plans')
        .update({ remaining_days: planActual.remaining_days + 1, status: 'activo' })
        .eq('id', item.user_plan_id);
    }

    // Reducir contador del día
    if (item.days) {
      await supabase
        .from('days')
        .update({ reserved_count: Math.max(0, (item.days.reserved_count ?? 1) - 1) })
        .eq('id', item.day_id);
    }

    setProcessingId(null);
    setBookings((prev) =>
      prev.map((b) => (b.id === item.id ? { ...b, status: 'cancelada' } : b))
    );
  }

  const today = todayBogota();
  const futuras = bookings.filter((b) => b.days?.date && b.days.date >= today && b.status === 'confirmada');
  const pasadas = bookings.filter((b) => !futuras.includes(b));

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator size="large" style={{ flex: 1 }} color="#007aff" />
      </SafeAreaView>
    );
  }

  function renderItem({ item }: { item: Booking }) {
    const isProcessing = processingId === item.id;
    const statusInfo = STATUS_LABELS[item.status ?? 'confirmada'] ?? STATUS_LABELS.confirmada;
    const cancelable = canCancel(item);

    return (
      <View style={styles.card}>
        <View style={styles.cardRow}>
          <Text style={styles.dateText}>
            {item.days?.date ? formatDate(item.days.date) : 'Fecha no disponible'}
          </Text>
          <View style={[styles.badge, { backgroundColor: statusInfo.color }]}>
            <Text style={styles.badgeText}>{statusInfo.label}</Text>
          </View>
        </View>

        {item.status === 'confirmada' && (
          <TouchableOpacity
            style={[
              styles.cancelButton,
              !cancelable && styles.cancelButtonDisabled,
              isProcessing && styles.cancelButtonDisabled,
            ]}
            onPress={() => confirmCancel(item)}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.cancelText}>
                {cancelable ? 'Cancelar reserva' : `Cancelación bloqueada (< ${cancelHoursLimit}h)`}
              </Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <FlatList
        data={[...futuras, ...pasadas]}
        keyExtractor={(item) => item.id?.toString()}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <Text style={styles.title}>
            Mis reservas ({futuras.length} próximas)
          </Text>
        }
        ListEmptyComponent={
          <Text style={styles.empty}>No tienes reservas aún</Text>
        }
        renderItem={renderItem}
        ItemSeparatorComponent={() => {
          const firstPasada = pasadas[0];
          return firstPasada ? <View style={styles.separator} /> : null;
        }}
      />
    </SafeAreaView>
  );
}

function createStyles(c: AppColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    list: { padding: 16, paddingBottom: 40 },
    title: { fontSize: 22, fontWeight: 'bold', color: c.text, marginBottom: 16 },
    empty: { textAlign: 'center', color: c.textMuted, marginTop: 40 },
    separator: { height: 1, backgroundColor: c.rowSep, marginVertical: 12 },

    card: {
      backgroundColor: c.card, borderRadius: 12, padding: 16,
      marginBottom: 10, elevation: 1, shadowColor: '#000',
      shadowOpacity: 0.05, shadowRadius: 4,
    },
    cardRow: {
      flexDirection: 'row', justifyContent: 'space-between',
      alignItems: 'flex-start', marginBottom: 10,
    },
    dateText: {
      fontSize: 14, fontWeight: '600', color: c.text,
      textTransform: 'capitalize', flex: 1, marginRight: 8,
    },
    badge: {
      borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3,
    },
    badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },

    cancelButton: {
      backgroundColor: '#ff3b30', padding: 10,
      borderRadius: 8, alignItems: 'center',
    },
    cancelButtonDisabled: { backgroundColor: '#ccc' },
    cancelText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  });
}
