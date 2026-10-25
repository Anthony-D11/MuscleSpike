import { useBle } from '@/contexts/BleContext';
import { useModel } from '@/contexts/ServerContext';
import { CommonStyles } from '@/constants/shared-styles';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import React, { useEffect } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';


export default function IntegratedScannerScreen() {
  const { connectedDevice, isScanning, scannedDevices, connectionError, startScan, connectToDevice, disconnect } = useBle();
  const { isServerReachable, checkServerConnection } = useModel();
  
  useEffect(() => {
    checkServerConnection();
  }, []);

  return (
    <SafeAreaProvider>
      <SafeAreaView style={CommonStyles.safeArea}>
        <ScrollView style={styles.scrollContainer} contentContainerStyle={CommonStyles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Header Section */}
          <View style={CommonStyles.headerContainer}>
            <View style={CommonStyles.headerLeft}>
              <MaterialCommunityIcons name="antenna" size={24} color="#1E3A8A" />
              <Text style={CommonStyles.headerTitle}>Muscle Spike</Text>
            </View>
          </View>  
          {/* TOP STATUS BAR */}
          <TouchableOpacity 
            onPress={() => {
                checkServerConnection();
              }
            }
            style={[CommonStyles.card, styles.statusCard]}>
            <View style={styles.statusSection}>
              <Text style={styles.statusLabel}>SYSTEM HEALTH</Text>
              <View style={styles.statusRow}>
                <View style={CommonStyles.statusDot} />
                <Text style={styles.statusValueDark}>Model v2.4 Active</Text>
              </View>
            </View>
            <View style={styles.divider} />
            <View style={[styles.statusSection, { alignItems: 'flex-end' }]}>
              <Text style={styles.statusLabel}>SERVER STATUS</Text>
              <View style={styles.statusRow}>
                <Ionicons name="cloud-done-outline" size={16} color={isServerReachable ? "#10B981" : "#ba1a1a"} />
                <Text style={isServerReachable ?  styles.statusValueGreen : styles.statusValueRed}> {isServerReachable ? "Online" : "Offline"}</Text>
              </View>
            </View>
          </TouchableOpacity>

          {/* RADAR / SCANNING GRAPHIC */}
          <View style={styles.radarContainer}>
            <View style={styles.radarRingOuter}>
              <View style={styles.radarRingInner}>
                {/* Wrapping the core in a touchable to trigger the scan manually */}
                <TouchableOpacity 
                  style={styles.radarCore} 
                  onPress={startScan}
                  disabled={isScanning}
                  activeOpacity={0.7}
                >
                  {isScanning ? (
                    <ActivityIndicator color="#FFFFFF" size="large" />
                  ) : (
                    <Ionicons name="bluetooth" size={36} color="#FFFFFF" />
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* HEADER TEXT */}
          <View style={styles.textContainer}>
            <Text style={styles.title}>
              {isScanning ? 'Scanning for MyoBand...' : 'Tap to Scan'}
            </Text>
            <Text style={styles.subtitle}>
              Ensure your wearable is powered on and within range for calibration.
            </Text>
          </View>

          {/* NEARBY DEVICES SECTION */}
          <View style={CommonStyles.sectionHeaderRow}>
            <Text style={CommonStyles.sectionTitleSm}>NEARBY DEVICES</Text>
            <Text style={CommonStyles.sectionAction}>{scannedDevices.length} FOUND</Text>
          </View>

          {scannedDevices.length === 0 && !isScanning && (
            <Text style={styles.emptyText}>No devices found yet.</Text>
          )}

          {/* DYNAMIC DEVICE LIST */}
          {scannedDevices.map((device) => {
            const isConnected = connectedDevice?.id === device.id;

            return (
              <TouchableOpacity 
                key={device.id}
                style={isConnected ? styles.deviceCardActive : [CommonStyles.card, styles.deviceCardInactive]}
                onPress={() => {
                  if (isConnected) {
                    disconnect(device);
                  } else {
                    connectToDevice(device);
                  }
                }}
              >
                <View style={isConnected ? styles.iconContainerActive : styles.iconContainerInactive}>
                  <MaterialCommunityIcons 
                      name="watch-variant" 
                      size={24} 
                      color={isConnected ? "#FFFFFF" : "#1E293B"} 
                  />
                </View>
                <View style={styles.deviceInfo}>
                  <Text style={isConnected ? styles.deviceNameActive : styles.deviceNameInactive}>
                    {(device.name || 'Unknown Device') + (isConnected ? ' - Connected' : '')}
                  </Text>
                  <Text style={isConnected ? styles.deviceSubActive : styles.deviceSubInactive}>
                    {isConnected ? 'Tap again to disconnect' : 'Tap to pair'}
                  </Text>
                </View>
                <View style={styles.deviceIndicators}>
                  {isConnected ? (
                    <Feather name="check-circle" size={18} color="#FFFFFF" />
                  ) : (
                    <></>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}

          {/* TROUBLESHOOTING SECTION */}
          <View style={[CommonStyles.sectionHeaderRow, { marginTop: 32 }]}>
            <Text style={CommonStyles.sectionTitleSm}>TROUBLESHOOTING</Text>
          </View>

          <View style={styles.troubleshootingGrid}>
            <View style={styles.troubleCard}>
              <Ionicons name="battery-dead-outline" size={24} color="#0A58CA" style={{ marginBottom: 12 }} />
              <Text style={styles.troubleTitle}>Check Battery</Text>
              <Text style={styles.troubleText}>Ensure MyoBand is above 15% charge for session stability.</Text>
            </View>

            <View style={styles.troubleCard}>
              <Ionicons name="refresh" size={24} color="#0A58CA" style={{ marginBottom: 12 }} />
              <Text style={styles.troubleTitle}>Hard Reset</Text>
              <Text style={styles.troubleText}>Hold power button for 10s if device is unresponsive.</Text>
            </View>
          </View>

        </ScrollView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  scrollContainer: { flex: 1 },
  statusCard: {
    flexDirection: 'row',
    padding: 16,
    justifyContent: 'space-between', alignItems: 'center', marginTop: 10,
  },
  statusSection: { flex: 1 },
  divider: { width: 1, height: 30, backgroundColor: '#E2E8F0', marginHorizontal: 16 },
  statusLabel: { fontSize: 10, fontWeight: '700', color: '#64748B', letterSpacing: 0.5, marginBottom: 4 },
  statusRow: { flexDirection: 'row', alignItems: 'center' },
  statusValueDark: { fontSize: 13, fontWeight: '700', color: '#1E293B' },
  statusValueGreen: { fontSize: 13, fontWeight: '700', color: '#10B981' },
  statusValueRed: { fontSize: 13, fontWeight: '700', color: '#ba1a1a' },
  radarContainer: { alignItems: 'center', justifyContent: 'center', marginVertical: 40 },
  radarRingOuter: { width: 220, height: 220, borderRadius: 110, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  radarRingInner: { width: 150, height: 150, borderRadius: 75, backgroundColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#CBD5E1' },
  radarCore: { width: 90, height: 90, borderRadius: 45, backgroundColor: '#0A58CA', alignItems: 'center', justifyContent: 'center', shadowColor: '#0A58CA', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 5 },
  textContainer: { alignItems: 'center', marginBottom: 32 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#0F172A', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#475569', textAlign: 'center', lineHeight: 20, paddingHorizontal: 20 },
  
  // Card Styles
  deviceCardActive: { flexDirection: 'row', backgroundColor: '#0A58CA', borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 12, shadowColor: '#0A58CA', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 },
  iconContainerActive: { width: 44, height: 44, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  deviceNameActive: { fontSize: 15, fontWeight: 'bold', color: '#FFFFFF', marginBottom: 4 },
  deviceSubActive: { fontSize: 12, color: '#E2E8F0' },
  deviceCardInactive: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 12 },
  iconContainerInactive: { width: 44, height: 44, borderRadius: 8, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  deviceNameInactive: { fontSize: 15, fontWeight: 'bold', color: '#1E293B', marginBottom: 4 },
  deviceSubInactive: { fontSize: 12, color: '#64748B' },
  deviceInfo: { flex: 1 },
  deviceIndicators: { flexDirection: 'row', alignItems: 'center' },
  
  // Troubleshooting & Empty States
  emptyText: { color: '#64748B', fontSize: 14, textAlign: 'center', marginVertical: 20 },
  troubleshootingGrid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 62 },
  troubleCard: { flex: 1, backgroundColor: '#EBF3FA', borderRadius: 12, padding: 16, marginHorizontal: 4 },
  troubleTitle: { fontSize: 14, fontWeight: 'bold', color: '#0F172A', marginBottom: 6 },
  troubleText: { fontSize: 12, color: '#475569', lineHeight: 18 },
});