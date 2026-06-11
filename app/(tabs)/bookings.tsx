import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Button,
  Alert,
  SafeAreaView
} from 'react-native';
import { supabase } from '../../src/lib/supabase';
import { useFocusEffect } from '@react-navigation/native';

export default function BookingsScreen() {

  const [bookings, setBookings] = useState<any[]>([]);

  async function getBookings() {
    const { data } = await supabase.auth.getSession();
    const user = data.session?.user;

    if (!user) return;

    const { data: bookingsData } = await supabase
      .from('bookings')
      .select('*, days(*)')
      .eq('user_id', user.id);

    if (bookingsData) setBookings(bookingsData);
  }

  useFocusEffect(
    useCallback(() => {
      getBookings();
    }, [])
  );

  function confirmCancel(item: any) {
    Alert.alert('Cancelar reserva', '¿Seguro?', [
      { text: 'No' },
      {
        text: 'Sí',
        onPress: () => cancelBooking(item),
      },
    ]);
  }

  // ✅ CANCELAR
  async function cancelBooking(item: any) {

    // ✅ BORRAR RESERVA
    await supabase
      .from('bookings')
      .delete()
      .eq('id', item.id);

    // ✅ TRAER PLAN ACTUAL
    const { data: planActual } = await supabase
      .from('user_plans')
      .select('remaining_days')
      .eq('id', item.user_plan_id)
      .single();

    const newRemaining = planActual?.remaining_days + 1;

    // ✅ ACTUALIZAR PLAN (REACTIVAR SI APLICA)
    await supabase
      .from('user_plans')
      .update({
        remaining_days: newRemaining,
        status: newRemaining > 0 ? 'activo' : 'inactivo',
      })
      .eq('id', item.user_plan_id);

    // ✅ ACTUALIZAR DÍA
    await supabase
      .from('days')
      .update({
        reserved_count: item.days?.reserved_count - 1,
      })
      .eq('id', item.day_id);

    getBookings();
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>

        {/* 🔥 HEADER COMO HOME */}
        <View style={styles.header}>
          <Text style={styles.title}>Mis reservas</Text>
        </View>

        {bookings.length === 0 && (
          <Text style={styles.empty}>No tienes reservas aún</Text>
        )}

        <FlatList
          data={bookings}
          keyExtractor={(item) => item.id?.toString()}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.text}>
                Fecha: {item.days?.date}
              </Text>

              <Button
                title="Cancelar"
                color="red"
                onPress={() => confirmCancel(item)}
              />
            </View>
          )}
        />

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({

  safe: {
    flex: 1,
    backgroundColor: '#fff',
  },

  container: {
    flex: 1,
    padding: 20,
  },

  // 🔥 NUEVO HEADER
  header: {
    alignItems: 'center',
    marginTop: 30,
    marginBottom: 20,
  },

  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },

  empty: {
    textAlign: 'center',
    color: '#555',
    marginBottom: 15,
  },

  card: {
    padding: 12,
    backgroundColor: '#eee',
    marginBottom: 10,
    borderRadius: 10,
  },

  text: {
    fontSize: 16,
    marginBottom: 5,
  },
});