import { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import type { Transaction } from '@lifolio/shared-types';
import { Colors } from '@/constants/colors';
import AIInsightCard from '@/components/AIInsightCard';
import BillRow from '@/components/BillRow';
import OverviewCard from '@/components/OverviewCard';

export default function HomeScreen() {
  const [loading, setLoading] = useState(true);
  const [monthlySpend, setMonthlySpend] = useState(0);
  const [budget, setBudget] = useState<number | null>(null);
  const [aiSummary, setAiSummary] = useState('');
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const dashboard = await api.getDashboard();
        setMonthlySpend(dashboard.monthly_spend);
        setBudget(dashboard.monthly_budget ?? null);
        setAiSummary(dashboard.ai_summary);
        setTransactions(dashboard.recent_transactions);
      } catch {
        // fallback to direct Supabase query
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const today = new Date();
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
        const { data } = await supabase
          .from('transactions')
          .select('*, categories(name, name_en)')
          .eq('user_id', user.id)
          .gte('transaction_date', monthStart)
          .order('transaction_date', { ascending: false })
          .limit(8);
        setTransactions(data ?? []);
        setMonthlySpend((data ?? []).reduce((s, t) => s + Number(t.amount), 0));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator color={Colors.brand} style={{ marginTop: 60 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.pageTitle}>首页</Text>
            <Text style={styles.pageDate}>
              {new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' })}
            </Text>
          </View>
          <View style={styles.avatar}>
            <Text style={{ color: '#fff', fontSize: 16 }}>👤</Text>
          </View>
        </View>

        <OverviewCard
          monthlySpend={monthlySpend}
          budget={budget}
          savingsRate={budget ? Math.max(0, (budget - monthlySpend) / budget * 100) : 0}
        />

        {aiSummary ? <AIInsightCard text={aiSummary} /> : null}

        {/* Bill Stream */}
        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>账单流</Text>
            <Pressable><Text style={styles.link}>查看全部</Text></Pressable>
          </View>
          <View style={styles.card}>
            {transactions.map((t, i) => (
              <BillRow key={t.id} transaction={t} isLast={i === transactions.length - 1} />
            ))}
            {transactions.length === 0 && (
              <Text style={styles.empty}>暂无账单记录</Text>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 20, gap: 16, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  pageTitle: { fontSize: 28, fontWeight: '700', color: Colors.text },
  pageDate: { fontSize: 13, color: Colors.textTertiary, marginTop: 2 },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.dark, alignItems: 'center', justifyContent: 'center' },
  section: { gap: 10 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontSize: 15, fontWeight: '600', color: Colors.text },
  link: { fontSize: 13, color: Colors.brand, fontWeight: '600' },
  card: { backgroundColor: Colors.surface, borderRadius: 16, overflow: 'hidden' },
  empty: { padding: 24, textAlign: 'center', color: Colors.textTertiary, fontSize: 13 },
});
