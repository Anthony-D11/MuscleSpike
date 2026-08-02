//import { EmgPath } from '@/components/emg-path';
import { useBle } from '@/contexts/BleContext';
import { useModel } from '@/contexts/ServerContext';
import { ExtractFeatures } from '@/utils/FeatureExtractor';
import RingBuffer from '@/utils/RingBuffer';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import { Canvas, Path, Skia } from '@shopify/react-native-skia';
import { Buffer } from 'buffer';
import React, { useEffect, useRef, useState } from 'react';
import { Dimensions, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { runOnUI, useDerivedValue, useSharedValue } from 'react-native-reanimated';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

if (typeof global.Buffer === 'undefined') {
  global.Buffer = Buffer;
}
const { width } = Dimensions.get('window');
const GRAPH_WIDTH = width - 64; // Account for margins
const CARD_HEIGHT = 80; // Total height of each channel row
const GRAPH_HEIGHT = 40; // Height of the actual squiggly line
const DATA_BUFFER_SIZE = 400;
const STRIDE = 20;
const WINDOW_SIZE = 100; 
const GESTURES = ['No Movement', 'Hand Open', 'Hand Close', 'Supination', 'Pronation'];

const EmgPath = ({ data, writeIndex, xOffset, yOffset }: { data: any, writeIndex: any, xOffset: number, yOffset: number }) => {
  const path = useDerivedValue(() => {
    const currentPointer = writeIndex.value; 
    
    const skPath = Skia.Path.Make();
    const currentData = data.value;
    const length = currentData.length;

    if (length === 0) return skPath;

    const xStep = GRAPH_WIDTH / (length - 1);
    
    const getY = (val: number) => {
      const normalizedY = (GRAPH_HEIGHT / 2) - ((val * GRAPH_HEIGHT) / 2);
      return normalizedY + yOffset; 
    };

    for (let i = 0; i < length; i++) {
      const dataIndex = (currentPointer + i) % length;
      const x = xOffset + (i * xStep);
      const y = getY(currentData[dataIndex]);

      if (i === 0) {
        skPath.moveTo(x, y);
      } else {
        skPath.lineTo(x, y);
      }
    }

    return skPath;
  });

  return (
    <Path 
      path={path} 
      color="#0A58CA" 
      style="stroke" 
      strokeWidth={1.5} 
      strokeJoin="round"
    />
  );
};



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

  useEffect(() => {
    checkServerConnection();
  }, [isFocused]);

  const pushBleDataToGraph = (batchedEmgArrays: number[][] ) => {
    'worklet'; 
    for (let packetIndex = 0; packetIndex < batchedEmgArrays.length; packetIndex++) {
      const emgArray = batchedEmgArrays[packetIndex];
      
      for (let i = 0; i < 8; i++) {
        const channelData = channels[i];
        const writeIndex = writeIndices[i];
        const currentIndex = writeIndex.value;
        
        const normalizedValue = emgArray[i] / 128.0; 

        channelData.value[currentIndex] = normalizedValue;
        writeIndex.value = (currentIndex + 1) % DATA_BUFFER_SIZE; 
      }
    }
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
                  runOnUI(pushBleDataToGraph)([...packetBatch]);
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

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
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
          <View style={styles.contentSection}>
            <Text style={styles.title}>Current Gesture:</Text>
            <Text style={styles.subtitle}>{currentPrediction}</Text>
          </View>

          {/* Container for the cards and the overlaying Canvas */}
          <View style={styles.telemetryContainer}>
            
            {/* 1. Standard Native Views for the UI Chrome (Text, Backgrounds) */}
            {channels.map((_, index) => (
              <View key={`card-${index}`} style={styles.cardContainer}>
                <View style={styles.cardHeader}>
                  <View style={styles.indicator} />
                  <Text style={styles.channelText}>CH {index + 1}</Text>
                </View>
                {/* Empty space where the graph will be drawn by the overlay */}
                <View style={{ height: GRAPH_HEIGHT }} />
              </View>
            ))}

            {/* 2. THE SINGLE CANVAS OVERLAY */}
            <View style={StyleSheet.absoluteFill} pointerEvents="none">
              <Canvas style={{ flex: 1 }}>
                {channels.map((channelData, index) => {
                  // Calculate exactly where on the Y-axis this line should be drawn
                  // Margin top + (Index * (Card Height + Margin Bottom)) + Header Offset
                  const yOffset = 9 + (index * (CARD_HEIGHT + 12)) + 30; 
                  
                  return (
                    <EmgPath 
                      key={`path-${index}`} 
                      data={channelData} 
                      writeIndex={writeIndices[index]}
                      xOffset={12}
                      yOffset={yOffset} 
                    />
                  );
                })}
              </Canvas>
            </View>

          </View>
        </ScrollView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8FAFC'},
  container: { 
    flex: 1, 
    backgroundColor: '#F8FAFC'
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 60,
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
    minHeight: (80 + 12) * 8,
    paddingBottom: 50
  },
  cardContainer: {
    height: 80,
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
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
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
});