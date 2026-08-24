import { Canvas, Group, Path, Skia, Text, useFont } from "@shopify/react-native-skia";
import { useWindowDimensions, StyleSheet, View } from "react-native";
import { useDerivedValue } from "react-native-reanimated";


const HEADER_OFFSET = 45;
const DEFAULT_CHART_HEIGHT = 541;
const MIN_CHANNEL_HEIGHT = 18;

const EmgPath = ({ data, writeIndex, xOffset, yOffset, graphWidth, channelHeight }: { data: any, writeIndex: any, xOffset: number, yOffset: number, graphWidth: number, channelHeight: number }) => {
  const path = useDerivedValue(() => {
    const currentPointer = writeIndex.value; 
    
    const skPath = Skia.Path.Make();
    const currentData = data.value;
    const length = currentData.length;

    if (length === 0) return skPath;

    const xStep = graphWidth / (length - 1);
    
    const getY = (val: number) => {
      const normalizedY = (channelHeight / 2) - ((val * channelHeight) / 2);
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

export default function RawEMGChart({ channels, writeIndices, activeChannels, width: fixedWidth, height: fixedHeight }: { channels: any[], writeIndices: any[], activeChannels: boolean[], width?: number, height?: number }) {
  const tempArray = Array.from({ length: 8 }, (_, i) => 0);

  const { width } = useWindowDimensions();
  const GRAPH_WIDTH = (fixedWidth ?? width) - 70;

  const numActiveChannels = activeChannels.filter(Boolean).length || 1;
  const headerOffset = fixedHeight == null ? HEADER_OFFSET : 14;
  const availableHeight = (fixedHeight ?? DEFAULT_CHART_HEIGHT) - headerOffset;
  const slotHeight = availableHeight / numActiveChannels;
  const CHANNEL_HEIGHT = Math.min(50, Math.max(MIN_CHANNEL_HEIGHT, slotHeight * 0.8));

  const font = useFont(require('../assets/fonts/Roboto-Regular.ttf'), 10);
  if (!font) {
    return null; 
  }

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Canvas style={{ flex: 1 }}>
        {channels.map((channelData, index) => {
          if (!activeChannels[index]) {
            tempArray[index] = (index === 0 ? 0 : tempArray[index - 1]);
            return null;
          }
          tempArray[index] = (index === 0 ? 0 : tempArray[index - 1]) + 1;
          // Calculate exactly where on the Y-axis this line should be drawn
          // Margin top + (Index * Slot Height)
          const yOffset = headerOffset + (tempArray[index] - 1) * slotHeight; 
          
          return (
            <Group key={`group-${index}`} >
              <Text
                x={5}
                y={yOffset + CHANNEL_HEIGHT / 2 + 5}
                text={`CH ${index + 1}`}
                color="#64748B"
                font={font}
              />
              <EmgPath 
                key={`path-${index}`} 
                data={channelData} 
                writeIndex={writeIndices[index]}
                xOffset={30}
                yOffset={yOffset} 
                graphWidth={GRAPH_WIDTH}
                channelHeight={CHANNEL_HEIGHT}
              />
            </Group>
          );
        })}
      </Canvas>
    </View>
  );
}