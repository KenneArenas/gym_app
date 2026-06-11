import { useState, useEffect, useCallback } from 'react';
import {
  Text,
  View,
  Button,
  FlatList,
  StyleSheet,
  SafeAreaView,
  Alert
} from 'react-native';
import { supabase } from '../../src/lib/supabase';
import { useFocusEffect } from '@react-navigation/native';

export default function HomeScreen() {

  const [user, setUser] = useState<any>(null);
  const [userPlan, setUserPlan] = useState<any>(null);
  const [days, setDays] = useState<any[]>([]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user);
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (user) getUserPlan();
    }, [user])
  );

  useEffect(() => {
    if (user && userPlan) getDays();
  }, [userPlan]);

  async function getUserPlan() {
    const { data } = await supabase
      .from('user_plans')
      .select(`*, plans(name)`)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1);

    if (data?.length) {
      setUserPlan(data[0]);
    }
  }

  async function getDays() {
    const { data } = await supabase
      .from('days')
      .select('*')
      .order('date');

    setDays(data || []);
  }

  async function bookDay(day: any) {

    if (!userPlan || userPlan.remaining_days <= 0) {
      alert('Plan agotado');
      return;
    }

    await supabase.from('bookings').insert([{
      user_id: user.id,
      day_id: day.id,
      user_plan_id: userPlan.id,
    }]);

    const newRemaining = userPlan.remaining_days - 1;

    await supabase
      .from('user_plans')
      .update({
        remaining_days: newRemaining,
        status: newRemaining <= 0 ? 'inactivo' : 'activo',
      })
      .eq('id', userPlan.id);

    await supabase
      .from('days')
      .update({
        reserved_count: day.reserved_count + 1
      })
      .eq('id', day.id);

    setUserPlan({
      ...userPlan,
      remaining_days: newRemaining
    });

    Alert.alert('✅ Reservado');
  }

  return (
    <SafeAreaView style={styles.container}>

      <Text style={styles.title}>Inicio</Text>

      {userPlan && (
        <View style={styles.card}>
          <Text>{userPlan.plans?.name}</Text>

          <Text>
            {userPlan.remaining_days > 0
              ? `Días: ${userPlan.remaining_days}`
              : '✅ Plan agotado'}
          </Text>
        </View>
      )}

      <FlatList
        data={days}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (

          <View style={styles.card}>
            <Text>{item.date}</Text>

            <Button
              title="Reservar"
              onPress={() => bookDay(item)}
            />
          </View>

        )}
      />

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  title: { fontSize: 22, marginBottom: 10 },
  card: {
    padding: 15,
    backgroundColor: '#fff',
    marginBottom: 10,
    borderRadius: 10,
  },
});
``