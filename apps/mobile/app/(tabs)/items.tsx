import { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { api } from '@/lib/api';
import type { Item } from '@lifolio/shared-types';
import { Colors } from '@/constants/colors';

const REC_BADGE: Record<string, { label: string; bg: string; color: string }> = {
  keep:    { label: '持有', bg: '#DCFCE7', color: '#16A34A' },
  sell:    { label: '出售', bg: '#FEF9C3', color: '#CA8A04' },
  warning: { label: '预警', bg: '#FEE2E2', color: '#DC2626' },
};

function ItemCard({ item }: { item: Item }) {
  const router = useRouter();
  const rec = item.ai_hold_recommendation ? REC_BADGE[item.ai_hold_recommendation] : null;
  const depPct = item.estimated_current_value
    ? Math.round((1 - item.estimated_current_value / item.purchase_price) * 100)
    : 0;

  return (
    <Pressable
      style={styles.itemCard}
      onPress={() => router.push(`/item/${item.id}`)}
    >
      <View style={styles.itemThumb}>
        {item.image_url
          ? <Image source={{ uri: item.image_url }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
          : <Text style={{ fontSize: 32 }}>📦</Text>
        }
      </View>
      <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
      {item.brand && <Text style={styles.itemBrand} numberOfLines={1}>{item.brand}</Text>}
      <View style={styles.itemValueRow}>
        <Text style={styles.itemValue}>
          ¥{(item.estimated_current_value ?? item.purchase_price).toLocaleString()}
        </Text>
        <Text style={styles.itemDep}>-{depPct}%</Text>
      </View>
      {rec && (
        <View style={[styles.recBadge, { backgroundColor: rec.bg }]}>
          <Text style={[styles.recText, { color: rec.color }]}>{rec.label}</Text>
        </View>
      )}
    </Pressable>
  );
}

export default function ItemsScreen() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getItems().then(setItems).finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <SafeAreaView style={styles.container}>
      <ActivityIndicator color={Colors.brand} style={{ marginTop: 60 }} />
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.pageTitle}>物品</Text>
        <Pressable style={styles.addBtn}>
          <Text style={styles.addBtnText}>+ 添加</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
        {items.map(item => <ItemCard key={item.id} item={item} />)}
        {items.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>📦</Text>
            <Text style={styles.emptyText}>暂无物品记录</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const CARD_GAP = 12;
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, paddingBottom: 12 },
  pageTitle: { fontSize: 28, fontWeight: '700', color: Colors.text },
  addBtn: { backgroundColor: Colors.brand, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 },
  addBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', padding: 20 - CARD_GAP / 2, paddingBottom: 40 },
  itemCard: {
    width: '50%',
    padding: CARD_GAP / 2,
  },
  itemThumb: {
    aspectRatio: 1,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    marginBottom: 8,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  itemName: { fontSize: 14, fontWeight: '600', color: Colors.text },
  itemBrand: { fontSize: 12, color: Colors.textTertiary, marginTop: 1 },
  itemValueRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  itemValue: { fontSize: 14, fontWeight: '600', color: Colors.brand },
  itemDep: { fontSize: 11, color: Colors.textTertiary },
  recBadge: { alignSelf: 'flex-start', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2, marginTop: 4 },
  recText: { fontSize: 11, fontWeight: '600' },
  empty: { flex: 1, width: '100%', alignItems: 'center', paddingTop: 80 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 14, color: Colors.textTertiary },
});
