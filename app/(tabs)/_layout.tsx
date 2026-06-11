import { Tabs, Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { supabase } from '../../src/lib/supabase';
import { Ionicons } from '@expo/vector-icons';

export default function TabLayout() {

  const [role, setRole] = useState<'admin' | 'cliente'>('cliente');
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isLogged, setIsLogged] = useState<boolean | null>(null);

  // ✅ CARGAR USUARIO
  async function loadUserData() {

    const { data } = await supabase.auth.getSession();
    const user = data.session?.user;

    // 🚫 NO LOGUEADO
    if (!user) {
      setIsLogged(false);
      setLoading(false);
      return;
    }

    // ✅ LOGUEADO
    setIsLogged(true);

    // ✅ PERFIL
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('email', user.email)
      .single();

    setRole(profile?.role || 'cliente');

    // ✅ RESERVAS
    const { data: bookings } = await supabase
      .from('bookings')
      .select('id')
      .eq('user_id', user.id);

    setCount(bookings?.length || 0);

    setLoading(false);
  }

  useEffect(() => {
    loadUserData();
  }, []);

  // ⏳ LOADING
  if (loading || isLogged === null) return null;

  // 🔐 REDIRECT LOGIN
  if (!isLogged) {
    return <Redirect href="/login" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,

        // ✅ fondo visible
        tabBarStyle: {
          backgroundColor: '#ffffff',
        },

        // ✅ colores visibles
        tabBarActiveTintColor: '#007aff',
        tabBarInactiveTintColor: '#555',
      }}
    >

      {/* ✅ INICIO */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Inicio',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" size={size ?? 26} color={color} />
          ),
        }}
      />

      {/* ✅ CLIENTE */}
      {role === 'cliente' && (
        <Tabs.Screen
          name="plans"
          options={{
            title: 'Planes',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="card" size={size ?? 26} color={color} />
            ),
          }}
        />
      )}

      {role === 'cliente' && (
        <Tabs.Screen
          name="bookings"
          options={{
            title: 'Reservas',
            tabBarBadge: count > 0 ? count : undefined,
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="calendar" size={size ?? 26} color={color} />
            ),
          }}
        />
      )}

      {/* ✅ ADMIN */}
      {role === 'admin' && (
        <Tabs.Screen
          name="admin"
          options={{
            title: 'Admin',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="settings" size={size ?? 26} color={color} />
            ),
          }}
        />
      )}

      {/* ✅ PERFIL */}
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person" size={size ?? 26} color={color} />
          ),
        }}
      />

    </Tabs>
  );
}