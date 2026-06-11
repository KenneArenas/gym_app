import { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Button,
  StyleSheet,
  SafeAreaView,
  Alert
} from 'react-native';
import { supabase } from '../../src/lib/supabase';

export default function PlansScreen() {

  const [plans, setPlans] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {

    const { data } = await supabase.auth.getSession();
    const currentUser = data.session?.user;

    setUser(currentUser);

    const { data: plans } = await supabase
      .from('plans')
      .select('*');

    setPlans(plans || []);
  }

  async function selectPlan(plan: any) {

    const { data: active } = await supabase
      .from('user_plans')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'activo');

    if ((active?.length ?? 0) > 0) {
      Alert.alert('Ya tienes un plan activo');
      return;
    }

    await supabase.from('user_plans').insert([{
      user_id: user.id,
      plan_id: plan.id,
      remaining_days: plan.allowed_days, // ✅ CORREGIDO
      status: 'activo',
    }]);

    Alert.alert('✅ Plan activado');
  }

  return (
    <SafeAreaView style={styles.container}>

      <Text style={styles.title}>Planes</Text>

      <FlatList
        data={plans}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (

          <View style={styles.card}>
            <Text style={styles.name}>{item.name}</Text>

            <Text>{item.allowed_days} días</Text>
            <Text>Duración: {item.duration_days} días</Text>
            <Text>${item.price}</Text>

            <Button
              title="Elegir"
              onPress={() => selectPlan(item)}
            />
          </View>

        )}
      />

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  title: { fontSize: 22, marginBottom: 15 },
  card: {
    padding: 15,
    backgroundColor: '#fff',
    marginBottom: 10,
    borderRadius: 10,
  },
  name: {
    fontSize: 18,
    fontWeight: 'bold'
  }
});
``