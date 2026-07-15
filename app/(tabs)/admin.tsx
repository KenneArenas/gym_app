import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppColors, type AppColors } from '../../hooks/use-app-colors';
import { formatDate, todayBogota } from '../../src/lib/dates';
import { supabase } from '../../src/lib/supabase';
import type { Day } from '../../src/types';

interface BookingWithProfile {
  id: number;
  user_id: string;
  status: string;
  profiles?: { full_name: string; email: string };
}

export default function AdminScreen() {
  const colors = useAppColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [days, setDays] = useState<Day[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [attendanceModalVisible, setAttendanceModalVisible] = useState(false);
  const [settingsModalVisible, setSettingsModalVisible] = useState(false);
  const [newDate, setNewDate] = useState('');
  const [newCapacity, setNewCapacity] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [selectedDay, setSelectedDay] = useState<Day | null>(null);
  const [dayBookings, setDayBookings] = useState<BookingWithProfile[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [cancelHoursLimit, setCancelHoursLimit] = useState('2');
  const [savingSettings, setSavingSettings] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadDays();
      loadSettings();
    }, [])
  );

  async function loadDays() {
    setLoading(true);
    const { data, error } = await supabase
      .from('days')
      .select('*')
      .order('date');
    if (error) {
      Alert.alert('Error', 'No se pudieron cargar los días');
    } else {
      setDays(data || []);
    }
    setLoading(false);
  }

  async function loadSettings() {
    const { data } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'cancel_hours_limit')
      .maybeSingle();
    if (data) setCancelHoursLimit(data.value);
  }

  async function saveSettings() {
    const hours = parseInt(cancelHoursLimit, 10);
    if (isNaN(hours) || hours < 0) {
      Alert.alert('Error', 'Ingresa un número válido de horas');
      return;
    }
    setSavingSettings(true);
    await supabase
      .from('settings')
      .upsert({ key: 'cancel_hours_limit', value: hours.toString() });
    setSavingSettings(false);
    setSettingsModalVisible(false);
    Alert.alert('Guardado', `Límite actualizado a ${hours} hora(s)`);
  }

  async function addDay() {
    if (!newDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
      Alert.alert('Formato inválido', 'Usa el formato YYYY-MM-DD (ej: 2024-12-31)');
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('days').insert([{
      date: newDate,
      reserved_count: 0,
      ...(newCapacity ? { max_capacity: parseInt(newCapacity, 10) } : {}),
    }]);
    setSaving(false);
    if (error) { Alert.alert('Error', error.message); return; }
    setNewDate('');
    setNewCapacity('');
    setModalVisible(false);
    loadDays();
  }

  function confirmDelete(day: Day) {
    Alert.alert(
      'Eliminar día',
      `¿Eliminar ${formatDate(day.date)}? Se borrarán también sus reservas.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: () => deleteDay(day) },
      ]
    );
  }

  async function deleteDay(day: Day) {
    setDeletingId(day.id);
    await supabase.from('bookings').delete().eq('day_id', day.id);
    const { error } = await supabase.from('days').delete().eq('id', day.id);
    setDeletingId(null);
    if (error) { Alert.alert('Error', 'No se pudo eliminar el día'); return; }
    setDays((prev) => prev.filter((d) => d.id !== day.id));
  }

  // ─── ASISTENCIA ───────────────────────────────────────────────────
  async function openAttendance(day: Day) {
    setSelectedDay(day);
    setAttendanceModalVisible(true);
    setLoadingBookings(true);

    const { data } = await supabase
      .from('bookings')
      .select('id, user_id, status, profiles(full_name, email)')
      .eq('day_id', day.id)
      .neq('status', 'cancelada');

    setDayBookings((data || []) as unknown as BookingWithProfile[]);
    setLoadingBookings(false);
  }

  async function markAttendance(bookingId: number, status: 'asistio' | 'no_asistio') {
    const { error } = await supabase
      .from('bookings')
      .update({ status })
      .eq('id', bookingId);

    if (!error) {
      setDayBookings((prev) =>
        prev.map((b) => (b.id === bookingId ? { ...b, status } : b))
      );
    }
  }

  const today = todayBogota();
  const upcoming = days.filter((d) => d.date >= today);
  const past = days.filter((d) => d.date < today);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator size="large" style={{ flex: 1 }} color="#007aff" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Panel Admin</Text>
          <View style={styles.headerButtons}>
            <TouchableOpacity style={styles.settingsBtn} onPress={() => setSettingsModalVisible(true)}>
              <Text style={styles.settingsBtnText}>⚙️</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.addButton} onPress={() => setModalVisible(true)}>
              <Text style={styles.addButtonText}>+ Día</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── PRÓXIMOS ── */}
        <Text style={styles.sectionLabel}>PRÓXIMOS ({upcoming.length})</Text>
        {upcoming.length === 0 && <Text style={styles.empty}>No hay días futuros</Text>}
        {upcoming.map((item) => {
          const isDeleting = deletingId === item.id;
          return (
            <View key={item.id} style={styles.card}>
              <View style={styles.cardContent}>
                <Text style={styles.dateText}>{formatDate(item.date)}</Text>
                <Text style={styles.countText}>
                  {item.reserved_count} reservas{item.max_capacity ? ` / ${item.max_capacity}` : ''}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.deleteButton, isDeleting && styles.buttonDisabled]}
                onPress={() => confirmDelete(item)}
                disabled={isDeleting}
              >
                {isDeleting ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.deleteText}>🗑</Text>}
              </TouchableOpacity>
            </View>
          );
        })}

        {/* ── PASADOS ── */}
        {past.length > 0 && (
          <>
            <Text style={[styles.sectionLabel, { marginTop: 20 }]}>PASADOS — MARCAR ASISTENCIA</Text>
            {past.slice().reverse().map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[styles.card, styles.cardPast]}
                onPress={() => openAttendance(item)}
              >
                <View style={styles.cardContent}>
                  <Text style={styles.dateText}>{formatDate(item.date)}</Text>
                  <Text style={styles.countText}>{item.reserved_count} reservas</Text>
                </View>
                <Text style={styles.attendanceHint}>Ver asistencia →</Text>
              </TouchableOpacity>
            ))}
          </>
        )}
      </ScrollView>

      {/* ── MODAL NUEVO DÍA ── */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Nuevo día</Text>
            <TextInput
              style={styles.input}
              placeholder="Fecha (YYYY-MM-DD)"
              value={newDate}
              onChangeText={setNewDate}
              keyboardType="numbers-and-punctuation"
            />
            <TextInput
              style={styles.input}
              placeholder="Capacidad máxima (opcional)"
              value={newCapacity}
              onChangeText={setNewCapacity}
              keyboardType="numeric"
            />
            <TouchableOpacity
              style={[styles.saveButton, saving && styles.buttonDisabled]}
              onPress={addDay}
              disabled={saving}
            >
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Crear día</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelModalButton} onPress={() => setModalVisible(false)}>
              <Text style={styles.cancelModalText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── MODAL ASISTENCIA ── */}
      <Modal visible={attendanceModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {selectedDay ? formatDate(selectedDay.date) : ''}
            </Text>
            <Text style={styles.modalSubtitle}>Marca la asistencia de cada cliente</Text>

            {loadingBookings ? (
              <ActivityIndicator color="#007aff" style={{ marginVertical: 20 }} />
            ) : dayBookings.length === 0 ? (
              <Text style={styles.empty}>No hay reservas para este día</Text>
            ) : (
              <FlatList
                data={dayBookings}
                keyExtractor={(b) => b.id.toString()}
                style={{ maxHeight: 350 }}
                renderItem={({ item }) => (
                  <View style={styles.attendanceRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.clientName}>{item.profiles?.full_name ?? 'Cliente'}</Text>
                      <Text style={styles.clientEmail}>{item.profiles?.email ?? ''}</Text>
                    </View>
                    <View style={styles.attendanceButtons}>
                      <TouchableOpacity
                        style={[styles.btnAsistio, item.status === 'asistio' && styles.btnActive]}
                        onPress={() => markAttendance(item.id, 'asistio')}
                      >
                        <Text style={styles.btnAttText}>✓</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.btnNoAsistio, item.status === 'no_asistio' && styles.btnNoActive]}
                        onPress={() => markAttendance(item.id, 'no_asistio')}
                      >
                        <Text style={styles.btnAttText}>✗</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              />
            )}

            <TouchableOpacity
              style={[styles.cancelModalButton, { marginTop: 12 }]}
              onPress={() => setAttendanceModalVisible(false)}
            >
              <Text style={styles.cancelModalText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── MODAL CONFIGURACIÓN ── */}
      <Modal visible={settingsModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Configuración</Text>
            <Text style={styles.modalSubtitle}>
              Horas mínimas de anticipación para cancelar una reserva
            </Text>
            <TextInput
              style={styles.input}
              value={cancelHoursLimit}
              onChangeText={setCancelHoursLimit}
              keyboardType="numeric"
              placeholder="Ej: 2"
            />
            <TouchableOpacity
              style={[styles.saveButton, savingSettings && styles.buttonDisabled]}
              onPress={saveSettings}
              disabled={savingSettings}
            >
              {savingSettings ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Guardar</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelModalButton} onPress={() => setSettingsModalVisible(false)}>
              <Text style={styles.cancelModalText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function createStyles(c: AppColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    container: { padding: 20, paddingTop: 36, paddingBottom: 40 },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    headerButtons: { flexDirection: 'row', gap: 8 },
    title: { fontSize: 22, fontWeight: 'bold', color: c.text },
    addButton: { backgroundColor: '#007aff', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
    addButtonText: { color: '#fff', fontWeight: '600' },
    settingsBtn: { backgroundColor: c.settingsBtn, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
    settingsBtnText: { fontSize: 18 },
    sectionLabel: { fontSize: 11, color: c.textMuted, marginBottom: 10, letterSpacing: 1 },
    empty: { textAlign: 'center', color: c.textMuted, marginVertical: 16 },

    card: {
      backgroundColor: c.card, borderRadius: 10, padding: 15, marginBottom: 10,
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4,
    },
    cardPast: { backgroundColor: c.cardAlt },
    cardContent: { flex: 1 },
    dateText: { fontSize: 14, fontWeight: '600', textTransform: 'capitalize', color: c.text },
    countText: { fontSize: 12, color: c.textSec, marginTop: 2 },
    attendanceHint: { fontSize: 13, color: '#007aff', fontWeight: '600' },
    deleteButton: { backgroundColor: '#e74c3c', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, marginLeft: 10 },
    buttonDisabled: { backgroundColor: '#aaa' },
    deleteText: { color: '#fff', fontSize: 16 },

    // Attendance
    attendanceRow: {
      flexDirection: 'row', alignItems: 'center', paddingVertical: 10,
      borderBottomWidth: 1, borderColor: c.rowSep,
    },
    clientName: { fontSize: 14, fontWeight: '600', color: c.text },
    clientEmail: { fontSize: 12, color: c.textSec },
    attendanceButtons: { flexDirection: 'row', gap: 8 },
    btnAsistio: { backgroundColor: '#ddd', borderRadius: 8, width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
    btnNoAsistio: { backgroundColor: '#ddd', borderRadius: 8, width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
    btnActive: { backgroundColor: '#34c759' },
    btnNoActive: { backgroundColor: '#ff3b30' },
    btnAttText: { color: '#fff', fontWeight: '700', fontSize: 16 },

    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: c.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40 },
    modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 4, color: c.text },
    modalSubtitle: { fontSize: 13, color: c.textMuted, marginBottom: 16 },
    input: { backgroundColor: c.inputBg, borderRadius: 10, padding: 14, marginBottom: 12, fontSize: 16, borderWidth: 1, borderColor: c.border, color: c.text },
    saveButton: { backgroundColor: '#007aff', borderRadius: 10, padding: 14, alignItems: 'center', marginBottom: 10 },
    saveButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
    cancelModalButton: { padding: 14, alignItems: 'center' },
    cancelModalText: { color: '#e74c3c', fontWeight: '600', fontSize: 16 },
  });
}
