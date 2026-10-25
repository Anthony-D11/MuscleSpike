import { ALGORITHM_OPTIONS, FEATURE_OPTIONS } from '@/constants/app-config';
import { CommonStyles, Palette } from '@/constants/shared-styles';
import { useAppConfig } from '@/contexts/AppConfigContext';
import { useBle } from '@/contexts/BleContext';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

const PRIMARY = Palette.PRIMARY;
const DARK = Palette.DARK;
const MUTED = Palette.MUTED;
const CHIP_BG = Palette.CHIP_BG;
const GREEN = Palette.GREEN;
const GREEN_BG = Palette.GREEN_BG;

const REP_OPTIONS = [
  { value: 1, label: '1 Rep' },
  { value: 3, label: '3 Reps' },
  { value: 5, label: '5 Reps' },
];

const GESTURES: { name: string; icon: string }[] = [
  { name: 'No Movement', icon: 'pause-circle-outline' },
  { name: 'Hand Open', icon: 'hand-front-right' },
  { name: 'Hand Close', icon: 'hand-back-left' },
  { name: 'Wrist Extension', icon: 'arrow-top-right' },
  { name: 'Wrist Flexion', icon: 'check' },
];

export default function AppConfigScreen() {
  const {
    numSets,
    setNumSets,
    trainingMotions,
    repDuration,
    setRepDuration,
    trainingAlgorithm,
    setTrainingAlgorithm,
    featureGroup,
    setFeatureGroup
  } = useAppConfig();
  const { connectedDevice } = useBle();

  const connected = connectedDevice !== null;
  const gestureCount = trainingMotions.length;

  return (
    <SafeAreaProvider>
      <SafeAreaView style={CommonStyles.safeArea}>
        <ScrollView
          style={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={CommonStyles.scrollContent}
        >
          {/* Top bar  */}
          <View style={CommonStyles.headerContainer}>
            <View style={CommonStyles.headerLeft}>
              <MaterialCommunityIcons name="antenna" size={24} color="#1E3A8A" />
              <Text style={CommonStyles.headerTitle}>Muscle Spike</Text>
            </View>
            <View style={styles.connectedPill}>
              <MaterialCommunityIcons
                name="bluetooth"
                size={14}
                color={PRIMARY}
              />
              <Text style={styles.connectedPillText}>
                {connected ? 'MyoBand Connected' : 'MyoBand Offline'}
              </Text>
            </View>
          </View>

          {/* Patient / protocol card  */}
          <View style={CommonStyles.card}>
            <View style={styles.patientRow}>
              <View style={styles.avatar}>
                <MaterialCommunityIcons name="account" size={28} color={PRIMARY} />
              </View>
              <View style={styles.patientInfo}>
                <View style={styles.patientIdRow}>
                  <Text style={styles.patientId}>Client Name</Text>
                  <View style={styles.activeBadge}>
                    <Text style={styles.activeBadgeText}>Active</Text>
                  </View>
                </View>
                <Text style={styles.clinician}>Dr. Name</Text>
              </View>
              <TouchableOpacity
                style={styles.slidersButton}
                onPress={() => {}}
                accessibilityLabel="Protocol settings"
              >
                <MaterialCommunityIcons name="tune-variant" size={20} color={PRIMARY} />
              </TouchableOpacity>
            </View>

            <View style={styles.protocolRow}>
              <Text style={styles.protocolLabel}>{'ASSIGNED\nPROTOCOL'}</Text>
              <Text style={styles.protocolValue} numberOfLines={1}>
                Neural-Link-04 (Forea...
              </Text>
            </View>

            <View style={styles.syncRow}>
              <View style={styles.syncLeft}>
                <View style={CommonStyles.statusDot} />
                <Text style={styles.syncedText}>Cloud Synced</Text>
              </View>
              <Text style={styles.modelText}>Model v2.4.1 (Calibrated)</Text>
            </View>
          </View>

          {/* Training Protocol  */}
          <View style={CommonStyles.sectionHeaderRow}>
            <View style={styles.sectionTitleRow}>
              <MaterialCommunityIcons name="dumbbell" size={18} color={PRIMARY} />
              <Text style={CommonStyles.sectionTitleLg}>Training Protocol</Text>
            </View>
            <Text style={CommonStyles.sectionAction}>{gestureCount} GESTURES</Text>
          </View>

          <View style={CommonStyles.card}>
          <Text style={[CommonStyles.sectionLabel, { marginTop: 0 }]}>ACTIVE TARGET GESTURES</Text>
          <View style={styles.chipWrap}>
            {GESTURES.map((g) => {
              const selected = trainingMotions.includes(g.name);
              return (
                <View
                  key={g.name}
                  style={[styles.chip, selected ? styles.chipSelected : styles.chipIdle]}
                >
                  <MaterialCommunityIcons
                    name={g.icon as never}
                    size={14}
                    color={selected ? PRIMARY : MUTED}
                    style={{ marginRight: 6 }}
                  />
                  <Text
                    style={[styles.chipText, !selected && styles.chipTextIdle]}
                  >
                    {g.name}
                  </Text>
                </View>
              );
            })}
          </View>

          {/* Repetitions  */}
          <View style={styles.rowBetween}>
            <Text style={styles.blockTitle}>Repetitions Per Movement</Text>
          </View>
          <View style={styles.optionRow}>
            {REP_OPTIONS.map((opt) => {
              const selected = numSets === opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.optionCard, selected && styles.optionCardSelected]}
                  onPress={() => {
                    setNumSets(opt.value);
                  }}
                >
                  <Text
                    style={[styles.optionTitle, selected && styles.optionTitleSelected]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.restRow}>
            <View>
              <Text style={styles.blockTitle}>Recording Duration</Text>
              <Text style={styles.hapticSub}>
                {'Contraction hold time'}
              </Text>
            </View>
            <View style={styles.stepper}>
              <TouchableOpacity
                style={styles.stepButton}
                onPress={() => {
                  setRepDuration(Math.max(2, repDuration - 1));
                }}
                accessibilityLabel="Decrease rep duration"
              >
                <Text style={styles.stepText}>−</Text>
              </TouchableOpacity>
              <Text style={styles.stepValue}>{repDuration.toFixed(1)}s</Text>
              <TouchableOpacity
                style={styles.stepButton}
                onPress={() => {
                  setRepDuration(Math.min(8, repDuration + 1));
                }}
                accessibilityLabel="Increase rep duration"
              >
                <Text style={styles.stepText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
          </View>

          {/* Classifier & Training Algorithm  */}
          <View style={CommonStyles.sectionHeaderRow}>
            <View style={styles.sectionTitleRow}>
              <MaterialCommunityIcons name="head-cog-outline" size={18} color={PRIMARY} />
              <Text style={CommonStyles.sectionTitleLg}>Classifier & Training Algorithm</Text>
            </View>
            <View style={styles.activeBadge}>
              <Text style={styles.activeBadgeText}>Active: {trainingAlgorithm}</Text>
            </View>
          </View>

          <View style={CommonStyles.card}>
            <Text style={[CommonStyles.sectionLabel, { marginTop: 0 }]}>TRAINING ALGORITHM</Text>
            <View style={styles.pickerBox}>
              <Picker
                selectedValue={trainingAlgorithm}
                onValueChange={(value) => setTrainingAlgorithm(value)}
                dropdownIconColor={PRIMARY}
                style={styles.picker}
              >
                {ALGORITHM_OPTIONS.map((opt) => (
                  <Picker.Item key={opt.value} label={opt.label} value={opt.value} />
                ))}
              </Picker>
            </View>

            <Text style={CommonStyles.sectionLabel}>TARGET FEATURE GROUP</Text>
            <View style={styles.pickerBox}>
              <Picker
                selectedValue={featureGroup}
                onValueChange={(value) => setFeatureGroup(value)}
                dropdownIconColor={PRIMARY}
                style={styles.picker}
              >
                {FEATURE_OPTIONS.map((opt) => (
                  <Picker.Item key={opt.value} label={opt.label} value={opt.value} />
                ))}
              </Picker>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flex: 1,
  },
  connectedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: CHIP_BG,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  connectedPillText: { fontSize: 11, fontWeight: '700', color: PRIMARY },
  patientRow: { flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: CHIP_BG,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  patientInfo: { flex: 1 },
  patientIdRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  patientId: { fontSize: 16, fontWeight: '800', color: DARK },
  activeBadge: {
    backgroundColor: GREEN_BG,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  activeBadgeText: { fontSize: 10, fontWeight: '700', color: GREEN },
  clinician: { fontSize: 13, color: MUTED, marginTop: 2 },
  slidersButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: CHIP_BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  protocolRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  protocolLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: MUTED,
    letterSpacing: 0.6,
    lineHeight: 14,
  },
  protocolValue: {
    fontSize: 14,
    fontWeight: '700',
    color: PRIMARY,
    maxWidth: '62%',
  },
  syncRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  syncLeft: { flexDirection: 'row', alignItems: 'center' },
  syncedText: { fontSize: 12, fontWeight: '600', color: GREEN },
  modelText: { fontSize: 11, fontWeight: '500', color: MUTED },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  optionRow: { flexDirection: 'row', gap: 8 },
  optionCard: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 58,
  },
  optionCardSelected: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  optionTitle: { fontSize: 13, fontWeight: '800', color: DARK },
  optionTitleSelected: { color: '#FFFFFF' },
  optionSub: { fontSize: 10, fontWeight: '500', color: MUTED, marginTop: 2, textAlign: 'center' },
  optionSubSelected: { color: 'rgba(255,255,255,0.85)' },
  hapticRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  hapticText: { flex: 1, paddingRight: 12 },
  hapticTitle: { fontSize: 15, fontWeight: '800', color: DARK },
  hapticSub: { fontSize: 12, color: MUTED, marginTop: 2, lineHeight: 17 },
  divider: { height: 1, backgroundColor: '#E2E8F0', marginVertical: 16 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
  },
  chipSelected: { backgroundColor: CHIP_BG, borderColor: '#BFDBFE' },
  chipIdle: { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' },
  chipText: { fontSize: 12, fontWeight: '700', color: PRIMARY },
  chipTextIdle: { color: MUTED, fontWeight: '500' },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  blockTitle: { fontSize: 15, fontWeight: '800', color: DARK },
  blockAction: { fontSize: 11, fontWeight: '700', color: PRIMARY },
  durationPill: {
    backgroundColor: CHIP_BG,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    minWidth: 56,
    alignItems: 'center',
  },
  durationPillText: { fontSize: 14, fontWeight: '800', color: PRIMARY },
  sliderHit: { height: 32, justifyContent: 'center', marginTop: 6 },
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E2E8F0',
    overflow: 'hidden',
  },
  fill: { height: 6, borderRadius: 3, backgroundColor: PRIMARY },
  thumb: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: PRIMARY,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    marginLeft: -11,
    shadowColor: '#0A58CA',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
  },
  sliderEnd: { fontSize: 11, color: MUTED, fontWeight: '500' },
  sliderTarget: { fontSize: 11, color: PRIMARY, fontWeight: '800' },
  restRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
  },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: { fontSize: 18, fontWeight: '700', color: MUTED, lineHeight: 20 },
  stepValue: { fontSize: 16, fontWeight: '800', color: PRIMARY, minWidth: 40, textAlign: 'center' },
  pickerBox: {
    backgroundColor: CHIP_BG,
    borderRadius: 10,
    overflow: 'hidden',
  },
  picker: { height: 60, fontSize: 14 },
  dimText: {
    fontSize: 12,
    fontWeight: '700',
    color: MUTED,
    textAlign: 'center',
    marginTop: 12,
  },
});
