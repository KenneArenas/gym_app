import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';
import { useEffect, useState } from 'react';
import { supabase } from '../../src/lib/supabase';

export default function TabLayout() {

  const [role, setRole] = useState<'admin' | 'cliente'>('cliente');
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isLogged, setIsLogged] = useState<boolean | null>(null);
  const [isApproved, setIsApproved] = useState<boolean>(true);
  const [pendingSolicitudes, setPendingSolicitudes] = useState(0);
  const [pendingPayments, setPendingPayments] = useState(0);

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
    setIsApproved(profile?.is_approved ?? true);

    // ✅ SOLICITUDES PENDIENTES (solo admin)
    if (profile?.role === 'admin') {
      const { count: solCount } = await supabase
        .from('solicitudes')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pendiente');
      setPendingSolicitudes(solCount ?? 0);

      const { count: payCount } = await supabase
        .from('payment_proofs')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pendiente');
      setPendingPayments(payCount ?? 0);
    }

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

  // ⏳ PENDIENTE DE APROBACIÓN
  if (!isApproved) {
    return <Redirect href="/pending" />;
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
      <Tabs.Screen
        name="plans"
        options={{
          href: role === 'cliente' ? undefined : null,
          title: 'Planes',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="card" size={size ?? 26} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="bookings"
        options={{
          href: role === 'cliente' ? undefined : null,
          title: 'Reservas',
          tabBarBadge: count > 0 ? count : undefined,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="calendar" size={size ?? 26} color={color} />
          ),
        }}
      />

      {/* ✅ ADMIN */}
      <Tabs.Screen
        name="admin"
        options={{
          href: role === 'admin' ? undefined : null,
          title: 'Admin',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings" size={size ?? 26} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="requests"
        options={{
          href: role === 'admin' ? undefined : null,
          title: 'Solicitudes',
          tabBarBadge: pendingSolicitudes > 0 ? pendingSolicitudes : undefined,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="people" size={size ?? 26} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="payments"
        options={{
          href: role === 'admin' ? undefined : null,
          title: 'Pagos',
          tabBarBadge: pendingPayments > 0 ? pendingPayments : undefined,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="cash" size={size ?? 26} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="plan-management"
        options={{
          href: role === 'admin' ? undefined : null,
          title: 'Planes',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="grid" size={size ?? 26} color={color} />
          ),
        }}
      />

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