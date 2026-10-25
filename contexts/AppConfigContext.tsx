import { GESTURE_MOTIONS } from '@/constants/app-config';
import React, { createContext, useContext, useState } from 'react';
interface AppConfigType {
  trainingAlgorithm: string;
  setTrainingAlgorithm: (trainingAlgorithm: string) => void;
  featureGroup: string;
  setFeatureGroup: (featureGroup: string) => void;
  numSets: number;
  setNumSets: (numSets: number) => void;
  trainingMotions: string[];
  setTrainingMotions: (trainingMotions: string[]) => void;
  repDuration: number;
  setRepDuration: (repDuration: number) => void;
  samplingFrequency: number;
  setSamplingFrequency: (samplingFrequency: number) => void;
}

const AppConfigContext = createContext<AppConfigType | null>(null);

export const AppConfigProvider = ({ children }: { children: React.ReactNode }) => {

  const [trainingAlgorithm, setTrainingAlgorithm] = useState<string>("LDA");
  const [featureGroup, setFeatureGroup] = useState<string>("HTD");
  const [numSets, setNumSets] = useState<number>(3);
  const [trainingMotions, setTrainingMotions] = useState<string[]>(GESTURE_MOTIONS.map((motion)=>motion.label));
  const [repDuration, setRepDuration] = useState<number>(5);
  const [samplingFrequency, setSamplingFrequency] = useState<number>(200);
  
  return (
    <AppConfigContext.Provider value={{ trainingAlgorithm, setTrainingAlgorithm, featureGroup, setFeatureGroup, numSets, setNumSets, trainingMotions, setTrainingMotions, repDuration, setRepDuration, samplingFrequency, setSamplingFrequency }}>
      {children}
    </AppConfigContext.Provider>
  );
};

export const useAppConfig = () => {
  const context = useContext(AppConfigContext);
  if (!context) throw new Error('useAppConfig must be used within a AppConfigProvider');
  return context;
};