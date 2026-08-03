import { Canvas, Circle, Group, Line, Path, Skia, Text, useFont, vec } from '@shopify/react-native-skia';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useDerivedValue } from 'react-native-reanimated';

const CENTER = 150;
const MAX_RADIUS = 120;
const CHANNELS = 8;
const MAX_EMG_VALUE = 127;

interface RadarAxisProps {
  cx: number;
  cy: number;
  radius: number;
  numChannels?: number;
}

export const RadarAxis = ({ cx, cy, radius, numChannels = 8 }: RadarAxisProps) => {
  const font = useFont(require('../assets/fonts/Roboto-Regular.ttf'), 10);

  const rings = [0.25, 0.5, 0.75, 1.0];
  const angles = Array.from({ length: numChannels }, (_, i) => {
    return (i * 2 * Math.PI) / numChannels - Math.PI / 2;
  });

  if (!font) {
    return null; 
  }

  return (
    <Group>
      {rings.map((ringScale, index) => (
        <Circle
          key={`ring-${index}`}
          cx={cx}
          cy={cy}
          r={radius * ringScale}
          style="stroke"
          strokeWidth={1}
          color="rgba(150, 150, 150, 0.3)"
        />
      ))}

      {angles.map((angle, index) => {
        const x2 = cx + radius * Math.cos(angle);
        const y2 = cy + radius * Math.sin(angle);

        const labelRadius = radius + 15;
        const labelText = `CH ${index + 1}`;
        
        const textWidth = font.measureText(labelText).width;
        const labelX = cx + labelRadius * Math.cos(angle) - (textWidth / 2);
        const labelY = cy + labelRadius * Math.sin(angle) + (font.getSize() / 3);

        return (
          <Group key={`spoke-group-${index}`}>
            <Line
              p1={vec(cx, cy)}
              p2={vec(x2, y2)}
              strokeWidth={1}
              color="rgba(150, 150, 150, 0.3)"
            />
            <Text
              x={labelX}
              y={labelY}
              text={labelText}
              font={font}
              color="#64748B"
            />
          </Group>
        );
      })}
    </Group>
  );
};


export default function RadialEMGChart({ mavValues, activeChannels }: { mavValues: any, activeChannels: boolean[] }) {
  const numActiveChannels = activeChannels.filter(Boolean).length;
  const radarPath = useDerivedValue(() => {
    const path = Skia.Path.Make();
    
    const centerX = 150; 
    const centerY = 200;
    const maxRadius = 200;

    for (let i = 0; i < 8; i++) {
      
      if (!activeChannels[i]) continue;
      const angle = (i * (Math.PI * 2)) / numActiveChannels - Math.PI / 2;
      
      const radius = mavValues.value[i] * maxRadius; 
      
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);

      // Draw the lines
      if (i === 0) {
        path.moveTo(x, y);
      } else {
        path.lineTo(x, y);
      }
    }
    
    path.close();
    return path;
  });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Canvas style={{ flex: 1 }}>
        <RadarAxis cx={150} cy={200} radius={MAX_RADIUS} numChannels={numActiveChannels} />

        <Path 
          path={radarPath} 
          color="rgba(0, 255, 255, 0.5)"
          style="fill" 
        />
        <Path 
          path={radarPath} 
          color="cyan" 
          style="stroke" 
          strokeWidth={3} 
          strokeJoin="round" 
        />
      </Canvas>
    </View>
  );
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1e1e1e',
  },
});