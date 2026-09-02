import { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { api } from '@/lib/api';
import type { Item, DepreciationData } from '@lifolio/shared-types';
import { Colors } from '@/constants/colors';
import AIInsightCard from '@/components/AIInsightCard';

const REC_LABEL: Record<string, string> = { keep: '✅ 继续持有', sell: '💰 建议出售', warning: '⚠️ 闲置预警' };

export default function ItemDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [item, setItem] = useState<Item | null>(null);
  const [dep, setDep] = useState<DepreciationData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    Promise.all([api.getItem(id), api.getItemDepreciation(id)])
      .then(([i, d]) => { setItem(i); setDep(d); })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color={Colors.brand} />
    </View>
  );
  if (!item) return null;

  const purchaseDate = new Date(item.purchase_date);
  const daysHeld = Math.floor((Date.now() - purchaseDate.getTime()) / 86400000);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {/* Hero */}
      <View style={styles.hero}>
        {item.image_url
          ? <Image source={{ uri: item.image_url }} style={styles.heroImage} resizeMode="cover" />
          : <View style={styles.heroPlaceholder}><Text style={{ fontSize: 56 }}>📦</Text></View>
        }
        <Text style={styles.itemName}>{item.name}</Text>
        {item.brand && <Text style={styles.itemBrand}>{item.brand} {item.model}</Text>}
        <Text style={styles.itemMeta}>购入 {purchaseDate.toLocaleDateString('zh-CN')} · 持有 {daysHeld} 天</Text>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>购入价</Text>
          <Text style={styles.statValue}>¥{item.purchase_price.toLocaleString()}</Text>
        </View>
        <View style={[styles.statCard, { flex: 1.2 }]}>
          <Text style={styles.statLabel}>当前估值</Text>
          <Text style={[styles.statValue, { color: Colors.brandText }]}>
            ¥{(item.estimated_current_value ?? item.purchase_price).toLocaleString()}
          </Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>使用次数</Text>
          <Text style={styles.statValue}>{item.usage_count}</Text>
        </View>
      </View>

      {dep && dep.cost_per_use != null && (
        <Text style={styles.costPerUse}>每次使用成本约 ¥{dep.cost_per_use.toFixed(1)}</Text>
      )}

      {item.ai_hold_recommendation && (
        <AIInsightCard text={`AI 持有建议：${REC_LABEL[item.ai_hold_recommendation] ?? item.ai_hold_recommendation}`} />
      )}

      {/* Depreciation info (text-based since we skip native chart for simplicity) */}
      {dep && (
        <View style={styles.depCard}>
          <Text style={styles.depTitle}>折旧信息</Text>
          <Text style={styles.depStat}>已折旧: {dep.depreciation_percentage.toFixed(1)}%</Text>
          <Text style={styles.depReason}>{dep.hold_reason}</Text>
        </View>
      )}

      {/* Log Usage Button */}
      <Pressable
        style={styles.logBtn}
        onPress={() => api.logItemUsage(item.id, { duration_hours: 1 })}
      >
        <Text style={styles.logBtnText}>+ 记录使用</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 20, gap: 16, paddingBottom: 40 },
  hero: { alignItems: 'center', gap: 6 },
  heroImage: { width: '100%', aspectRatio: 1.5, borderRadius: 20, marginBottom: 8 },
  heroPlaceholder: { width: '100%', aspectRatio: 1.5, borderRadius: 20, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  itemName: { fontSize: 22, fontWeight: '700', color: Colors.text, textAlign: 'center' },
  itemBrand: { fontSize: 14, color: Colors.textTertiary },
  itemMeta: { fontSize: 12, color: Colors.textTertiary },
  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: { flex: 1, backgroundColor: Colors.surface, borderRadius: 16, padding: 14, alignItems: 'center' },
  statLabel: { fontSize: 11, color: Colors.textTertiary },
  statValue: { fontSize: 16, fontWeight: '700', color: Colors.text, marginTop: 4 },
  costPerUse: { textAlign: 'center', fontSize: 13, color: Colors.textSecondary },
  depCard: { backgroundColor: Colors.surface, borderRadius: 16, padding: 16, gap: 4 },
  depTitle: { fontSize: 14, fontWeight: '600', color: Colors.text },
  depStat: { fontSize: 13, color: Colors.textSecondary },
  depReason: { fontSize: 13, color: Colors.textTertiary, lineHeight: 20 },
  logBtn: { backgroundColor: Colors.brand, borderRadius: 16, padding: 16, alignItems: 'center' },
  logBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
