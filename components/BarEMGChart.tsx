import {
  Canvas,
  Group,
  Line,
  Rect,
  Text as SkiaText,
  useFont,
  vec
} from '@shopify/react-native-skia';
import React from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import { useDerivedValue } from 'react-native-reanimated';

const AnimatedBar = ({ index, xPos, barWidth, chartHeight, padTop, maxMav, mavValues, activeChannels }: { index: number, xPos: number, barWidth: number, chartHeight: number, padTop: number, maxMav: number, mavValues: any, activeChannels: boolean[] }) => {
  const animatedHeight = useDerivedValue(() => {
    if (!activeChannels[index]) return 0;
    const value = mavValues.value[index] || 0;
    return value * chartHeight;
  });

  const animatedY = useDerivedValue(() => {
    return (padTop + chartHeight) - animatedHeight.value;
  });

  return (
    <Rect
      x={xPos}
      y={animatedY}
      width={barWidth}
      height={animatedHeight}
      color="#007AFF"
    />
  );
};

// 2. MAIN COMPONENT
export default function BarEMGChart ({ mavValues, activeChannels }: { mavValues: any, activeChannels: boolean[] }) {
  
  const PAD_LEFT = 30;
  const PAD_BOTTOM = 25;
  const PAD_TOP = 60;
  const PAD_RIGHT = 15;

  const { width } = Dimensions.get('window');
  const GRAPH_WIDTH = width - 80;
  const GRAPH_HEIGHT = 250;
  
  const tempArray = Array.from({ length: 8 }, (_, i) => 0);

  const NUM_CHANNELS = 8;
  const BAR_PADDING = 8;
  const numActiveChannels = activeChannels.filter(Boolean).length;
  const barWidth = (GRAPH_WIDTH - (BAR_PADDING * (numActiveChannels - 1))) / numActiveChannels;
  const MAX_MAV = 128; 

  const font = useFont(require('../assets/fonts/Roboto-Regular.ttf'), 12);

  
  if (!font) {
    return null;
  }

  const yLabels = [
    { label: '127', y: PAD_TOP },
    { label: '64', y: PAD_TOP + GRAPH_HEIGHT / 2 },
    { label: '0', y: PAD_TOP + GRAPH_HEIGHT },
  ];

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Canvas style={{ flex: 1 }}>
        
        <Group>
          <Line
            p1={vec(PAD_LEFT, PAD_TOP)}
            p2={vec(PAD_LEFT, PAD_TOP + GRAPH_HEIGHT)}
            color="#94A3B8"
            strokeWidth={1}
          />
          <Line
            p1={vec(PAD_LEFT, PAD_TOP + GRAPH_HEIGHT)}
            p2={vec(PAD_LEFT + GRAPH_WIDTH, PAD_TOP + GRAPH_HEIGHT)}
            color="#94A3B8"
            strokeWidth={1}
          />

          {yLabels.map((val, i) => (
            <SkiaText
              key={`y-label-${i}`}
              x={5}
              y={val.y + 4} 
              text={val.label}
              font={font}
              color="#64748B"
            />
          ))}

          {Array.from({ length: NUM_CHANNELS }).map((_, index) => {
            if (!activeChannels[index]) {
              tempArray[index] = (index === 0 ? 0 : tempArray[index - 1]);
              return null;
            }
            tempArray[index] = (index === 0 ? 0 : tempArray[index - 1]) + 1;

            const xPos = PAD_LEFT + ((tempArray[index] - 1) * (barWidth + BAR_PADDING));
            const labelX = xPos + (barWidth / 2) - 4; 
            
            return (
              <SkiaText
                key={`x-label-${index}`}
                x={labelX}
                y={PAD_TOP + GRAPH_HEIGHT + 15}
                text={`${index + 1}`}
                font={font}
                color="#64748B"
              />
            );
          })}
        </Group>

        <Group>
          {Array.from({ length: NUM_CHANNELS }).map((_, index) => {
            if (!activeChannels[index]) {
              tempArray[index] = (index === 0 ? 0 : tempArray[index - 1]);
              return null;
            }
            tempArray[index] = (index === 0 ? 0 : tempArray[index - 1]) + 1;

            const xPos = PAD_LEFT + ((tempArray[index] - 1) * (barWidth + BAR_PADDING));

            return (
              <AnimatedBar
                key={`animated-bar-${index}`}
                index={index}
                xPos={xPos}
                barWidth={barWidth}
                chartHeight={GRAPH_HEIGHT}
                padTop={PAD_TOP}
                maxMav={MAX_MAV}
                mavValues={mavValues}
                activeChannels={activeChannels}
              />
            );
          })}
        </Group>
      </Canvas>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
});