import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '@/constants/colors';

const CATEGORY_ICONS: Record<string, string> = {
  餐饮: '🍜', 通勤: '🚇', 购物: '🛍', 娱乐: '🎮', 医疗: '💊', 教育: '📚', 其他: '📌',
};

interface Transaction {
  id: string;
  amount: number;
  description?: string;
  transaction_date: string;
  ai_flagged?: boolean;
  categories?: { name: string } | null;
}

interface Props {
  transaction: Transaction;
  isLast?: boolean;
}

export default function BillRow({ transaction: t, isLast }: Props) {
  const catName = t.categories?.name ?? '其他';
  return (
    <View style={[styles.row, !isLast && styles.rowBorder]}>
      <View style={styles.icon}>
        <Text style={styles.iconText}>{CATEGORY_ICONS[catName] ?? '📌'}</Text>
      </View>
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>{t.description || catName}</Text>
        <Text style={styles.meta}>{t.transaction_date} · {catName}</Text>
      </View>
      <View style={styles.right}>
        <Text style={styles.amount}>-¥{Number(t.amount).toLocaleString()}</Text>
        {t.ai_flagged && <Text style={styles.flag}>⚠ AI 标注</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.divider },
  icon: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center' },
  iconText: { fontSize: 18 },
  info: { flex: 1 },
  name: { fontSize: 14, fontWeight: '500', color: Colors.text },
  meta: { fontSize: 12, color: Colors.textTertiary, marginTop: 1 },
  right: { alignItems: 'flex-end' },
  amount: { fontSize: 14, fontWeight: '600', color: Colors.text },
  flag: { fontSize: 11, color: Colors.brand, marginTop: 2 },
});
