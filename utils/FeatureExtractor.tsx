
export function ExtractFeatures(windows: number[][]): number[] {
  const mav = GetMAVfeat(windows);
  const zc = GetZCfeat(windows);
  const ssc = GetSSCfeat(windows);
  const wl = GetWLfeat(windows);

  return [...mav, ...zc, ...ssc, ...wl];
}

function GetMAVfeat(windows: number[][]): number[] {
  const numSamples = windows.length;
  const numChannels = windows[0].length;

  let channelSums = new Array(numChannels).fill(0);

  for (let i = 0; i < numSamples; i++) {
    for (let j = 0; j < numChannels; j++) {
      channelSums[j] += Math.abs(windows[i][j]);
    }
  }

  const mav = channelSums.map(sum => sum / numSamples);

  return mav;
}

function GetZCfeat(windows: number[][]): number[] {
  const numSamples = windows.length;
  const numChannels = windows[0].length;
  let zcCounts = new Array(numChannels).fill(0);

  for (let i = 1; i < numSamples; i++) {
    for (let j = 0; j < numChannels; j++) {
      const signCurr = Math.sign(windows[i][j]);
      const signPrev = Math.sign(windows[i - 1][j]);

      const diff = signCurr - signPrev;

      if (diff === 2 || diff === -2) {
        zcCounts[j]++;
      }
    }
  }

  return zcCounts;
}

function GetSSCfeat(windows: number[][], sscThreshold = 0.0): number[] {
  const numSamples = windows.length;
  const numChannels = windows[0].length;
  let sscCounts = new Array(numChannels).fill(0);

  for (let i = 1; i < numSamples - 1; i++) {
    for (let j = 0; j < numChannels; j++) {
      const w0 = windows[i - 1][j];
      const w1 = windows[i][j];
      const w2 = windows[i + 1][j];

      if ((w1 - w0) * (w1 - w2) >= sscThreshold) {
        sscCounts[j]++;
      }
    }
  }

  return sscCounts;
}

function GetWLfeat(windows: number[][]): number[] {
  const numSamples = windows.length;
  const numChannels = windows[0].length;
  let wlfFeatures = new Array(numChannels).fill(0);

  function closure(arr: Float64Array): number {
    let sumAbsD1 = 0;
    let sumAbsD2 = 0;
    const n = arr.length;

    for (let i = 0; i < n - 1; i++) {
      sumAbsD1 += Math.abs(arr[i + 1] - arr[i]);
    }

    for (let i = 0; i < n - 2; i++) {
      const d1Curr = arr[i + 1] - arr[i];
      const d1Next = arr[i + 2] - arr[i + 1];
      sumAbsD2 += Math.abs(d1Next - d1Curr);
    }

    if (sumAbsD2 === 0) sumAbsD2 = Number.EPSILON;

    const wlf = Math.sqrt(sumAbsD1 / sumAbsD2);
    
    return Math.log(Math.abs(wlf) || Number.EPSILON);
  }

  for (let j = 0; j < numChannels; j++) {
    let w = new Float64Array(numSamples);
    let wLogSq = new Float64Array(numSamples);

    for (let i = 0; i < numSamples; i++) {
      const val = windows[i][j];
      w[i] = val;
      wLogSq[i] = Math.log((val * val) + Number.EPSILON);
    }

    const wlf_ebp = closure(w);
    const wlf_efp = closure(wLogSq);

    const num = -2 * wlf_efp * wlf_ebp;
    
    const den = (wlf_efp * wlf_efp) + (wlf_ebp * wlf_ebp);

    wlfFeatures[j] = den === 0 ? 0 : num / den;
  }

  return wlfFeatures;
}