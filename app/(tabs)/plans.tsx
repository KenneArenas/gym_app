import { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { supabase } from '../../src/lib/supabase';
import type { Plan } from '../../src/types';

export default function PlansScreen() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [processingPlanId, setProcessingPlanId] = useState<number | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);

    const { data: sessionData } = await supabase.auth.getSession();
    setUser(sessionData.session?.user ?? null);

    const { data, error } = await supabase.from('plans').select('*');

    if (error) {
      Alert.alert('Error', 'No se pudieron cargar los planes');
    } else {
      setPlans(data || []);
    }
    setLoading(false);
  }

  async function selectPlan(plan: Plan) {
    if (!user) return;

    setProcessingPlanId(plan.id);

    const { data: active, error: fetchError } = await supabase
      .from('user_plans')
      .select('id')
      .eq('user_id', user.id)
      .eq('status', 'activo');

    if (fetchError) {
      setProcessingPlanId(null);
      Alert.alert('Error', 'No se pudo verificar tu plan actual');
      return;
    }

    if ((active?.length ?? 0) > 0) {
      setProcessingPlanId(null);
      Alert.alert('Plan activo', 'Ya tienes un plan activo. Debes esperar a que se agote.');
      return;
    }

    const { error: insertError } = await supabase.from('user_plans').insert([{
      user_id: user.id,
      plan_id: plan.id,
      remaining_days: plan.allowed_days,
      status: 'activo',
    }]);

    setProcessingPlanId(null);

    if (insertError) {
      Alert.alert('Error', 'No se pudo activar el plan');
      return;
    }

    Alert.alert('Plan activado', `Has activado "${plan.name}" con ${plan.allowed_days} días disponibles`);
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
      <Text style={styles.title}>Planes</Text>

      <FlatList
        data={plans}
        keyExtractor={(item) => item.id.toString()}
        ListEmptyComponent={<Text style={styles.empty}>No hay planes disponibles</Text>}
        renderItem={({ item }) => {
          const isProcessing = processingPlanId === item.id;
          return (
            <View style={styles.card}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.detail}>{item.allowed_days} días disponibles</Text>
              <Text style={styles.detail}>Duración: {item.duration_days} días</Text>
              <Text style={styles.price}>${item.price}</Text>
              <TouchableOpacity
                style={[styles.button, isProcessing && styles.buttonDisabled]}
                onPress={() => selectPlan(item)}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Elegir plan</Text>
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
  empty: { textAlign: 'center', color: '#888', marginTop: 40 },
  card: {
    padding: 15,
    backgroundColor: '#fff',
    marginBottom: 10,
    borderRadius: 10,
  },
  name: { fontSize: 18, fontWeight: 'bold', marginBottom: 6 },
  detail: { fontSize: 14, color: '#444', marginBottom: 2 },
  price: { fontSize: 16, fontWeight: '600', color: '#007aff', marginBottom: 10 },
  button: {
    backgroundColor: '#007aff',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonDisabled: { backgroundColor: '#aaa' },
  buttonText: { color: '#fff', fontWeight: '600' },
});
