import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useState } from 'react';
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
import { supabase } from '../../src/lib/supabase';
import type { Day, UserPlan } from '../../src/types';

function formatDate(dateString: string): string {
  return new Intl.DateTimeFormat('es-ES', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(dateString + 'T00:00:00'));
}

export default function HomeScreen() {
  const [user, setUser] = useState<any>(null);
  const [userPlan, setUserPlan] = useState<UserPlan | null>(null);
  const [days, setDays] = useState<Day[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingDayId, setProcessingDayId] = useState<number | null>(null);
  const [bookedDayIds, setBookedDayIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    supabase.auth.getSession().then((result: { data: { session: { user: any } | null } }) => {
      setUser(result.data.session?.user ?? null);
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (user) load();
    }, [user])
  );

  async function load() {
    setLoading(true);
    await Promise.all([getUserPlan(), getDays(), getBookedDays()]);
    setLoading(false);
  }

  async function getUserPlan() {
    const { data, error } = await supabase
      .from('user_plans')
      .select(`*, plans(name)`)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      Alert.alert('Error', 'No se pudo cargar el plan');
      return;
    }
    setUserPlan(data?.length ? data[0] : null);
  }

  async function getDays() {
    const { data, error } = await supabase
      .from('days')
      .select('*')
      .order('date');

    if (error) {
      Alert.alert('Error', 'No se pudieron cargar los días');
      return;
    }
    setDays(data || []);
  }

  async function getBookedDays() {
    const { data } = await supabase
      .from('bookings')
      .select('day_id')
      .eq('user_id', user.id);

    if (data) {
      setBookedDayIds(new Set(data.map((b: { day_id: number }) => b.day_id)));
    }
  }

  async function bookDay(day: Day) {
    if (!userPlan || userPlan.remaining_days <= 0) {
      Alert.alert('Plan agotado', 'No tienes días disponibles en tu plan');
      return;
    }

    if (bookedDayIds.has(day.id)) {
      Alert.alert('Ya reservado', 'Ya tienes una reserva para este día');
      return;
    }

    if (day.max_capacity != null && day.reserved_count >= day.max_capacity) {
      Alert.alert('Sin plazas', 'Este día ya está completo');
      return;
    }

    setProcessingDayId(day.id);

    const { error: bookingError } = await supabase.from('bookings').insert([{
      user_id: user.id,
      day_id: day.id,
      user_plan_id: userPlan.id,
    }]);

    if (bookingError) {
      setProcessingDayId(null);
      Alert.alert('Error', 'No se pudo crear la reserva');
      return;
    }

    const newRemaining = userPlan.remaining_days - 1;

    const { error: planError } = await supabase
      .from('user_plans')
      .update({
        remaining_days: newRemaining,
        status: newRemaining <= 0 ? 'inactivo' : 'activo',
      })
      .eq('id', userPlan.id);

    if (planError) {
      setProcessingDayId(null);
      Alert.alert('Error', 'No se pudo actualizar el plan');
      return;
    }

    await supabase
      .from('days')
      .update({ reserved_count: day.reserved_count + 1 })
      .eq('id', day.id);

    setUserPlan({ ...userPlan, remaining_days: newRemaining });
    setBookedDayIds((prev: Set<number>) => new Set([...prev, day.id]));
    setDays((prev: Day[]) =>
      prev.map((d: Day) =>
        d.id === day.id ? { ...d, reserved_count: d.reserved_count + 1 } : d
      )
    );
    setProcessingDayId(null);
    Alert.alert('Reservado', 'Tu plaza está confirmada');
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Inicio</Text>

      {userPlan ? (
        <View style={styles.planCard}>
          <Text style={styles.planName}>{userPlan.plans?.name}</Text>
          <Text style={styles.planDays}>
            {userPlan.remaining_days > 0
              ? `${userPlan.remaining_days} días restantes`
              : 'Plan agotado'}
          </Text>
        </View>
      ) : (
        <View style={styles.planCard}>
          <Text style={styles.planDays}>Sin plan activo. Ve a Planes para contratar uno.</Text>
        </View>
      )}

      <FlatList
        data={days}
        keyExtractor={(item: Day) => item.id.toString()}
        ListEmptyComponent={<Text style={styles.empty}>No hay días disponibles</Text>}
        renderItem={({ item }: { item: Day }) => {
          const isBooked = bookedDayIds.has(item.id);
          const isFull = item.max_capacity != null && item.reserved_count >= item.max_capacity;
          const isProcessing = processingDayId === item.id;

          return (
            <View style={styles.card}>
              <Text style={styles.dateText}>{formatDate(item.date)}</Text>
              {item.max_capacity != null && (
                <Text style={styles.capacityText}>
                  {item.reserved_count}/{item.max_capacity} plazas
                </Text>
              )}
              <TouchableOpacity
                style={[
                  styles.button,
                  (isBooked || isFull || isProcessing) && styles.buttonDisabled,
                ]}
                onPress={() => bookDay(item)}
                disabled={isBooked || isFull || isProcessing}
              >
                {isProcessing ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>
                    {isBooked ? 'Reservado' : isFull ? 'Sin plazas' : 'Reservar'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#f2f4f8' },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 15 },
  planCard: {
    backgroundColor: '#d4edda',
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
  },
  planName: { fontSize: 16, fontWeight: 'bold' },
  planDays: { fontSize: 14, color: '#333', marginTop: 4 },
  empty: { textAlign: 'center', color: '#888', marginTop: 40 },
  card: {
    padding: 15,
    backgroundColor: '#fff',
    marginBottom: 10,
    borderRadius: 10,
  },
  dateText: { fontSize: 15, fontWeight: '600', marginBottom: 4, textTransform: 'capitalize' },
  capacityText: { fontSize: 13, color: '#666', marginBottom: 8 },
  button: {
    backgroundColor: '#007aff',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonDisabled: { backgroundColor: '#aaa' },
  buttonText: { color: '#fff', fontWeight: '600' },
});
