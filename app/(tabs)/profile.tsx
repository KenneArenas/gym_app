import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
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
import { supabase } from '../../src/lib/supabase';

interface UserPlanWithPlan {
  id: string;
  remaining_days: number;
  status: string;
  created_at: string;
  plans?: { name: string; price?: number };
}

export default function ProfileScreen() {
  const colors = useAppColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [userId, setUserId] = useState('');
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [userPlan, setUserPlan] = useState<UserPlanWithPlan | null>(null);
  const [planHistory, setPlanHistory] = useState<UserPlanWithPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingProof, setUploadingProof] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');

  const router = useRouter();

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [])
  );

  async function loadProfile() {
    setLoading(true);
    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session?.user;
    if (!user) { setLoading(false); return; }

    setUserId(user.id);
    setEmail(user.email ?? '');

    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, phone, avatar_url')
      .eq('id', user.id)
      .maybeSingle();

    if (profile) {
      setFullName(profile.full_name ?? '');
      setPhone(profile.phone ?? '');
      setAvatarUrl(profile.avatar_url ?? '');
    }

    const { data: plans } = await supabase
      .from('user_plans')
      .select('*, plans(name, price)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (plans && plans.length > 0) {
      const active = plans.find(
        (p: UserPlanWithPlan) => p.status === 'activo' && p.remaining_days > 0
      );
      setUserPlan(active ?? null);
      setPlanHistory(plans);
    }

    setLoading(false);
  }

  // ─── EDITAR PERFIL ────────────────────────────────────────────────
  function openEdit() {
    setEditName(fullName);
    setEditPhone(phone);
    setEditModalVisible(true);
  }

  async function saveProfile() {
    if (!editName.trim()) {
      Alert.alert('Error', 'El nombre no puede estar vacío');
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: editName.trim(), phone: editPhone.trim() || null })
      .eq('id', userId);
    setSaving(false);

    if (error) { Alert.alert('Error', 'No se pudo guardar el perfil'); return; }

    setFullName(editName.trim());
    setPhone(editPhone.trim());
    setEditModalVisible(false);
  }

  // ─── FOTO DE PERFIL ───────────────────────────────────────────────
  async function pickAvatar() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso requerido', 'Necesitamos acceso a tu galería');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images' as any,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (result.canceled || !result.assets[0]) return;
    setUploadingAvatar(true);
    await uploadAvatar(result.assets[0].uri);
    setUploadingAvatar(false);
  }

  async function takePhoto() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso requerido', 'Necesitamos acceso a tu cámara');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (result.canceled || !result.assets[0]) return;
    setUploadingAvatar(true);
    await uploadAvatar(result.assets[0].uri);
    setUploadingAvatar(false);
  }

  async function uploadAvatar(uri: string) {
    const ext = uri.split('.').pop() ?? 'jpg';
    const fileName = `${userId}/avatar.${ext}`;
    const response = await fetch(uri);
    const blob = await response.blob();
    const arrayBuffer = await new Response(blob).arrayBuffer();

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(fileName, arrayBuffer, { contentType: `image/${ext}`, upsert: true });

    if (uploadError) { Alert.alert('Error', 'No se pudo subir la foto'); return; }

    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(fileName);
    await supabase.from('profiles').update({ avatar_url: urlData.publicUrl }).eq('id', userId);
    setAvatarUrl(urlData.publicUrl);
  }

  function showAvatarOptions() {
    Alert.alert('Foto de perfil', 'Elige una opción', [
      { text: 'Tomar foto', onPress: takePhoto },
      { text: 'Elegir de galería', onPress: pickAvatar },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  }

  // ─── COMPROBANTE DE PAGO ──────────────────────────────────────────
  async function uploadPaymentProof() {
    if (!userPlan) {
      Alert.alert('Sin plan', 'No tienes un plan activo al cual asociar el comprobante');
      return;
    }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso requerido', 'Necesitamos acceso a tu galería');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images' as any,
      allowsEditing: false,
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;

    setUploadingProof(true);
    const uri = result.assets[0].uri;
    const ext = uri.split('.').pop() ?? 'jpg';
    const fileName = `${userId}/${Date.now()}.${ext}`;
    const response = await fetch(uri);
    const blob = await response.blob();
    const arrayBuffer = await new Response(blob).arrayBuffer();

    const { error: uploadError } = await supabase.storage
      .from('payment-proofs')
      .upload(fileName, arrayBuffer, { contentType: `image/${ext}`, upsert: false });

    if (uploadError) {
      setUploadingProof(false);
      Alert.alert('Error', 'No se pudo subir el comprobante');
      return;
    }

    const { data: urlData } = supabase.storage.from('payment-proofs').getPublicUrl(fileName);

    const { error: insertError } = await supabase.from('payment_proofs').insert({
      user_id: userId,
      user_plan_id: userPlan.id,
      image_url: urlData.publicUrl,
      status: 'pendiente',
    });

    setUploadingProof(false);

    if (insertError) { Alert.alert('Error', 'No se pudo registrar el comprobante'); return; }

    Alert.alert('Enviado', 'Tu comprobante fue enviado. El administrador lo revisará pronto.');
  }

  async function logout() {
    await supabase.auth.signOut();
    router.replace('/login');
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

        {/* ── AVATAR ── */}
        <View style={styles.avatarSection}>
          <TouchableOpacity onPress={showAvatarOptions} disabled={uploadingAvatar}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarInitial}>
                  {fullName ? fullName[0].toUpperCase() : '?'}
                </Text>
              </View>
            )}
            {uploadingAvatar && (
              <View style={styles.avatarOverlay}>
                <ActivityIndicator color="#fff" />
              </View>
            )}
          </TouchableOpacity>
          <Text style={styles.avatarHint}>Toca para cambiar foto</Text>
        </View>

        {/* ── INFO PERFIL ── */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Mis datos</Text>
            <TouchableOpacity onPress={openEdit}>
              <Text style={styles.editLink}>Editar</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.label}>Nombre</Text>
          <Text style={styles.value}>{fullName || '—'}</Text>
          <Text style={styles.label}>Correo</Text>
          <Text style={styles.value}>{email}</Text>
          <Text style={styles.label}>Teléfono</Text>
          <Text style={styles.value}>{phone || '—'}</Text>
        </View>

        {/* ── PLAN ACTIVO ── */}
        {userPlan ? (
          <View style={[styles.card, styles.cardActive]}>
            <Text style={styles.cardTitle}>Plan activo</Text>
            <Text style={styles.planName}>{userPlan.plans?.name}</Text>
            <Text style={styles.value}>Días restantes: {userPlan.remaining_days}</Text>
            {userPlan.plans?.price && (
              <Text style={styles.label}>Precio: ${userPlan.plans.price.toLocaleString('es-CO')}</Text>
            )}
            <TouchableOpacity
              style={[styles.proofButton, uploadingProof && styles.btnDisabled]}
              onPress={uploadPaymentProof}
              disabled={uploadingProof}
            >
              {uploadingProof ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.proofButtonText}>📎 Subir comprobante de pago</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Plan</Text>
            <Text style={styles.value}>No tienes un plan activo</Text>
          </View>
        )}

        {/* ── HISTORIAL DE PLANES ── */}
        {planHistory.length > 0 && (
          <TouchableOpacity style={styles.card} onPress={() => setHistoryModalVisible(true)}>
            <Text style={styles.cardTitle}>Historial de planes</Text>
            <Text style={styles.editLink}>{planHistory.length} plan(es) → Ver todos</Text>
          </TouchableOpacity>
        )}

        {/* ── LOGOUT ── */}
        <TouchableOpacity style={styles.logoutButton} onPress={logout}>
          <Text style={styles.logoutText}>Cerrar sesión</Text>
        </TouchableOpacity>

      </ScrollView>

      {/* ── MODAL EDITAR PERFIL ── */}
      <Modal visible={editModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Editar perfil</Text>
            <Text style={styles.label}>Nombre completo</Text>
            <TextInput
              style={styles.input}
              value={editName}
              onChangeText={setEditName}
              autoCapitalize="words"
            />
            <Text style={styles.label}>Teléfono</Text>
            <TextInput
              style={styles.input}
              value={editPhone}
              onChangeText={setEditPhone}
              keyboardType="phone-pad"
              placeholder="Ej: 3001234567"
            />
            <Text style={[styles.label, { marginBottom: 12 }]}>
              Correo: {email} (no editable)
            </Text>
            <TouchableOpacity
              style={[styles.saveButton, saving && styles.btnDisabled]}
              onPress={saveProfile}
              disabled={saving}
            >
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Guardar cambios</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelButton} onPress={() => setEditModalVisible(false)}>
              <Text style={styles.cancelText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── MODAL HISTORIAL ── */}
      <Modal visible={historyModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Historial de planes</Text>
            <ScrollView style={{ maxHeight: 300 }}>
              {planHistory.map((p) => (
                <View key={p.id} style={styles.historyItem}>
                  <Text style={styles.historyName}>{p.plans?.name ?? 'Plan'}</Text>
                  <Text style={styles.historyDetail}>
                    Estado: {p.status} · {p.remaining_days} días restantes
                  </Text>
                  <Text style={styles.historyDate}>
                    {new Date(p.created_at).toLocaleDateString('es-CO')}
                  </Text>
                </View>
              ))}
            </ScrollView>
            <TouchableOpacity style={[styles.cancelButton, { marginTop: 12 }]} onPress={() => setHistoryModalVisible(false)}>
              <Text style={styles.cancelText}>Cerrar</Text>
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
    scroll: { padding: 20, paddingBottom: 40 },

    avatarSection: { alignItems: 'center', marginVertical: 24 },
    avatar: { width: 100, height: 100, borderRadius: 50 },
    avatarPlaceholder: {
      width: 100, height: 100, borderRadius: 50,
      backgroundColor: '#007aff', justifyContent: 'center', alignItems: 'center',
    },
    avatarInitial: { color: '#fff', fontSize: 40, fontWeight: 'bold' },
    avatarOverlay: {
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      borderRadius: 50, backgroundColor: 'rgba(0,0,0,0.4)',
      justifyContent: 'center', alignItems: 'center',
    },
    avatarHint: { color: c.textMuted, fontSize: 12, marginTop: 8 },

    card: {
      backgroundColor: c.card, borderRadius: 12, padding: 16,
      marginBottom: 14, elevation: 1, shadowColor: '#000',
      shadowOpacity: 0.05, shadowRadius: 4,
    },
    cardActive: { backgroundColor: c.planActive },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    cardTitle: { fontSize: 16, fontWeight: '700', color: c.text, marginBottom: 4 },
    planName: { fontSize: 18, fontWeight: '700', color: '#2e7d32', marginBottom: 4 },
    editLink: { color: '#007aff', fontSize: 14, fontWeight: '600' },
    label: { fontSize: 12, color: c.textMuted, marginTop: 8 },
    value: { fontSize: 15, color: c.text, marginTop: 2 },

    proofButton: {
      backgroundColor: '#007aff', borderRadius: 8,
      padding: 12, alignItems: 'center', marginTop: 14,
    },
    proofButtonText: { color: '#fff', fontWeight: '600', fontSize: 14 },

    historyItem: { borderBottomWidth: 1, borderColor: c.rowSep, paddingVertical: 10 },
    historyName: { fontSize: 15, fontWeight: '600', color: c.text },
    historyDetail: { fontSize: 13, color: c.textSec, marginTop: 2 },
    historyDate: { fontSize: 12, color: c.textMuted, marginTop: 2 },

    logoutButton: {
      backgroundColor: '#ff3b30', borderRadius: 10,
      padding: 14, alignItems: 'center', marginTop: 8,
    },
    logoutText: { color: '#fff', fontSize: 16, fontWeight: '600' },

    modalOverlay: {
      flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end',
    },
    modalContent: {
      backgroundColor: c.card, borderTopLeftRadius: 20, borderTopRightRadius: 20,
      padding: 24, paddingBottom: 40,
    },
    modalTitle: { fontSize: 20, fontWeight: '700', marginBottom: 16, color: c.text },
    input: {
      backgroundColor: c.inputBg, borderRadius: 8, padding: 12,
      fontSize: 15, marginBottom: 12, borderWidth: 1, borderColor: c.border, color: c.text,
    },
    saveButton: {
      backgroundColor: '#007aff', borderRadius: 10,
      padding: 14, alignItems: 'center', marginTop: 4,
    },
    saveButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
    cancelButton: { borderRadius: 10, padding: 12, alignItems: 'center', marginTop: 8 },
    cancelText: { color: c.textSec, fontSize: 15 },
    btnDisabled: { opacity: 0.5 },
  });
}