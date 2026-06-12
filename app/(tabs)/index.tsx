import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { useAppColors, type AppColors } from '../../hooks/use-app-colors';
import { formatDateLong, todayBogota } from '../../src/lib/dates';
import { supabase } from '../../src/lib/supabase';
import type { Day, UserPlan } from '../../src/types';

// Localización en español
LocaleConfig.locales['es'] = {
  monthNames: ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'],
  monthNamesShort: ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'],
  dayNames: ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'],
  dayNamesShort: ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'],
  today: 'Hoy',
};
LocaleConfig.defaultLocale = 'es';

type MarkedDates = Record<string, {
  marked?: boolean;
  dotColor?: string;
  selected?: boolean;
  selectedColor?: string;
  disabled?: boolean;
  disableTouchEvent?: boolean;
}>;

export default function HomeScreen() {
  const colors = useAppColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [user, setUser] = useState<any>(null);
  const [userPlan, setUserPlan] = useState<UserPlan | null>(null);
  const [days, setDays] = useState<Day[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingDayId, setProcessingDayId] = useState<number | null>(null);
  const [bookedDayIds, setBookedDayIds] = useState<Set<number>>(new Set());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

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
      .eq('status', 'activo')
      .order('created_at', { ascending: false })
      .limit(1);
    if (error) { Alert.alert('Error', 'No se pudo cargar el plan'); return; }
    setUserPlan(data?.length ? data[0] : null);
  }

  async function getDays() {
    const today = todayBogota();
    const { data, error } = await supabase
      .from('days')
      .select('*')
      .gte('date', today)
      .order('date');
    if (error) { Alert.alert('Error', 'No se pudieron cargar los días'); return; }
    setDays(data || []);
  }

  async function getBookedDays() {
    const { data } = await supabase
      .from('bookings')
      .select('day_id')
      .eq('user_id', user.id)
      .neq('status', 'cancelada');
    if (data) {
      setBookedDayIds(new Set(data.map((b: { day_id: number }) => b.day_id)));
    }
  }

  // Construir marcas para el calendario
  const markedDates: MarkedDates = {};
  const today = todayBogota();

  days.forEach((day) => {
    const isBooked = bookedDayIds.has(day.id);
    const isFull = day.max_capacity != null && day.reserved_count >= day.max_capacity;
    const isSelected = selectedDate === day.date;

    markedDates[day.date] = {
      marked: true,
      dotColor: isBooked ? '#007aff' : isFull ? '#ff3b30' : '#34c759',
      selected: isSelected,
      selectedColor: isSelected ? '#007aff' : undefined,
    };
  });

  // Día seleccionado
  const selectedDay = days.find((d) => d.date === selectedDate) ?? null;
  const selectedIsBooked = selectedDay ? bookedDayIds.has(selectedDay.id) : false;
  const selectedIsFull = selectedDay
    ? selectedDay.max_capacity != null && selectedDay.reserved_count >= selectedDay.max_capacity
    : false;
  const isProcessing = selectedDay ? processingDayId === selectedDay.id : false;

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
      status: 'confirmada',
    }]);

    if (bookingError) {
      setProcessingDayId(null);
      Alert.alert('Error', 'No se pudo crear la reserva');
      return;
    }

    const newRemaining = userPlan.remaining_days - 1;
    await supabase.from('user_plans').update({
      remaining_days: newRemaining,
      status: newRemaining <= 0 ? 'inactivo' : 'activo',
    }).eq('id', userPlan.id);

    await supabase.from('days')
      .update({ reserved_count: day.reserved_count + 1 })
      .eq('id', day.id);

    setUserPlan({ ...userPlan, remaining_days: newRemaining });
    setBookedDayIds((prev) => new Set([...prev, day.id]));
    setDays((prev) =>
      prev.map((d) => d.id === day.id ? { ...d, reserved_count: d.reserved_count + 1 } : d)
    );
    setProcessingDayId(null);
    Alert.alert('¡Reservado!', `Tu plaza para ${formatDateLong(day.date)} está confirmada`);
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator size="large" style={{ flex: 1 }} color="#007aff" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>

        {/* ── PLAN ACTIVO ── */}
        {userPlan ? (
          <View style={styles.planCard}>
            <Text style={styles.planName}>{userPlan.plans?.name}</Text>
            <Text style={styles.planDays}>
              {userPlan.remaining_days > 0
                ? `${userPlan.remaining_days} día${userPlan.remaining_days !== 1 ? 's' : ''} restante${userPlan.remaining_days !== 1 ? 's' : ''}`
                : 'Plan agotado'}
            </Text>
          </View>
        ) : (
          <View style={[styles.planCard, styles.planCardEmpty]}>
            <Text style={styles.planDays}>Sin plan activo — ve a Planes para contratar uno</Text>
          </View>
        )}

        {/* ── LEYENDA ── */}
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: '#34c759' }]} />
            <Text style={styles.legendText}>Disponible</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: '#007aff' }]} />
            <Text style={styles.legendText}>Reservado</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: '#ff3b30' }]} />
            <Text style={styles.legendText}>Sin plazas</Text>
          </View>
        </View>

        {/* ── CALENDARIO ── */}
        <Calendar
          minDate={today}
          markedDates={markedDates}
          onDayPress={(day: { dateString: string }) => {
            const exists = days.find((d) => d.date === day.dateString);
            if (exists) {
              setSelectedDate(day.dateString === selectedDate ? null : day.dateString);
            }
          }}
          theme={{
            backgroundColor: colors.card,
            calendarBackground: colors.card,
            textSectionTitleColor: colors.textMuted,
            dayTextColor: colors.text,
            todayTextColor: '#007aff',
            selectedDayBackgroundColor: '#007aff',
            arrowColor: '#007aff',
            dotColor: '#34c759',
            monthTextColor: colors.text,
            textMonthFontWeight: '700',
            textDayFontSize: 14,
            disabledArrowColor: colors.textMuted,
          }}
          style={styles.calendar}
        />

        {/* ── DETALLE DÍA SELECCIONADO ── */}
        {selectedDay && (
          <View style={styles.detailCard}>
            <Text style={styles.detailDate}>{formatDateLong(selectedDay.date)}</Text>
            {selectedDay.max_capacity != null && (
              <Text style={styles.detailCapacity}>
                {selectedDay.reserved_count} / {selectedDay.max_capacity} plazas ocupadas
              </Text>
            )}

            <TouchableOpacity
              style={[
                styles.bookButton,
                (selectedIsBooked || selectedIsFull || !userPlan || userPlan.remaining_days <= 0 || isProcessing) && styles.bookButtonDisabled,
              ]}
              onPress={() => bookDay(selectedDay)}
              disabled={selectedIsBooked || selectedIsFull || !userPlan || userPlan.remaining_days <= 0 || isProcessing}
            >
              {isProcessing ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.bookButtonText}>
                  {selectedIsBooked
                    ? '✓ Ya tienes reserva'
                    : selectedIsFull
                    ? 'Sin plazas disponibles'
                    : !userPlan || userPlan.remaining_days <= 0
                    ? 'Sin días en tu plan'
                    : 'Reservar este día'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {!selectedDate && (
          <Text style={styles.hint}>Toca un día con punto para ver detalles y reservar</Text>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(c: AppColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    scroll: { padding: 16, paddingBottom: 40 },

    planCard: {
      backgroundColor: c.planActive, borderRadius: 12, padding: 16, marginBottom: 12,
    },
    planCardEmpty: { backgroundColor: c.planEmpty },
    planName: { fontSize: 16, fontWeight: '700', color: '#2e7d32' },
    planDays: { fontSize: 14, color: c.textSec, marginTop: 4 },

    legend: { flexDirection: 'row', justifyContent: 'center', gap: 16, marginBottom: 12 },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    dot: { width: 10, height: 10, borderRadius: 5 },
    legendText: { fontSize: 12, color: c.textMuted },

    calendar: { borderRadius: 12, overflow: 'hidden', marginBottom: 16 },

    detailCard: {
      backgroundColor: c.card, borderRadius: 12, padding: 16,
      elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6,
    },
    detailDate: { fontSize: 16, fontWeight: '700', color: c.text, textTransform: 'capitalize', marginBottom: 6 },
    detailCapacity: { fontSize: 13, color: c.textSec, marginBottom: 14 },

    bookButton: {
      backgroundColor: '#007aff', borderRadius: 10,
      padding: 14, alignItems: 'center',
    },
    bookButtonDisabled: { backgroundColor: '#aaa' },
    bookButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },

    hint: { textAlign: 'center', color: c.textMuted, fontSize: 13, marginTop: 20 },
  });
}
