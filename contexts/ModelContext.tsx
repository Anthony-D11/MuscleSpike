import { File, Paths } from 'expo-file-system';
import React, { createContext, useContext, useEffect, useState } from 'react';

interface ModelContextType {
  predictLive: ((input: number[]) => number[]) | null;
  isModelLoaded: boolean;
  checkServerConnection: () => Promise<void>;
  trainAndInstallModel: () => Promise<void>;
}

const ModelContext = createContext<ModelContextType | null>(null);

export const ModelProvider = ({ children }: { children: React.ReactNode }) => {

  const [predictLive, setPredictLive] = useState<((input: number[]) => number[]) | null>(null);
  const [isModelLoaded, setIsModelLoaded] = useState(false);

  // 1. Check for an existing saved model on app boot
  useEffect(() => {
    loadModelFromDisk();
  }, []);

  const loadModelFromDisk = async () => {
    try {
      const modelFile = new File(Paths.document, 'active_model.js');
      
      if (modelFile.exists) {
        // Read the string directly from the phone's storage
        const jsString = await modelFile.text(); 
        
        // --- THE MAGIC TRICK ---
        // We use 'new Function' to compile the string back into executable JavaScript memory
        const compiledFunction = new Function('input', jsString) as (input: number[]) => number[];
        
        setPredictLive(() => compiledFunction);
        setIsModelLoaded(true);
        console.log("Local ML model successfully loaded into memory!");
      }
    } catch (e) {
      console.log("No existing model found or failed to load.", e);
    }
  };

  const checkServerConnection = async () => {
    try {
      // 1. Set up an AbortController to force a timeout after 3 seconds
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const response = await fetch('http://10.0.0.55:5000/ping', {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        signal: controller.signal // 2. Attach the abort signal to the fetch request
      });

      // 3. If we get a response in time, clear the timeout so it doesn't trigger anyway
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        if (data.status === 'success') {
          return true;
        }
      } else {
        console.error("Server reached, but returned an error.");
      }

    } catch (error) {
      // 4. Handle the specific timeout error gracefully
      if (error.name === 'AbortError') {
        console.error("Connection timed out. Server is unreachable.");
      } else {
        console.error("Could not connect to the server. Check your WiFi and IP address. Error:", error.message);
      }
    }
    
    return false;
};

  const trainAndInstallModel = async () => {
    try {
      console.log("Fetching new model from server...");
      
      // Update this to your server's IP
      const response = await fetch('http://10.0.0.55:5000/train', {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        }
      });
      if (!response.ok) throw new Error("Server rejected model download");
      const responseData = await response.json();
      const downloadedJsString = responseData.model;

      // Save it permanently to the device sandbox so it survives app restarts
      const modelFile = new File(Paths.document, 'active_model.js');
      modelFile.create({ overwrite: true });
      modelFile.write(downloadedJsString);

      // Load it immediately into memory
      loadModelFromDisk();
      
    } catch (error) {
      console.error("Failed to install ML model:", error);
    }
  };

  return (
    <ModelContext.Provider value={{ predictLive, isModelLoaded, checkServerConnection, trainAndInstallModel }}>
      {children}
    </ModelContext.Provider>
  );
};

export const useModel = () => {
  const context = useContext(ModelContext);
  if (!context) throw new Error('useModel must be used within a ModelProvider');
  return context;
};