import { apiCall } from '@/api/base';
import { File, Paths } from 'expo-file-system';
import React, { createContext, useContext, useEffect, useState } from 'react';

interface ServerContextType {
  liveModel: ((input: number[]) => number[]) | null;
  isModelLoaded: boolean;
  isServerReachable: boolean;
  checkServerConnection: () => Promise<void>;
  uploadEMGData: () => Promise<void>;
  trainAndInstallModel: () => Promise<void>;
}

const ServerContext = createContext<ServerContextType | null>(null);

export const ServerProvider = ({ children }: { children: React.ReactNode }) => {

  const [liveModel, setLiveModel] = useState<((input: number[]) => number[]) | null>(null);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [isServerReachable, setIsServerReachable] = useState(false);

  //const baseServerUrl = "https://musclespikeserver.onrender.com";
  const baseServerUrl = "http://10.0.0.35:5000";

  useEffect(() => {
    loadModelFromDisk();
  }, []);

  const loadModelFromDisk = async () => {
    try {
      const modelFile = new File(Paths.document, 'local_model.js');
      
      if (modelFile.exists) {
        const jsString = await modelFile.text(); 
        
        const compiledFunction = new Function('input', jsString) as (input: number[]) => number[];
        
        setLiveModel(() => compiledFunction);
        setIsModelLoaded(true);
        console.log("Local ML model successfully loaded into memory!");
      }
    } catch (e) {
      console.log("No existing model found or failed to load.", e);
    }
  };

  const checkServerConnection = async () => {
    const response = await apiCall<null>(baseServerUrl + "/ping", {method: "GET"});
    if (!response.error && response.status === 200) {
      setIsServerReachable(true);
    }
    else {
      setIsServerReachable(false);
      console.error(response.error);
    }
  };

  const uploadEMGData = async () => {
    try {
      console.log("Uploading EMG data to server...");
      const internalDir = Paths.document;
      const contents = internalDir.list();
      
      const formData = new FormData();
      let fileCount = 0;
      for (const item of contents) {
        if (item.name && item.name.endsWith('_emg.csv')) {
          
          formData.append('files', {
            uri: item.uri,
            name: item.name,
            type: 'text/csv',
          } as any);
          
          fileCount++;
        }
      }

      if (fileCount === 0) {
        throw new Error("No EMG data files found");
      }

      const response = await apiCall<{files: string[]; count: number}>(baseServerUrl + "/upload", {
        method: "POST",
        body: formData,
        timeoutMs: 15000,
      });
      if (response.error || !response.data) {
        throw new Error(response.error);
      }
    } catch (error) {
      console.error("Error uploading EMG data: ", error);
      throw error;
    }
  };

  const trainAndInstallModel = async () => {
    try {
      console.log("Fetching new model from server...");
      
      const response = await apiCall<{ model: string }>(baseServerUrl + "/train", {
        method: "GET",
        timeoutMs: 30000,
      });
      if (response.error || !response.data) {
        throw new Error(response.error);
      }
      const modelInJS = response.data.model;
      const modelFile = new File(Paths.document, 'local_model.js');
      modelFile.create({ overwrite: true });
      modelFile.write(modelInJS);

      loadModelFromDisk();
      
    } catch (error) {
      console.error("Error training and installing model locally:", error);
      throw error;
    }
  };


  return (
    <ServerContext.Provider value={{ liveModel, isModelLoaded, isServerReachable, checkServerConnection, uploadEMGData, trainAndInstallModel }}>
      {children}
    </ServerContext.Provider>
  );
};

export const useModel = () => {
  const context = useContext(ServerContext);
  if (!context) throw new Error('useModel must be used within a ServerProvider');
  return context;
};