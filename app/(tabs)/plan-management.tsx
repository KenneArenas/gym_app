import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Modal,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppColors, type AppColors } from '../../hooks/use-app-colors';
import { supabase } from '../../src/lib/supabase';

interface Plan {
  id: number;
  name: string;
  description: string | null;
  allowed_days: number;
  duration_days: number;
  price: number;
  is_active: boolean;
}

interface ClientProfile {
  id: string;
  full_name: string;
  email: string;
}

const EMPTY_PLAN = {
  name: '',
  description: '',
  allowed_days: '',
  duration_days: '',
  price: '',
  is_active: true,
};

export default function PlanManagementScreen() {
  const colors = useAppColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [planModalVisible, setPlanModalVisible] = useState(false);
  const [assignModalVisible, setAssignModalVisible] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [form, setForm] = useState(EMPTY_PLAN);
  const [saving, setSaving] = useState(false);
  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [selectedClient, setSelectedClient] = useState<ClientProfile | null>(null);
  const [loadingClients, setLoadingClients] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [clientSearch, setClientSearch] = useState('');

  useFocusEffect(
    useCallback(() => {
      loadPlans();
    }, [])
  );

  async function loadPlans() {
    setLoading(true);
    const { data, error } = await supabase
      .from('plans')
      .select('*')
      .order('is_active', { ascending: false })
      .order('name');
    if (error) {
      Alert.alert('Error', 'No se pudieron cargar los planes');
    } else {
      setPlans(data || []);
    }
    setLoading(false);
  }

  // ─── ABRIR MODAL NUEVO/EDITAR ──────────────────────────────────────
  function openCreate() {
    setEditingPlan(null);
    setForm(EMPTY_PLAN);
    setPlanModalVisible(true);
  }

  function openEdit(plan: Plan) {
    setEditingPlan(plan);
    setForm({
      name: plan.name,
      description: plan.description ?? '',
      allowed_days: plan.allowed_days.toString(),
      duration_days: plan.duration_days.toString(),
      price: plan.price.toString(),
      is_active: plan.is_active,
    });
    setPlanModalVisible(true);
  }

  // ─── GUARDAR PLAN ─────────────────────────────────────────────────
  async function savePlan() {
    if (!form.name.trim() || !form.allowed_days || !form.duration_days || !form.price) {
      Alert.alert('Campos requeridos', 'Completa nombre, días permitidos, duración y precio');
      return;
    }

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      allowed_days: parseInt(form.allowed_days, 10),
      duration_days: parseInt(form.duration_days, 10),
      price: parseFloat(form.price),
      is_active: form.is_active,
    };

    setSaving(true);

    if (editingPlan) {
      const { error } = await supabase.from('plans').update(payload).eq('id', editingPlan.id);
      setSaving(false);
      if (error) { Alert.alert('Error', error.message); return; }
    } else {
      const { error } = await supabase.from('plans').insert(payload);
      setSaving(false);
      if (error) { Alert.alert('Error', error.message); return; }
    }

    setPlanModalVisible(false);
    loadPlans();
  }

  // ─── TOGGLE ACTIVO ────────────────────────────────────────────────
  async function toggleActive(plan: Plan) {
    const { error } = await supabase
      .from('plans')
      .update({ is_active: !plan.is_active })
      .eq('id', plan.id);
    if (!error) {
      setPlans((prev) =>
        prev.map((p) => (p.id === plan.id ? { ...p, is_active: !p.is_active } : p))
      );
    }
  }

  // ─── ELIMINAR PLAN ────────────────────────────────────────────────
  function confirmDelete(plan: Plan) {
    Alert.alert(
      'Eliminar plan',
      `¿Eliminar "${plan.name}"? Esta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase.from('plans').delete().eq('id', plan.id);
            if (error) {
              Alert.alert('Error', 'No se puede eliminar (puede tener planes de usuario asociados)');
            } else {
              loadPlans();
            }
          },
        },
      ]
    );
  }

  // ─── ASIGNAR PLAN A CLIENTE ───────────────────────────────────────
  async function openAssign(plan: Plan) {
    setSelectedPlan(plan);
    setSelectedClient(null);
    setClientSearch('');
    setAssignModalVisible(true);
    setLoadingClients(true);

    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .eq('role', 'cliente')
      .eq('is_approved', true)
      .order('full_name');

    setClients(data || []);
    setLoadingClients(false);
  }

  async function assignPlan() {
    if (!selectedClient || !selectedPlan) return;

    setAssigning(true);

    // Verificar si ya tiene un plan activo
    const { data: active } = await supabase
      .from('user_plans')
      .select('id')
      .eq('user_id', selectedClient.id)
      .eq('status', 'activo')
      .gt('remaining_days', 0);

    if ((active?.length ?? 0) > 0) {
      setAssigning(false);
      Alert.alert(
        'Plan activo',
        `${selectedClient.full_name} ya tiene un plan activo. ¿Desactivarlo y asignar el nuevo?`,
        [
          { text: 'Cancelar', style: 'cancel', onPress: () => setAssigning(false) },
          {
            text: 'Sí, reemplazar',
            onPress: async () => {
              await supabase
                .from('user_plans')
                .update({ status: 'inactivo' })
                .eq('user_id', selectedClient.id)
                .eq('status', 'activo');
              await doAssign();
            },
          },
        ]
      );
      return;
    }

    await doAssign();
  }

  async function doAssign() {
    if (!selectedClient || !selectedPlan) return;

    const { error } = await supabase.from('user_plans').insert({
      user_id: selectedClient.id,
      plan_id: selectedPlan.id,
      remaining_days: selectedPlan.allowed_days,
      status: 'activo',
    });

    setAssigning(false);

    if (error) {
      Alert.alert('Error', 'No se pudo asignar el plan');
      return;
    }

    setAssignModalVisible(false);
    Alert.alert('Asignado', `Plan "${selectedPlan.name}" asignado a ${selectedClient.full_name}`);
  }

  const filteredClients = clients.filter(
    (c) =>
      c.full_name.toLowerCase().includes(clientSearch.toLowerCase()) ||
      c.email.toLowerCase().includes(clientSearch.toLowerCase())
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator style={{ flex: 1 }} size="large" color="#007aff" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <FlatList
        data={plans}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.headerRow}>
            <Text style={styles.title}>Gestión de Planes</Text>
            <TouchableOpacity style={styles.addButton} onPress={openCreate}>
              <Text style={styles.addButtonText}>+ Nuevo</Text>
            </TouchableOpacity>
          </View>
        }
        ListEmptyComponent={
          <Text style={styles.empty}>No hay planes creados. Agrega el primero.</Text>
        }
        renderItem={({ item }) => (
          <View style={[styles.card, !item.is_active && styles.cardInactive]}>
            <View style={styles.cardTop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.planName}>{item.name}</Text>
                {item.description ? (
                  <Text style={styles.planDesc}>{item.description}</Text>
                ) : null}
              </View>
              <View style={styles.activeToggle}>
                <Text style={styles.activeLabel}>{item.is_active ? 'Activo' : 'Inactivo'}</Text>
                <Switch
                  value={item.is_active}
                  onValueChange={() => toggleActive(item)}
                  trackColor={{ false: '#ccc', true: '#34c759' }}
                  thumbColor="#fff"
                />
              </View>
            </View>

            <View style={styles.details}>
              <Text style={styles.detail}>🗓 {item.allowed_days} días de acceso</Text>
              <Text style={styles.detail}>⏱ {item.duration_days} días de vigencia</Text>
              <Text style={styles.detail}>💰 ${item.price.toLocaleString('es-CO')}</Text>
            </View>

            <View style={styles.cardActions}>
              <TouchableOpacity style={styles.btnEdit} onPress={() => openEdit(item)}>
                <Text style={styles.btnEditText}>✏️ Editar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnAssign} onPress={() => openAssign(item)}>
                <Text style={styles.btnAssignText}>👤 Asignar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnDelete} onPress={() => confirmDelete(item)}>
                <Text style={styles.btnDeleteText}>🗑</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />

      {/* ── MODAL CREAR / EDITAR PLAN ── */}
      <Modal visible={planModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
            <Text style={styles.modalTitle}>
              {editingPlan ? 'Editar plan' : 'Nuevo plan'}
            </Text>

            <Text style={styles.fieldLabel}>Nombre *</Text>
            <TextInput
              style={styles.input}
              value={form.name}
              onChangeText={(v) => setForm((f) => ({ ...f, name: v }))}
              placeholder="Ej: Plan Mensual"
            />

            <Text style={styles.fieldLabel}>Descripción</Text>
            <TextInput
              style={[styles.input, { minHeight: 60, textAlignVertical: 'top' }]}
              value={form.description}
              onChangeText={(v) => setForm((f) => ({ ...f, description: v }))}
              placeholder="Opcional"
              multiline
            />

            <Text style={styles.fieldLabel}>Días de acceso *</Text>
            <TextInput
              style={styles.input}
              value={form.allowed_days}
              onChangeText={(v) => setForm((f) => ({ ...f, allowed_days: v }))}
              placeholder="Ej: 20"
              keyboardType="numeric"
            />

            <Text style={styles.fieldLabel}>Días de vigencia *</Text>
            <TextInput
              style={styles.input}
              value={form.duration_days}
              onChangeText={(v) => setForm((f) => ({ ...f, duration_days: v }))}
              placeholder="Ej: 30"
              keyboardType="numeric"
            />

            <Text style={styles.fieldLabel}>Precio (COP) *</Text>
            <TextInput
              style={styles.input}
              value={form.price}
              onChangeText={(v) => setForm((f) => ({ ...f, price: v }))}
              placeholder="Ej: 120000"
              keyboardType="numeric"
            />

            <View style={styles.switchRow}>
              <Text style={styles.fieldLabel}>Plan activo</Text>
              <Switch
                value={form.is_active}
                onValueChange={(v) => setForm((f) => ({ ...f, is_active: v }))}
                trackColor={{ false: '#ccc', true: '#34c759' }}
                thumbColor="#fff"
              />
            </View>

            <TouchableOpacity
              style={[styles.saveButton, saving && styles.btnDisabled]}
              onPress={savePlan}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.saveButtonText}>
                  {editingPlan ? 'Guardar cambios' : 'Crear plan'}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setPlanModalVisible(false)}
            >
              <Text style={styles.cancelText}>Cancelar</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* ── MODAL ASIGNAR A CLIENTE ── */}
      <Modal visible={assignModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              Asignar: {selectedPlan?.name}
            </Text>
            <Text style={styles.modalSubtitle}>Selecciona un cliente</Text>

            <TextInput
              style={styles.input}
              placeholder="Buscar por nombre o correo..."
              value={clientSearch}
              onChangeText={setClientSearch}
            />

            {loadingClients ? (
              <ActivityIndicator color="#007aff" style={{ marginVertical: 20 }} />
            ) : (
              <ScrollView style={{ maxHeight: 300 }}>
                {filteredClients.length === 0 && (
                  <Text style={styles.empty}>No se encontraron clientes</Text>
                )}
                {filteredClients.map((client) => (
                  <TouchableOpacity
                    key={client.id}
                    style={[
                      styles.clientItem,
                      selectedClient?.id === client.id && styles.clientItemSelected,
                    ]}
                    onPress={() => setSelectedClient(client)}
                  >
                    <Text style={styles.clientName}>{client.full_name}</Text>
                    <Text style={styles.clientEmail}>{client.email}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            <TouchableOpacity
              style={[styles.saveButton, (!selectedClient || assigning) && styles.btnDisabled]}
              onPress={assignPlan}
              disabled={!selectedClient || assigning}
            >
              {assigning ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.saveButtonText}>
                  {selectedClient ? `Asignar a ${selectedClient.full_name}` : 'Selecciona un cliente'}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setAssignModalVisible(false)}
            >
              <Text style={styles.cancelText}>Cancelar</Text>
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
    list: { padding: 16, paddingBottom: 40 },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    title: { fontSize: 22, fontWeight: 'bold', color: c.text },
    addButton: { backgroundColor: '#007aff', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
    addButtonText: { color: '#fff', fontWeight: '700', fontSize: 14 },
    empty: { textAlign: 'center', color: c.textMuted, marginTop: 30, fontSize: 14 },

    card: {
      backgroundColor: c.card, borderRadius: 12, padding: 16,
      marginBottom: 12, elevation: 2, shadowColor: '#000',
      shadowOpacity: 0.06, shadowRadius: 6,
    },
    cardInactive: { opacity: 0.55 },
    cardTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
    planName: { fontSize: 17, fontWeight: '700', color: c.text },
    planDesc: { fontSize: 13, color: c.textSec, marginTop: 2 },
    activeToggle: { alignItems: 'center', marginLeft: 8 },
    activeLabel: { fontSize: 11, color: c.textMuted, marginBottom: 2 },

    details: { marginBottom: 12 },
    detail: { fontSize: 13, color: c.textSec, marginBottom: 2 },

    cardActions: { flexDirection: 'row', gap: 8 },
    btnEdit: { flex: 1, backgroundColor: c.inputBg, borderRadius: 8, padding: 8, alignItems: 'center' },
    btnEditText: { fontSize: 13, color: c.text, fontWeight: '600' },
    btnAssign: { flex: 1, backgroundColor: '#007aff', borderRadius: 8, padding: 8, alignItems: 'center' },
    btnAssignText: { fontSize: 13, color: '#fff', fontWeight: '600' },
    btnDelete: { backgroundColor: '#fff0f0', borderRadius: 8, borderWidth: 1, borderColor: '#ffcdd2', padding: 8, alignItems: 'center', width: 40 },
    btnDeleteText: { fontSize: 16 },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
    modalContent: {
      backgroundColor: c.card, borderTopLeftRadius: 20, borderTopRightRadius: 20,
      padding: 24, paddingBottom: 40,
    },
    modalTitle: { fontSize: 20, fontWeight: '700', color: c.text, marginBottom: 4 },
    modalSubtitle: { fontSize: 13, color: c.textMuted, marginBottom: 12 },
    fieldLabel: { fontSize: 13, color: c.textSec, marginBottom: 4, marginTop: 8 },
    input: {
      backgroundColor: c.inputBg, borderRadius: 8, padding: 12,
      fontSize: 15, borderWidth: 1, borderColor: c.border, marginBottom: 4, color: c.text,
    },
    switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 12 },
    saveButton: { backgroundColor: '#007aff', borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 12 },
    saveButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
    cancelButton: { padding: 12, alignItems: 'center', marginTop: 6 },
    cancelText: { color: c.textSec, fontSize: 15 },
    btnDisabled: { opacity: 0.5 },

    clientItem: {
      padding: 12, borderRadius: 8, marginBottom: 6,
      backgroundColor: c.inputBg, borderWidth: 1, borderColor: 'transparent',
    },
    clientItemSelected: { borderColor: '#007aff', backgroundColor: c.planActive },
    clientName: { fontSize: 15, fontWeight: '600', color: c.text },
    clientEmail: { fontSize: 12, color: c.textSec, marginTop: 2 },
  });
}
