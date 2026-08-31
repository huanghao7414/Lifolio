import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '@/constants/colors';

interface Props {
  text: string;
}

export default function AIInsightCard({ text }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.tag}>
        <Text style={styles.sparkle}>✦</Text>
        <Text style={styles.tagText}>AI 洞察</Text>
      </View>
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.aiBackground,
    borderWidth: 1,
    borderColor: Colors.aiBorder,
    borderRadius: 16,
    padding: 16,
  },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 },
  sparkle: { fontSize: 12, color: Colors.brand },
  tagText: { fontSize: 12, fontWeight: '700', color: Colors.brand },
  text: { fontSize: 14, color: '#374151', lineHeight: 22 },
});
