import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Button,
    SafeAreaView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { supabase } from '../../src/lib/supabase';

export default function ProfileScreen() {

  const [user, setUser] = useState<any>(null);
  const [fullName, setFullName] = useState<string>('');
  const [userPlan, setUserPlan] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const router = useRouter();

  useEffect(() => {
    getUser();
  }, []);

  async function getUser() {
    setLoading(true);
    const { data } = await supabase.auth.getSession();
    const sessionUser = data.session?.user;

    if (sessionUser) {
      setUser(sessionUser);
      await Promise.all([
        sessionUser.email ? getUserProfile(sessionUser.email) : Promise.resolve(),
        getUserPlan(sessionUser.id),
      ]);
    }
    setLoading(false);
  }

  async function getUserProfile(email: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('email', email)
      .maybeSingle();

    if (!error && data) {
      setFullName(data.full_name);
    }
  }

  // ✅ PLAN ACTIVO
  async function getUserPlan(userId: string) {

    const { data } = await supabase
      .from('user_plans')
      .select(`
        *,
        plans (
          name,
          price
        )
      `)
      .eq('user_id', userId)
      .eq('status', 'activo')
      .order('created_at', { ascending: false })
      .limit(1);

    if (data && data.length > 0) {
      setUserPlan(data[0]);
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    router.replace('/login');
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

        {/* ✅ HEADER */}
        <View style={styles.header}>
          <Text style={styles.title}>Perfil</Text>
        </View>

        {/* ✅ INFO USUARIO */}
        {user && (
          <View style={styles.card}>

            <Text style={styles.label}>Nombre</Text>
            <Text style={styles.value}>
              {fullName || 'No disponible'}
            </Text>

            <Text style={styles.label}>Email</Text>
            <Text style={styles.value}>
              {user.email}
            </Text>

            <Text style={styles.label}>ID</Text>
            <Text style={styles.small}>
              {user.id}
            </Text>

          </View>
        )}

        {/* ✅ PLAN ACTIVO */}
        {userPlan && (
          <View style={styles.cardActive}>

            <Text style={styles.label}>Plan activo</Text>

            <Text style={styles.value}>
              {userPlan.plans?.name}
            </Text>

            <Text style={styles.value}>
              Días restantes: {userPlan.remaining_days}
            </Text>

            {userPlan.plans?.price && (
              <Text style={styles.small}>
                Precio: ${userPlan.plans.price}
              </Text>
            )}

          </View>
        )}

        {/* ✅ LOGOUT */}
        <View style={{ marginTop: 20 }}>
          <Button title="Cerrar sesión" onPress={logout} />
        </View>

      </View>
    </SafeAreaView>
  );
}

// ✅ ESTILOS
const styles = StyleSheet.create({

  safe: {
    flex: 1,
    backgroundColor: '#f2f4f8',
  },

  container: {
    flex: 1,
    padding: 20,
  },

  header: {
    alignItems: 'center',
    marginTop: 30,
    marginBottom: 20,
  },

  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },

  card: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
  },

  cardActive: {
    backgroundColor: '#d4edda',
    padding: 15,
    borderRadius: 10,
  },

  label: {
    fontSize: 12,
    color: '#666',
    marginTop: 5,
  },

  value: {
    fontSize: 16,
    color: '#000',
  },

  small: {
    fontSize: 12,
    color: '#888',
  },
});