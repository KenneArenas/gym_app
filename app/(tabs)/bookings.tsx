import { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Alert,
  SafeAreaView,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { supabase } from '../../src/lib/supabase';
import { useFocusEffect } from '@react-navigation/native';
import type { Booking } from '../../src/types';

function formatDate(dateString: string): string {
  return new Intl.DateTimeFormat('es-ES', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(dateString + 'T00:00:00'));
}

export default function BookingsScreen() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<number | null>(null);

  async function getBookings() {
    setLoading(true);
    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session?.user;

    if (!user) {
      setLoading(false);
      return;
    }

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

  useFocusEffect(
    useCallback(() => {
      getBookings();
    }, [])
  );

  function confirmCancel(item: Booking) {
    Alert.alert('Cancelar reserva', '¿Seguro que quieres cancelar este día?', [
      { text: 'No', style: 'cancel' },
      { text: 'Sí', style: 'destructive', onPress: () => cancelBooking(item) },
    ]);
  }

  async function cancelBooking(item: Booking) {
    setProcessingId(item.id);

    const { error: deleteError } = await supabase
      .from('bookings')
      .delete()
      .eq('id', item.id);

    if (deleteError) {
      setProcessingId(null);
      Alert.alert('Error', 'No se pudo cancelar la reserva');
      return;
    }

    const { data: planActual, error: planFetchError } = await supabase
      .from('user_plans')
      .select('remaining_days')
      .eq('id', item.user_plan_id)
      .single();

    if (!planFetchError && planActual) {
      const newRemaining = planActual.remaining_days + 1;
      await supabase
        .from('user_plans')
        .update({ remaining_days: newRemaining, status: 'activo' })
        .eq('id', item.user_plan_id);
    }

    if (item.days) {
      await supabase
        .from('days')
        .update({ reserved_count: Math.max(0, (item.days.reserved_count ?? 1) - 1) })
        .eq('id', item.day_id);
    }

    setProcessingId(null);
    setBookings((prev) => prev.filter((b) => b.id !== item.id));
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator size="large" style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Mis reservas</Text>
        </View>

        {bookings.length === 0 && (
          <Text style={styles.empty}>No tienes reservas aún</Text>
        )}

        <FlatList
          data={bookings}
          keyExtractor={(item) => item.id?.toString()}
          renderItem={({ item }) => {
            const isProcessing = processingId === item.id;
            return (
              <View style={styles.card}>
                <Text style={styles.dateText}>
                  {item.days?.date ? formatDate(item.days.date) : 'Fecha no disponible'}
                </Text>
                <TouchableOpacity
                  style={[styles.cancelButton, isProcessing && styles.buttonDisabled]}
                  onPress={() => confirmCancel(item)}
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.cancelText}>Cancelar</Text>
                  )}
                </TouchableOpacity>
              </View>
            );
          }}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f2f4f8' },
  container: { flex: 1, padding: 20 },
  header: { marginBottom: 15 },
  title: { fontSize: 22, fontWeight: 'bold' },
  empty: { textAlign: 'center', color: '#888', marginTop: 40 },
  card: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
  },
  dateText: { fontSize: 15, fontWeight: '600', marginBottom: 8, textTransform: 'capitalize' },
  cancelButton: {
    backgroundColor: '#e74c3c',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonDisabled: { backgroundColor: '#aaa' },
  cancelText: { color: '#fff', fontWeight: '600' },
});
