import { Canvas, Group, Path, Skia, Text, useFont } from "@shopify/react-native-skia";
import { Dimensions, StyleSheet, View } from "react-native";
import { useDerivedValue } from "react-native-reanimated";


const { width } = Dimensions.get('window');
const GRAPH_WIDTH = width - 80;
const GRAPH_HEIGHT = 40;

const EmgPath = ({ data, writeIndex, xOffset, yOffset }: { data: any, writeIndex: any, xOffset: number, yOffset: number }) => {
  const path = useDerivedValue(() => {
    const currentPointer = writeIndex.value; 
    
    const skPath = Skia.Path.Make();
    const currentData = data.value;
    const length = currentData.length;

    if (length === 0) return skPath;

    const xStep = GRAPH_WIDTH / (length - 1);
    
    const getY = (val: number) => {
      const normalizedY = (GRAPH_HEIGHT / 2) - ((val * GRAPH_HEIGHT) / 2);
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

export default function RawEMGChart({ channels, writeIndices, activeChannels }: { channels: any[], writeIndices: any[], activeChannels: boolean[] }) {
  const tempArray = Array.from({ length: 8 }, (_, i) => 0);

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
          // Margin top + (Index * (Card Height + Margin Bottom)) + Header Offset
          const yOffset = 9 + (tempArray[index] - 1) * (GRAPH_HEIGHT + 12) + 30; 
          
          return (
            <Group key={`group-${index}`} >
              <Text
                x={5}
                y={yOffset + GRAPH_HEIGHT / 2 + 5}
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
              />
            </Group>
          );
        })}
      </Canvas>
    </View>
  );
}