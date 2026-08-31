import { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '@/lib/api';
import type { InsightReport, ValueScore } from '@lifolio/shared-types';
import { Colors } from '@/constants/colors';
import AIInsightCard from '@/components/AIInsightCard';

export default function InsightsScreen() {
  const [report, setReport] = useState<InsightReport | null>(null);
  const [score, setScore] = useState<ValueScore | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'current_month' | 'last_month'>('current_month');

  useEffect(() => {
    setLoading(true);
    Promise.all([api.getInsightReport(period), api.getValueScore()])
      .then(([r, s]) => { setReport(r); setScore(s); })
      .finally(() => setLoading(false));
  }, [period]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.pageTitle}>价值</Text>
        <View style={styles.periodSwitch}>
          {(['current_month', 'last_month'] as const).map(p => (
            <Pressable
              key={p}
              style={[styles.periodBtn, period === p && styles.periodBtnActive]}
              onPress={() => setPeriod(p)}
            >
              <Text style={[styles.periodLabel, period === p && { color: '#fff' }]}>
                {p === 'current_month' ? '本月' : '上月'}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color={Colors.brand} style={{ marginTop: 60 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Score */}
          {score && (
            <View style={[styles.card, styles.scoreCard]}>
              <Text style={styles.scoreLabel}>生活价值评分</Text>
              <Text style={styles.scoreValue}>{Math.round(score.score)}</Text>
              <Text style={styles.scoreMax}>/ 100</Text>
              <View style={styles.scoreGrid}>
                {Object.entries(score.breakdown).map(([k, v]) => (
                  <View key={k} style={styles.scoreItem}>
                    <Text style={styles.scoreItemLabel}>
                      {{ savings_rate: '储蓄', spend_diversity: '多样性', asset_utilization: '利用率', budget_adherence: '预算' }[k]}
                    </Text>
                    <Text style={styles.scoreItemValue}>{Math.round(v as number)}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {report && (
            <>
              <AIInsightCard text={report.summary} />

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>消费分类</Text>
                <View style={styles.card}>
                  {report.categories_breakdown.map(cat => (
                    <View key={cat.category} style={styles.catRow}>
                      <Text style={styles.catName}>{cat.category}</Text>
                      <View style={styles.catBar}>
                        <View style={[styles.catFill, { width: `${cat.percentage}%` }]} />
                      </View>
                      <Text style={styles.catAmount}>¥{cat.amount.toLocaleString()}</Text>
                    </View>
                  ))}
                </View>
              </View>

              {(score?.suggestions?.length ?? 0) > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>AI 建议</Text>
                  {score!.suggestions.map((s, i) => (
                    <AIInsightCard key={i} text={s} />
                  ))}
                </View>
              )}
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, paddingBottom: 12 },
  pageTitle: { fontSize: 28, fontWeight: '700', color: Colors.text },
  periodSwitch: { flexDirection: 'row', backgroundColor: Colors.surface, borderRadius: 20, padding: 2 },
  periodBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 18 },
  periodBtnActive: { backgroundColor: Colors.brand },
  periodLabel: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  content: { padding: 20, gap: 16, paddingBottom: 40 },
  card: { backgroundColor: Colors.surface, borderRadius: 16, padding: 16 },
  scoreCard: { alignItems: 'center', paddingVertical: 24 },
  scoreLabel: { fontSize: 13, color: Colors.textTertiary },
  scoreValue: { fontSize: 72, fontWeight: '700', color: Colors.brand, lineHeight: 80 },
  scoreMax: { fontSize: 14, color: Colors.textTertiary, marginTop: -4 },
  scoreGrid: { flexDirection: 'row', marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: Colors.divider, width: '100%', justifyContent: 'space-around' },
  scoreItem: { alignItems: 'center' },
  scoreItemLabel: { fontSize: 11, color: Colors.textTertiary },
  scoreItemValue: { fontSize: 16, fontWeight: '600', color: Colors.text, marginTop: 2 },
  section: { gap: 10 },
  sectionTitle: { fontSize: 15, fontWeight: '600', color: Colors.text },
  catRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  catName: { width: 40, fontSize: 12, color: Colors.textSecondary },
  catBar: { flex: 1, height: 6, backgroundColor: Colors.background, borderRadius: 3, overflow: 'hidden' },
  catFill: { height: '100%', backgroundColor: Colors.brand, borderRadius: 3 },
  catAmount: { width: 72, fontSize: 12, fontWeight: '500', textAlign: 'right', color: Colors.text },
});
