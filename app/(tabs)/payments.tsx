import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
    Modal,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppColors, type AppColors } from '../../hooks/use-app-colors';
import { notifyUser } from '../../src/lib/notifications';
import { supabase } from '../../src/lib/supabase';

interface PaymentProof {
  id: number;
  user_id: string;
  user_plan_id: string;
  image_url: string;
  status: 'pendiente' | 'aprobado' | 'rechazado';
  admin_note: string | null;
  created_at: string;
  profiles?: { full_name: string; email: string };
  user_plans?: { remaining_days: number; plans?: { name: string } };
}

export default function PaymentsScreen() {
  const colors = useAppColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [payments, setPayments] = useState<PaymentProof[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [noteModalVisible, setNoteModalVisible] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<PaymentProof | null>(null);
  const [adminNote, setAdminNote] = useState('');

  useFocusEffect(
    useCallback(() => {
      loadPayments();
    }, [])
  );

  async function loadPayments() {
    setLoading(true);
    const { data, error } = await supabase
      .from('payment_proofs')
      .select(`
        *,
        profiles (full_name, email),
        user_plans (remaining_days, plans (name))
      `)
      .order('created_at', { ascending: false });

    if (error) {
      Alert.alert('Error', 'No se pudieron cargar los comprobantes');
    } else {
      setPayments(data || []);
    }
    setLoading(false);
  }

  function openRejectModal(item: PaymentProof) {
    setSelectedPayment(item);
    setAdminNote('');
    setNoteModalVisible(true);
  }

  async function aprobar(item: PaymentProof) {
    Alert.alert(
      'Aprobar pago',
      `¿Aprobar el comprobante de ${item.profiles?.full_name ?? item.user_id}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Aprobar',
          onPress: async () => {
            setProcessingId(item.id);

            // 1. Actualizar comprobante
            const { error: proofError } = await supabase
              .from('payment_proofs')
              .update({ status: 'aprobado', admin_note: null })
              .eq('id', item.id);

            if (proofError) {
              setProcessingId(null);
              Alert.alert('Error', 'No se pudo actualizar el comprobante');
              return;
            }

            // 2. Activar el plan del usuario
            if (item.user_plan_id) {
              await supabase
                .from('user_plans')
                .update({
                  status: (item.user_plans?.remaining_days ?? 0) > 0 ? 'activo' : 'inactivo',
                })
                .eq('id', item.user_plan_id);
            }

            // 3. Notificar al cliente
            await notifyUser(
              item.user_id,
              '¡Pago aprobado! 💪',
              (item.user_plans?.remaining_days ?? 0) > 0
                ? 'Tu comprobante fue aprobado y tu plan está activo. ¡A entrenar!'
                : 'Tu comprobante fue aprobado, pero ese plan ya no tiene días disponibles.',
            );

            setProcessingId(null);
            Alert.alert(
              'Aprobado',
              (item.user_plans?.remaining_days ?? 0) > 0
                ? 'El pago fue aprobado y el plan está activo'
                : 'El pago fue aprobado, pero el plan ya estaba agotado',
            );
            loadPayments();
          },
        },
      ]
    );
  }

  async function rechazar() {
    if (!selectedPayment) return;
    setNoteModalVisible(false);
    setProcessingId(selectedPayment.id);

    const { error } = await supabase
      .from('payment_proofs')
      .update({ status: 'rechazado', admin_note: adminNote.trim() || null })
      .eq('id', selectedPayment.id);

    setProcessingId(null);

    if (error) {
      Alert.alert('Error', 'No se pudo rechazar el comprobante');
    } else {
      // Notificar al cliente
      await notifyUser(
        selectedPayment.user_id,
        'Comprobante de pago',
        adminNote.trim()
          ? `Tu comprobante fue rechazado. Motivo: ${adminNote.trim()}`
          : 'Tu comprobante fue rechazado. Sube uno nuevo o contacta al gimnasio.',
      );
      loadPayments();
    }
  }

  const pendientes = payments.filter((p) => p.status === 'pendiente');
  const procesados = payments.filter((p) => p.status !== 'pendiente');

  function renderItem({ item }: { item: PaymentProof }) {
    const isProcesando = processingId === item.id;
    const isPendiente = item.status === 'pendiente';

    return (
      <View style={[styles.card, !isPendiente && styles.cardProcessed]}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.clientName}>
              {item.profiles?.full_name ?? 'Cliente'}
            </Text>
            <Text style={styles.clientEmail}>{item.profiles?.email ?? ''}</Text>
            <Text style={styles.planName}>
              Plan: {item.user_plans?.plans?.name ?? '—'}
            </Text>
          </View>
          <View style={[styles.badge, styles[`badge_${item.status}`]]}>
            <Text style={styles.badgeText}>
              {item.status === 'pendiente' ? 'Pendiente' : item.status === 'aprobado' ? 'Aprobado' : 'Rechazado'}
            </Text>
          </View>
        </View>

        <Text style={styles.date}>
          {new Date(item.created_at).toLocaleDateString('es-CO', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit',
          })}
        </Text>

        {item.admin_note && (
          <Text style={styles.adminNote}>Nota: {item.admin_note}</Text>
        )}

        {/* Miniatura del comprobante */}
        <TouchableOpacity onPress={() => setPreviewUrl(item.image_url)}>
          <Image
            source={{ uri: item.image_url }}
            style={styles.thumbnail}
            resizeMode="cover"
          />
          <Text style={styles.viewImage}>Toca para ampliar</Text>
        </TouchableOpacity>

        {isPendiente && (
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.btnAprobar, isProcesando && styles.btnDisabled]}
              onPress={() => aprobar(item)}
              disabled={isProcesando}
            >
              {isProcesando ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.btnText}>✓ Aprobar</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.btnRechazar, isProcesando && styles.btnDisabled]}
              onPress={() => openRejectModal(item)}
              disabled={isProcesando}
            >
              <Text style={styles.btnText}>✗ Rechazar</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }

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
        data={[...pendientes, ...procesados]}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <Text style={styles.title}>
            Comprobantes ({pendientes.length} pendientes)
          </Text>
        }
        ListEmptyComponent={
          <Text style={styles.empty}>No hay comprobantes registrados</Text>
        }
        renderItem={renderItem}
      />

      {/* ── MODAL PREVIEW IMAGEN ── */}
      <Modal visible={!!previewUrl} transparent animationType="fade">
        <TouchableOpacity
          style={styles.previewOverlay}
          activeOpacity={1}
          onPress={() => setPreviewUrl(null)}
        >
          {previewUrl && (
            <Image
              source={{ uri: previewUrl }}
              style={styles.previewImage}
              resizeMode="contain"
            />
          )}
          <Text style={styles.previewClose}>Toca para cerrar</Text>
        </TouchableOpacity>
      </Modal>

      {/* ── MODAL NOTA DE RECHAZO ── */}
      <Modal visible={noteModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Motivo de rechazo</Text>
            <Text style={styles.modalSubtitle}>
              Opcional — el cliente podrá ver esta nota
            </Text>
            <TextInput
              style={styles.noteInput}
              placeholder="Ej: El comprobante no es legible..."
              value={adminNote}
              onChangeText={setAdminNote}
              multiline
              numberOfLines={3}
            />
            <TouchableOpacity style={styles.btnRechazarModal} onPress={rechazar}>
              <Text style={styles.btnText}>Confirmar rechazo</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setNoteModalVisible(false)}
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
    title: { fontSize: 22, fontWeight: 'bold', marginBottom: 16, color: c.text },
    empty: { textAlign: 'center', color: c.textMuted, marginTop: 40, fontSize: 15 },

    card: {
      backgroundColor: c.card, borderRadius: 12, padding: 16,
      marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.06,
      shadowRadius: 6, elevation: 2,
    },
    cardProcessed: { opacity: 0.7 },
    cardHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
    clientName: { fontSize: 15, fontWeight: '700', color: c.text },
    clientEmail: { fontSize: 12, color: c.textSec, marginTop: 1 },
    planName: { fontSize: 13, color: '#007aff', marginTop: 4 },

    badge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3, marginLeft: 8 },
    badge_pendiente: { backgroundColor: '#ff9500' },
    badge_aprobado: { backgroundColor: '#34c759' },
    badge_rechazado: { backgroundColor: '#ff3b30' },
    badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },

    date: { fontSize: 12, color: c.textMuted, marginBottom: 8 },
    adminNote: {
      fontSize: 13, color: '#c0392b', fontStyle: 'italic',
      backgroundColor: '#fdecea', borderRadius: 6, padding: 8, marginBottom: 8,
    },

    thumbnail: { width: '100%', height: 160, borderRadius: 8, marginTop: 4 },
    viewImage: { textAlign: 'center', color: '#007aff', fontSize: 12, marginTop: 4, marginBottom: 8 },

    actions: { flexDirection: 'row', gap: 10, marginTop: 4 },
    btnAprobar: { flex: 1, backgroundColor: '#34c759', borderRadius: 8, padding: 10, alignItems: 'center' },
    btnRechazar: { flex: 1, backgroundColor: '#ff3b30', borderRadius: 8, padding: 10, alignItems: 'center' },
    btnDisabled: { opacity: 0.5 },
    btnText: { color: '#fff', fontWeight: '600', fontSize: 14 },

    previewOverlay: {
      flex: 1, backgroundColor: 'rgba(0,0,0,0.92)',
      justifyContent: 'center', alignItems: 'center',
    },
    previewImage: { width: '95%', height: '80%' },
    previewClose: { color: '#fff', marginTop: 16, fontSize: 14 },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
    modalContent: {
      backgroundColor: c.card, borderTopLeftRadius: 20, borderTopRightRadius: 20,
      padding: 24, paddingBottom: 40,
    },
    modalTitle: { fontSize: 20, fontWeight: '700', color: c.text, marginBottom: 4 },
    modalSubtitle: { fontSize: 13, color: c.textMuted, marginBottom: 16 },
    noteInput: {
      backgroundColor: c.inputBg, borderRadius: 8, padding: 12,
      fontSize: 15, borderWidth: 1, borderColor: c.border, color: c.text,
      minHeight: 80, textAlignVertical: 'top', marginBottom: 16,
    },
    btnRechazarModal: { backgroundColor: '#ff3b30', borderRadius: 10, padding: 14, alignItems: 'center' },
    cancelButton: { padding: 12, alignItems: 'center', marginTop: 8 },
    cancelText: { color: c.textSec, fontSize: 15 },
  } as any);
}
