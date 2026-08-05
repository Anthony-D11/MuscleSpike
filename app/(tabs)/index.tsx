import BarEMGChart from '@/components/BarEMGChart';
import RadialEMGChart from '@/components/RadialEMGChart';
import RawEMGChart from '@/components/RawEMGChart';
import { useBle } from '@/contexts/BleContext';
import { useModel } from '@/contexts/ServerContext';
import { ExtractFeatures } from '@/utils/FeatureExtractor';
import RingBuffer from '@/utils/RingBuffer';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import { Buffer } from 'buffer';
import React, { useEffect, useRef, useState } from 'react';
import { Modal, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { scheduleOnUI } from 'react-native-worklets';

if (typeof global.Buffer === 'undefined') {
  global.Buffer = Buffer;
}

const DATA_BUFFER_SIZE = 400;
const STRIDE = 20;
const WINDOW_SIZE = 100; 
const GESTURES = ['No Movement', 'Hand Open', 'Hand Close', 'Supination', 'Pronation'];


export default function DashboardScreen() {
  
  const { connectedDevice } = useBle();
    
  const channels = Array.from({ length: 8 }).map(() => useSharedValue(new Float32Array(DATA_BUFFER_SIZE)));
  const writeIndices = Array.from({ length: 8 }).map(() => useSharedValue<number>(0));

  const [currentPrediction, setCurrentPrediction] = useState("Waiting for data...");
  const liveBuffer = useRef<RingBuffer>(new RingBuffer(WINDOW_SIZE));
  const samplesSinceLastPredict = useRef(0);
  const isFocused = useIsFocused();
  const activeSubscriptions = useRef<any[]>([]);
  const { liveModel, isModelLoaded, isServerReachable, checkServerConnection } = useModel();
  const mavValues = useSharedValue([0, 0, 0, 0, 0, 0, 0, 0]);

  const [isSettingDialogVisible, setIsSettingDialogVisible] = useState(false);
  const [chartType, setChartType] = useState<'radial' | 'raw' | 'bars'>('bars');
  const [activeChannels, setActiveChannels] = useState<boolean[]>(Array(8).fill(true));

  useEffect(() => {
    checkServerConnection();
  }, [isFocused]);

  const pushBleDataToGraph = (batchedEmgArrays: number[][] ) => {
    'worklet'; 
    const currentMavs = [...mavValues.value];
    for (let packetIndex = 0; packetIndex < batchedEmgArrays.length; packetIndex++) {
      const emgArray = batchedEmgArrays[packetIndex];
      
      for (let i = 0; i < 8; i++) {
        const channelData = channels[i];
        const writeIndex = writeIndices[i];
        const currentIndex = writeIndex.value;
        
        const normalizedValue = emgArray[i] / 128.0; 
        
        const absoluteValue = Math.abs(normalizedValue);
        currentMavs[i] = (0.08 * absoluteValue) + ((1 - 0.08) * currentMavs[i]);

        channelData.value[currentIndex] = normalizedValue;
        writeIndex.value = (currentIndex + 1) % DATA_BUFFER_SIZE;
      }
    }
    mavValues.value = currentMavs;
  };
  
  

  useEffect(() => {
    if (!connectedDevice || !isFocused) return;
    let packetBatch: number[][] = [];
    const EMG_CHARACTERISTICS = [
      'd5060105-a904-deb9-4748-2c7f4a124842',
      'd5060205-a904-deb9-4748-2c7f4a124842',
      'd5060305-a904-deb9-4748-2c7f4a124842',
      'd5060405-a904-deb9-4748-2c7f4a124842'
    ];

    let isMounted = true;
    const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

    const openLanes = async () => {
      for (const charUUID of EMG_CHARACTERISTICS) {
        if (!isMounted) break;
        try {
          const sub = connectedDevice.monitorCharacteristicForService(
            'd5060005-a904-deb9-4748-2c7f4a124842',
            charUUID,
            (error, characteristic) => {
              if (error || !characteristic?.value) return;
  
              const rawBytes = Buffer.from(characteristic.value, 'base64');
              if (rawBytes.length >= 16) {
                liveBuffer.current.push([
                  rawBytes.readInt8(0), rawBytes.readInt8(1), rawBytes.readInt8(2), rawBytes.readInt8(3),
                  rawBytes.readInt8(4), rawBytes.readInt8(5), rawBytes.readInt8(6), rawBytes.readInt8(7)
                ]);
                liveBuffer.current.push([
                  rawBytes.readInt8(8), rawBytes.readInt8(9), rawBytes.readInt8(10), rawBytes.readInt8(11),
                  rawBytes.readInt8(12), rawBytes.readInt8(13), rawBytes.readInt8(14), rawBytes.readInt8(15)
                ]);
                packetBatch.push([
                  rawBytes.readInt8(0), rawBytes.readInt8(1), rawBytes.readInt8(2), rawBytes.readInt8(3),
                  rawBytes.readInt8(4), rawBytes.readInt8(5), rawBytes.readInt8(6), rawBytes.readInt8(7)
                ]);
                packetBatch.push([
                  rawBytes.readInt8(8), rawBytes.readInt8(9), rawBytes.readInt8(10), rawBytes.readInt8(11),
                  rawBytes.readInt8(12), rawBytes.readInt8(13), rawBytes.readInt8(14), rawBytes.readInt8(15)
                ]);
                if (packetBatch.length >= 4) {
                  scheduleOnUI(pushBleDataToGraph, [...packetBatch]);
                  packetBatch = [];
                }
                samplesSinceLastPredict.current += 2;

                if (liveBuffer.current.isFull && samplesSinceLastPredict.current >= STRIDE) {
                  samplesSinceLastPredict.current = 0;
                  executeModelInference();
                }
              }

            }
          );
          activeSubscriptions.current.push(sub);
          await sleep(60); // Prevent GATT collision
        } catch (e) {
          console.error("Lane Error:", e);
        }
      }
    };

    openLanes();

    return () => {
      isMounted = false;
      activeSubscriptions.current.forEach(sub => sub.remove());
      activeSubscriptions.current = [];
    };
  }, [connectedDevice, isFocused]);

  const executeModelInference = () => {
    if (!isModelLoaded || !liveModel) return;

    const featureVector = ExtractFeatures(liveBuffer.current.getOrdered());

    try {
      const rawOutput = liveModel(featureVector); 

      if (Array.isArray(rawOutput)) {
        const predictedClassIndex = rawOutput.indexOf(Math.max(...rawOutput));
        
        setCurrentPrediction(GESTURES[predictedClassIndex]);
      }
    } catch (e) {
      console.error("Math execution crashed:", e);
    }
  };

  const toggleChannel = (index: number) => {
    setActiveChannels(prev => {
      const newChannels = [...prev];
      newChannels[index] = !newChannels[index];
      return newChannels;
    });
  };

  const renderChart = () => {
    switch (chartType) {
      case 'radial':
        return <RadialEMGChart mavValues={mavValues} activeChannels={activeChannels} />;
      case 'raw':
        return <RawEMGChart channels={channels} writeIndices={writeIndices} activeChannels={activeChannels} />;
      case 'bars':
        return <BarEMGChart mavValues={mavValues} activeChannels={activeChannels} />;
      default:
        return null;
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView 
        style={styles.scrollContainer} 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <StatusBar barStyle="light-content" backgroundColor="#121212" />
        {/* Header Section */}
        <View style={styles.headerContainer}>
          <View style={styles.headerLeft}>
            <MaterialCommunityIcons name="antenna" size={24} color="#1E3A8A" />
            <Text style={styles.headerTitle}>Muscle Spike</Text>
          </View>
        </View>
        {/* Status Cards Section */}
        <View style={styles.statusRow}>
          {/* Bluetooth Card */}
          <View style={styles.statusCard}>
            <View style={styles.statusIndicatorContainer}>
              <View style={[
                styles.indicatorLine,
                connectedDevice !== null ? {backgroundColor: '#10B981'} : {backgroundColor: '#ba1a1a'}
              ]} />
            </View>
            <View style={styles.statusTextContainer}>
              <Text style={styles.statusLabel}>BLUETOOTH</Text>
              <Text style={styles.statusValue}>{connectedDevice !== null ? 'Connected' : 'Disconnected'}</Text>
            </View>
            <Ionicons name="bluetooth" size={20} color="#475569" />
          </View>
          {/* Server Card */}
          <View style={styles.statusCard}>
            <View style={styles.statusIndicatorContainer}>
              <View style={[
                styles.indicatorDot,
                isServerReachable ? {backgroundColor: '#10B981'} : {backgroundColor: '#ba1a1a'}
              ]} />
            </View>
            <View style={styles.statusTextContainer}>
              <Text style={styles.statusLabel}>SERVER</Text>
              <Text style={styles.statusValue}>{isServerReachable ? "Online" : "Offline"}</Text>
            </View>
            <Ionicons name="cloud-done-outline" size={20} color="#475569" />
          </View>
        </View>
        {/* Prediction Section */}
        <View style={styles.contentSection}>
          <Text style={styles.title}>Current Gesture:</Text>
          <Text style={styles.subtitle}>{currentPrediction}</Text>
        </View>
        {/* Container for the cards and the overlaying Canvas */}
        <View style={styles.telemetryContainer}>
          <View style={styles.cardContainer}>
            <View style={styles.cardHeader}>
              <TouchableOpacity style={styles.settingsButton} onPress={() => setIsSettingDialogVisible(true)}>
                <Ionicons name="settings-outline" size={25} color="black" />
              </TouchableOpacity>
              {/* <TouchableOpacity style={styles.settingsButton}>
                <Ionicons name="resize-outline" size={25} color="black" />
              </TouchableOpacity> */}
            </View>
          </View>
          {renderChart()}
        </View>
        {/* Settings Modal */}
        <Modal
          visible={isSettingDialogVisible}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setIsSettingDialogVisible(false)}
        >
          {/* Dark overlay background */}
          <View style={styles.modalOverlay}>
            {/* Dialog Box */}
            <View style={styles.dialogBox}>
              
              <Text style={styles.dialogTitle}>Chart Settings</Text>

              {/* --- Chart Type Selection --- */}
              <Text style={styles.sectionHeader}>Chart Type</Text>
              <View style={styles.row}>
                <TouchableOpacity 
                  style={[styles.typeButton, chartType === 'radial' && styles.activeType]}
                  onPress={() => setChartType('radial')}
                >
                  <Text style={chartType === 'radial' ? styles.activeText : styles.inactiveText}>Radial</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.typeButton, chartType === 'raw' && styles.activeType]}
                  onPress={() => setChartType('raw')}
                >
                  <Text style={chartType === 'raw' ? styles.activeText : styles.inactiveText}>Raw</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.typeButton, chartType === 'bars' && styles.activeType]}
                  onPress={() => setChartType('bars')}
                >
                  <Text style={chartType === 'bars' ? styles.activeText : styles.inactiveText}>Bar</Text>
                </TouchableOpacity>
              </View>

              {/* --- Channel Selection --- */}
              <Text style={styles.sectionHeader}>Active Channels</Text>
              <View style={styles.chipContainer}>
                {activeChannels.map((isActive, index) => (
                  <TouchableOpacity
                    key={`channel-toggle-${index}`}
                    style={[styles.chip, isActive ? styles.chipActive : styles.chipInactive]}
                    onPress={() => toggleChannel(index)}
                  >
                    <Text style={isActive ? styles.chipTextActive : styles.chipTextInactive}>
                      CH {index + 1}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Close Button */}
              <TouchableOpacity 
                style={styles.closeButton} 
                onPress={() => setIsSettingDialogVisible(false)}
              >
                <Text style={styles.closeButtonText}>Done</Text>
              </TouchableOpacity>

            </View>
          </View>
        </Modal>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { 
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    padding: 10,
    paddingBottom: 20,
  },
  /* Header Styles */
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0066CC',
  },
  /* Status Cards Styles */
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },
  statusCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0', 
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  statusIndicatorContainer: {
    width: 12,
    alignItems: 'center',
    marginRight: 8,
  },
  indicatorLine: {
    width: 3,
    height: 12,
    borderRadius: 2,
  },
  indicatorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusTextContainer: {
    flex: 1,
  },
  statusLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
    letterSpacing: 0.5,
  },
  statusValue: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0F172A',
  },
  /* Hero Card Styles */
  heroCard: {
    backgroundColor: '#2563EB',
    borderRadius: 20,
    padding: 24,
    marginBottom: 24,
    overflow: 'hidden',
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  heroDescription: {
    fontSize: 15,
    color: '#DBEAFE',
    lineHeight: 22,
    marginBottom: 24,
    paddingRight: 20,
  },
  heroButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignSelf: 'flex-start',
    gap: 8,
  },
  heroButtonText: {
    color: '#2563EB',
    fontSize: 15,
    fontWeight: '600',
  },
  contentSection: {
    paddingVertical: 10
  },
  
  title: { 
    color: '#0F172A',
    fontSize: 18, 
    fontWeight: 'bold' 
  },
  subtitle: { fontSize: 14, color: '#64748B', marginTop: 4 },
  
  telemetryContainer: {
    position: 'relative',
    height: 550,
  },
  cardContainer: {
    height: 550,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12, 
    borderWidth: 1,
    borderColor: '#E2E8F0', 
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  cardHeader: {
    height: 26,
    display: 'flex', 
    flexDirection: 'row', 
    justifyContent: 'flex-end', 
    alignItems: 'center', 
    gap: 20,
  },
  indicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#0A58CA',
    marginRight: 8,
  },
  channelText: { 
    color: '#334155',
    fontSize: 14, 
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  settingsButton: {
    
  },
  buttonText: {
    color: '#007AFF', // Primary Blue
    fontSize: 16,
    fontWeight: '600',
  },
  
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)', // Lighter dimming for light mode
    justifyContent: 'center',
  },
  dialogBox: {
    backgroundColor: '#FFFFFF', // Clean white dialog
    borderRadius: 12,
    padding: 20,
    paddingBottom: 40,
    margin: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 10,
  },
  dialogTitle: {
    color: '#1E293B', // Dark slate for high contrast
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  sectionHeader: {
    color: '#64748B', // Slate grey
    fontSize: 14,
    textTransform: 'uppercase',
    fontWeight: '600',
    marginBottom: 10,
    marginTop: 10,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  
  // Type Buttons
  typeButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
  },
  activeType: {
    backgroundColor: '#007AFF', // Primary Blue
    borderColor: '#007AFF',
  },
  inactiveText: { color: '#64748B', fontWeight: 'bold' },
  activeText: { color: '#FFFFFF', fontWeight: 'bold' },

  // Channel Chips
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 30,
  },
  chip: {
    width: '22%', 
    paddingVertical: 10,
    borderRadius: 20,
    alignItems: 'center',
    borderWidth: 1,
  },
  chipActive: {
    backgroundColor: 'rgba(0, 122, 255, 0.1)', // Tinted blue background
    borderColor: '#007AFF',
  },
  chipInactive: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
  },
  chipTextActive: { color: '#007AFF', fontWeight: 'bold' },
  chipTextInactive: { color: '#64748B' },

  // Close Button
  closeButton: {
    backgroundColor: '#007AFF', // Primary Blue
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});