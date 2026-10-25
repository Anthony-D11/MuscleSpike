import type { ImageSourcePropType } from "react-native";

export const GESTURE_MOTIONS: {label: string, image: ImageSourcePropType}[] = [
  {label: "No Movement", image: require("../assets/images/no_movement.png")},
  {label: "Hand Open", image: require("../assets/images/hand_open.png")},
  {label: "Hand Close", image: require("../assets/images/hand_close.png")},
  {label: "Wrist Extension", image: require("../assets/images/wrist_extension.png")},
  {label: "Wrist Flexion", image: require("../assets/images/wrist_flexion.png")},
];

export const ALGORITHM_OPTIONS = [
  { value: "LDA", label: "LDA (Linear Discriminant Analysis)" },
  { value: "KNN", label: "KNN (K-Nearest Neighbour)" },
  { value: "SVM", label: "SVM (Support Vector Machines)" },
  { value: "MLP", label: "MLP (Artificial Neural Networks)" },
  { value: "RF", label: "RF (Random Forest)" },
  { value: "QDA", label: "QDA (Quadratic Discriminant Analysis)" },
  { value: "NB", label: "NB (Gaussian Naive Bayes)" },
  { value: "GB", label: "GB (Gradient Boosting)" },
];

export const FEATURE_OPTIONS = [
  { value: "HTD", label: "Hudgin's Time Domain (MAV, ZC, SSC, WL)" },
  { value: "TDAR", label: "Time Domain Autoregressive (MAV, ZC, SSC, WL, AR4)" },
  { value: "LS4", label: "Low Sampling Frequency 4 (LS, MFL, MSR, WAMP)" },
  { value: "LS9", label: "Low Sampling Frequency 9 (TD4, ZC, RMS, IAV, DASDV, VAR)" },
  { value: "TSTD", label: "Topologically Selected Time Domain (MAVFD, DASDV, WAMP, ZC, MFL, SAMPEN, TDPSD)" },
  { value: "TDPSD", label: "Time Domain Power Spectral Descriptors (M0, M2, M4, SPARSI, IRF, WLF)" },
  { value: "COMB", label: "Combined (WL, SSC, LD, AR9)" },
  { value: "DFTR", label: "Discrete Fourier Transform Representation (DFTR)" },
  { value: "ITD", label: "Inverse Time Domain (ISD, COR, MDIFF, MLK)" },
  { value: "HJORTH", label: "Hjorth Parameters (ACT, MOB, COMP)" },
  { value: "MSWT", label: "MultiSignal Wavelet Transform-Based Features (WENG, WV, WWL, WENT)" },
];