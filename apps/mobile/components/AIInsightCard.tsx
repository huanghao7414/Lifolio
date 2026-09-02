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
    borderRadius: 12,
    padding: 14,
  },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 7 },
  sparkle: { fontSize: 12, color: Colors.brandText },
  tagText: { fontSize: 11, fontWeight: '600', color: Colors.brandText },
  text: { fontSize: 12, color: Colors.aiInk, lineHeight: 18 },
});
