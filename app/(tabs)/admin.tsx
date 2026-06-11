import { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  TouchableOpacity,
  TextInput,
  Modal,
} from 'react-native';
import { supabase } from '../../src/lib/supabase';
import { useFocusEffect } from '@react-navigation/native';
import type { Day } from '../../src/types';

function formatDate(dateString: string): string {
  return new Intl.DateTimeFormat('es-ES', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(dateString + 'T00:00:00'));
}

export default function AdminScreen() {
  const [days, setDays] = useState<Day[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [newDate, setNewDate] = useState('');
  const [newCapacity, setNewCapacity] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadDays();
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

    if (error) {
      Alert.alert('Error', error.message);
      return;
    }

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

    if (error) {
      Alert.alert('Error', 'No se pudo eliminar el día');
      return;
    }

    setDays((prev) => prev.filter((d) => d.id !== day.id));
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
        <View style={styles.headerRow}>
          <Text style={styles.title}>Panel Admin</Text>
          <TouchableOpacity style={styles.addButton} onPress={() => setModalVisible(true)}>
            <Text style={styles.addButtonText}>+ Nuevo día</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionLabel}>DÍAS DISPONIBLES ({days.length})</Text>

        <FlatList
          data={days}
          keyExtractor={(item) => item.id.toString()}
          ListEmptyComponent={<Text style={styles.empty}>No hay días creados</Text>}
          renderItem={({ item }) => {
            const isDeleting = deletingId === item.id;
            return (
              <View style={styles.card}>
                <View style={styles.cardContent}>
                  <Text style={styles.dateText}>{formatDate(item.date)}</Text>
                  <Text style={styles.countText}>
                    {item.reserved_count} reservas
                    {item.max_capacity ? ` / ${item.max_capacity} plazas` : ''}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.deleteButton, isDeleting && styles.buttonDisabled]}
                  onPress={() => confirmDelete(item)}
                  disabled={isDeleting}
                >
                  {isDeleting ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.deleteText}>Eliminar</Text>
                  )}
                </TouchableOpacity>
              </View>
            );
          }}
        />
      </View>

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
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.saveButtonText}>Crear día</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelModalButton}
              onPress={() => setModalVisible(false)}
            >
              <Text style={styles.cancelModalText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f2f4f8' },
  container: { flex: 1, padding: 20 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  title: { fontSize: 22, fontWeight: 'bold' },
  addButton: {
    backgroundColor: '#007aff',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addButtonText: { color: '#fff', fontWeight: '600' },
  sectionLabel: { fontSize: 11, color: '#888', marginBottom: 10, letterSpacing: 1 },
  empty: { textAlign: 'center', color: '#888', marginTop: 40 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardContent: { flex: 1 },
  dateText: { fontSize: 14, fontWeight: '600', textTransform: 'capitalize' },
  countText: { fontSize: 12, color: '#666', marginTop: 2 },
  deleteButton: {
    backgroundColor: '#e74c3c',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginLeft: 10,
  },
  buttonDisabled: { backgroundColor: '#aaa' },
  deleteText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
  },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 16 },
  input: {
    backgroundColor: '#f2f4f8',
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  saveButton: {
    backgroundColor: '#007aff',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  saveButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  cancelModalButton: { padding: 14, alignItems: 'center' },
  cancelModalText: { color: '#e74c3c', fontWeight: '600', fontSize: 16 },
});
