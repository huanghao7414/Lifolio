import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '@/constants/colors';

interface Props {
  monthlySpend: number;
  budget: number | null;
  savingsRate: number;
}

export default function OverviewCard({ monthlySpend, budget, savingsRate }: Props) {
  const usedPct = budget ? Math.min((monthlySpend / budget) * 100, 100) : 0;

  return (
    <View style={styles.card}>
      <View style={styles.top}>
        <View>
          <Text style={styles.label}>本月净支出</Text>
          {budget && (
            <Text style={styles.hint}>
              预算 ¥{budget.toLocaleString()} · 剩 ¥{(budget - monthlySpend).toLocaleString()}
            </Text>
          )}
        </View>
        <View style={styles.badge}><Text style={styles.badgeText}>本月</Text></View>
      </View>

      <Text style={styles.amount}>
        ¥{monthlySpend.toLocaleString('zh-CN', { minimumFractionDigits: 0 })}
      </Text>

      {budget ? (
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${usedPct}%` }]} />
        </View>
      ) : null}

      <View style={styles.divider} />
      <View style={styles.stats}>
        <View>
          <Text style={styles.statLabel}>本月储蓄率</Text>
          <Text style={styles.statValue}>{Math.round(savingsRate)}%</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#1A1A1A', borderRadius: 20, padding: 20, gap: 12 },
  top: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  label: { fontSize: 13, color: 'rgba(255,255,255,0.5)' },
  hint: { fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 },
  badge: { backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 11, color: 'rgba(255,255,255,0.6)' },
  amount: { fontSize: 40, fontWeight: '700', color: '#fff' },
  progressTrack: { height: 4, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: Colors.brand, borderRadius: 2 },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.08)' },
  stats: { flexDirection: 'row' },
  statLabel: { fontSize: 11, color: 'rgba(255,255,255,0.4)' },
  statValue: { fontSize: 16, fontWeight: '600', color: '#fff', marginTop: 2 },
});
