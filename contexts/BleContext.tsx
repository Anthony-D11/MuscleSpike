import React, { createContext, useContext, useEffect, useState } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';
import { BleManager, ConnectionPriority, Device, State } from 'react-native-ble-plx';

const bleManager = new BleManager();

// --- Myo Control UUIDs (For sending commands) ---
const MYO_CONTROL_SERVICE_UUID = 'd5060001-a904-deb9-4748-2c7f4a124842';
const MYO_COMMAND_CHAR_UUID = 'd5060401-a904-deb9-4748-2c7f4a124842';

// --- Myo EMG Data UUIDs (For reading the stream) ---
const MYO_EMG_SERVICE_UUID = 'd5060005-a904-deb9-4748-2c7f4a124842';
const MYO_EMG_CHAR_UUID = 'd5060105-a904-deb9-4748-2c7f4a124842';

interface BleContextType {
  connectedDevice: Device | null;
  isScanning: boolean;
  scannedDevices: Device[];
  connectionError: string | null;
  startScan: () => Promise<void>;
  connectToDevice: (device: Device) => Promise<void>;
  disconnect: (device: Device) => Promise<void>;
}

const BleContext = createContext<BleContextType | null>(null);

export const BleProvider = ({ children }: { children: React.ReactNode }) => {
  const [connectedDevice, setConnectedDevice] = useState<Device | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scannedDevices, setScannedDevices] = useState<Device[]>([]);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  useEffect(() => {
    const stateSubscription = bleManager.onStateChange((state) => {
      if (state === State.PoweredOff) {
        console.log("Bluetooth was turned off by the user.");
        
        setConnectedDevice(null);
        
      }
    }, true); 

    return () => {
      // Cleanup to prevent memory leaks
      stateSubscription.remove();
    };
  }, []);

  const startScan = async () => {
    if (isScanning) return;

    if (Platform.OS === 'android') {
      let granted = false;
      // Android 12+ (API 31+) uses granular Bluetooth permissions
      if (Platform.Version >= 31) {
        const result = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        ]);
        granted = 
          result['android.permission.BLUETOOTH_SCAN'] === PermissionsAndroid.RESULTS.GRANTED &&
          result['android.permission.BLUETOOTH_CONNECT'] === PermissionsAndroid.RESULTS.GRANTED;
      } 
      // Older Android versions just require Location permission to scan for BLE
      else {
        const result = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
        );
        granted = result === PermissionsAndroid.RESULTS.GRANTED;
      }

      if (!granted) {
        setConnectionError("Bluetooth permissions are required to scan.");
        return;
      }
    }

    setIsScanning(true);
    setConnectionError(null);
    setScannedDevices(connectedDevice ? [connectedDevice] : []);

    bleManager.startDeviceScan(null, null, async (error, device) => {
      if (error) {
        console.warn('Scan error:', error);
        setConnectionError("Bluetooth error. Check permissions.");
        setIsScanning(false);
        return;
      }
      if (device && device.name) {
        setScannedDevices((prev) => {
          if (!prev.find((d) => d.id === device.id)) {
            return [...prev, device];
          }
          return prev;
        });
      }
    });

    setTimeout(() => {
      bleManager.stopDeviceScan();
      setIsScanning(false);
    }, 10000);
  };

  const connectToDevice = async (device: Device) => {
    try {
      bleManager.stopDeviceScan();
      setIsScanning(false);
      setConnectionError(null);
      console.log(`Attempting to connect to device: ${device.name || device.id}`);
      const connected = await device.connect({ autoConnect: false });
      console.log(`Connected to device: ${connected.name || connected.id}`);

      if (Platform.OS === 'android') {
        try{
          await connected.requestMTU(512); 
          await connected.requestConnectionPriority(ConnectionPriority.High);
        } catch (e) {
          console.warn("Hardware tuning rejected, continuing anyway...");
        }
      }
      await connected.discoverAllServicesAndCharacteristics();
      
      console.log('Sending Never-Sleep override...');
      const sleepBytes = [0x09, 0x01, 0x01];
      const sleepBase64 = Buffer.from(sleepBytes).toString('base64');

      await connected.writeCharacteristicWithResponseForService(
        MYO_CONTROL_SERVICE_UUID, 
        MYO_COMMAND_CHAR_UUID,
        sleepBase64
      );

      // Brief 50ms pause to let the Myo hardware process the override
      await new Promise(resolve => setTimeout(resolve, 50));

      // Send Wake Command (Control Service)
      const commandBytes = [0x01, 0x03, 0x02, 0x00, 0x00];
      const commandBase64 = Buffer.from(commandBytes).toString('base64');

      await connected.writeCharacteristicWithResponseForService(
        MYO_CONTROL_SERVICE_UUID, 
        MYO_COMMAND_CHAR_UUID,
        commandBase64
      );
      
      setConnectedDevice(connected);

      bleManager.onDeviceDisconnected(device.id, (error, disconnectedDevice) => {
        console.log(`Device ${disconnectedDevice?.id} disconnected`);
        if (error) console.error("Unexpected device disconnection: ", error);
        setConnectedDevice(null);
      });
    } catch (e) {
      console.error("Connection failed", e);
      setConnectedDevice(null);
    }
  };

  const disconnect = async (device: Device) => {
    if (device) {
      try {
        console.log(`Disconnecting from device: ${device.name || device.id}`);
        await bleManager.cancelDeviceConnection(device.id);
        console.log(`Disconnected from device: ${device.name || device.id}`);
        
      } catch (e) {
        console.error("Disconnection failed", e);
      } finally {
        setConnectedDevice(null);
      }
    }
  };


  return (
    <BleContext.Provider value={{ connectedDevice, isScanning, scannedDevices, connectionError, startScan, connectToDevice, disconnect }}>
      {children}
    </BleContext.Provider>
  );
};

export const useBle = () => {
  const context = useContext(BleContext);
  if (!context) throw new Error('useBle must be used within a BleProvider');
  return context;
};