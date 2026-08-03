import { useBle } from '@/contexts/BleContext';
import { useModel } from '@/contexts/ServerContext';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import { Buffer } from 'buffer';
import { File, Paths } from 'expo-file-system';
import React, { useEffect, useRef, useState } from 'react';

import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

const GESTURES = ['No Movement', 'Hand Open', 'Hand Close', 'Supination', 'Pronation'];
const MAX_TRIALS = 3;
const RECORD_DURATION_SEC = 5;

export default function RecordingScreen() {
  const { connectedDevice } = useBle();
  const isFocused = useIsFocused();
  
  const [trialId, setTrialId] = useState(1);
  const [gestureId, setGestureId] = useState(0);
  const [status, setStatus] = useState<'IDLE' | 'RECORDING' | 'DONE'>('IDLE');
  const [timeLeft, setTimeLeft] = useState(RECORD_DURATION_SEC);
  const [isUploading, setIsUploading] = useState(false);
  const [isTraining, setIsTraining] = useState(false);

  const isRecordingRef = useRef(false);
  const dataBuffer = useRef<number[][]>([]);
  const activeSubscriptions = useRef<any[]>([]);
  const { uploadEMGData, trainAndInstallModel } = useModel();
  
  useEffect(() => {
    if (!connectedDevice || !isFocused) return;

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

              if (!isRecordingRef.current) return;

              const rawBytes = Buffer.from(characteristic.value, 'base64');
              if (rawBytes.length >= 16) {
                dataBuffer.current.push([
                  rawBytes.readInt8(0), rawBytes.readInt8(1), rawBytes.readInt8(2), rawBytes.readInt8(3),
                  rawBytes.readInt8(4), rawBytes.readInt8(5), rawBytes.readInt8(6), rawBytes.readInt8(7)
                ]);
                dataBuffer.current.push([
                  rawBytes.readInt8(8), rawBytes.readInt8(9), rawBytes.readInt8(10), rawBytes.readInt8(11),
                  rawBytes.readInt8(12), rawBytes.readInt8(13), rawBytes.readInt8(14), rawBytes.readInt8(15)
                ]);
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

  useEffect(() => {
    let timer: NodeJS.Timeout;
    
    if (status === 'RECORDING') {
      isRecordingRef.current = true;
      dataBuffer.current = [];
      
      timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            completeCaptureStep();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => clearInterval(timer);
  }, [status]);

  const completeCaptureStep = () => {
    isRecordingRef.current = false;
    saveBufferToCSV();
    if (gestureId < GESTURES.length - 1) {
      setGestureId(prev => prev + 1);
      setStatus('IDLE');
    } else if (trialId < MAX_TRIALS) {
      setGestureId(0);
      setTrialId(prev => prev + 1);
      setStatus('IDLE');
    } else {
      setStatus('DONE');
    }
    
    setTimeLeft(RECORD_DURATION_SEC);
  };

  const saveBufferToCSV = () => {
    try {
      const rows = dataBuffer.current.map(channels => channels.map(val => val.toFixed(1)).join(','));
      const csvContent = rows.join('\n');
      
      const fileName = `C_${gestureId}_R_${trialId}_emg.csv`;
      const file = new File(Paths.document, fileName);
      file.create({overwrite: true});
      file.write(csvContent);
      
      console.log(`Saved ${fileName} with ${dataBuffer.current.length} float samples.`);
    } catch (e) {
      console.error("Save failed:", e);
    } finally {
      dataBuffer.current = []; 
    }
  };

  const handleServerUpload = async () => {
    try {
      setIsUploading(true);
      await uploadEMGData();
      Alert.alert("Success", `Data files uploaded to server successfully!`);
      setIsUploading(false);
      setIsTraining(true);
      await trainAndInstallModel();
      setIsTraining(false);
    } catch (e) {
      console.error("Upload error:", e);
      Alert.alert("Upload Error", "Could not reach the server.");
    } finally {
      setIsUploading(false);
      setIsTraining(false);
    }
  };

  const handleResetProtocol = () => {
    setTrialId(1);
    setGestureId(0);
    setTimeLeft(RECORD_DURATION_SEC);
    setStatus('IDLE');
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          {/* Header Section */}
          <View style={styles.headerContainer}>
            <View style={styles.headerLeft}>
              <MaterialCommunityIcons name="antenna" size={24} color="#1E3A8A" />
              <Text style={styles.headerTitle}>Muscle Spike</Text>
            </View>
          </View>
          {status === 'DONE' ? (
            <View style={styles.doneContainer}>
              <Ionicons name="checkmark-circle" size={80} color="#10B981" />
              <Text style={styles.doneTitle}>Protocol Complete</Text>
              <Text style={styles.doneSub}>All 3 trials recorded and saved locally.</Text>
              
              <TouchableOpacity 
                style={[styles.uploadButton, (isUploading || isTraining) && styles.uploadButtonDisabled]} 
                onPress={handleServerUpload}
                disabled={isUploading || isTraining}
              >
                {isUploading || isTraining ? <ActivityIndicator color="#FFF" /> : (
                  <>
                    <Ionicons name="cloud-upload-outline" size={20} color="#FFF" style={{marginRight: 8}} />
                    <Text style={styles.uploadButtonText}>Forward Data to Server</Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.resetButton} 
                onPress={handleResetProtocol}
                disabled={isUploading || isTraining}
              >
                <Ionicons name="refresh" size={20} color="#64748B" style={{marginRight: 8}} />
                <Text style={styles.resetButtonText}>Start New Protocol</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.card}>
              <View style={styles.progressRow}>
                <Text style={styles.trialText}>TRIAL {trialId} OF {MAX_TRIALS}</Text>
                <Text style={styles.stepText}>MOTION {gestureId + 1} / 5</Text>
              </View>

              <Text style={styles.targetLabel}>TARGET MOTION</Text>
              <Text style={styles.gestureName}>{GESTURES[gestureId]}</Text>

              <View style={styles.timerCircle}>
                <Text style={[styles.timerText, status === 'RECORDING' && styles.timerTextActive]}>
                  {timeLeft}s
                </Text>
              </View>

              {status === 'IDLE' ? (
                <TouchableOpacity 
                  style={styles.actionButton} 
                  onPress={() => setStatus('RECORDING')}
                  disabled={!connectedDevice}
                >
                  <Text style={styles.actionButtonText}>
                    {connectedDevice ? "Begin 5s Capture" : "Device Disconnected"}
                  </Text>
                </TouchableOpacity>
              ) : (
                <View style={[styles.actionButton, styles.actionButtonActive]}>
                  <ActivityIndicator color="#FFF" />
                  <Text style={[styles.actionButtonText, {marginLeft: 10}]}>Recording...</Text>
                </View>
              )}
              
            </View>
            
          )}
        </View>
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
  header: { flexDirection: 'row', alignItems: 'center', padding: 20, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  content: { flex: 1, justifyContent: 'flex-start', padding: 20 },
  
  card: { backgroundColor: '#FFF', borderRadius: 16, padding: 24, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 3, alignItems: 'center' },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginBottom: 24 },
  trialText: { fontSize: 12, fontWeight: 'bold', color: '#0A58CA', backgroundColor: '#EFF6FF', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 8 },
  stepText: { fontSize: 12, fontWeight: 'bold', color: '#64748B' },
  
  targetLabel: { fontSize: 12, fontWeight: 'bold', color: '#94A3B8', marginBottom: 4 },
  gestureName: { fontSize: 32, fontWeight: '800', color: '#1E293B', textAlign: 'center', marginBottom: 32 },
  
  timerCircle: { width: 120, height: 120, borderRadius: 60, borderWidth: 4, borderColor: '#E2E8F0', justifyContent: 'center', alignItems: 'center', marginBottom: 32 },
  timerText: { fontSize: 36, fontWeight: 'bold', color: '#94A3B8' },
  timerTextActive: { color: '#EF4444' },

  actionButton: { width: '100%', backgroundColor: '#0A58CA', padding: 18, borderRadius: 12, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' },
  actionButtonActive: { backgroundColor: '#EF4444' },
  actionButtonText: { fontSize: 16, fontWeight: 'bold', color: '#FFF' },

  doneContainer: { alignItems: 'center', justifyContent: 'center' },
  doneTitle: { fontSize: 28, fontWeight: 'bold', color: '#1E293B', marginTop: 16 },
  doneSub: { fontSize: 16, color: '#64748B', marginTop: 8, marginBottom: 32, textAlign: 'center' },
  uploadButton: { backgroundColor: '#10B981', padding: 18, borderRadius: 12, width: '100%', flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  uploadButtonDisabled: { backgroundColor: '#94A3B8' },
  uploadButtonText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  
  resetButton: { backgroundColor: '#F1F5F9', padding: 18, borderRadius: 12, width: '100%', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  resetButtonText: { color: '#475569', fontSize: 16, fontWeight: 'bold' }
});