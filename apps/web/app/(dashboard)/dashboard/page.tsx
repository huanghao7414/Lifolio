import { createClient } from '@/lib/supabase/server';
import AIInsightCard from '@/components/ai/AIInsightCard';
import TransactionList from '@/components/transactions/TransactionList';
import OverviewCard from '@/components/dashboard/OverviewCard';

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Fetch dashboard data server-side
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];

  const [transRes, profileRes] = await Promise.all([
    supabase
      .from('transactions')
      .select('*, categories(name, name_en)')
      .eq('user_id', user!.id)
      .gte('transaction_date', monthStart)
      .order('transaction_date', { ascending: false })
      .limit(8),
    supabase.from('user_profiles').select('*').eq('id', user!.id).single(),
  ]);

  const transactions = transRes.data ?? [];
  const profile = profileRes.data;
  const monthlySpend = transactions.reduce((s: number, t: { amount: number }) => s + Number(t.amount), 0);
  const budget = profile?.monthly_budget ? Number(profile.monthly_budget) : null;

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-bold">首页</h1>
        <p className="text-sm text-ink-2 mt-0.5">
          {today.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' })}
        </p>
      </header>

      <OverviewCard
        monthlySpend={monthlySpend}
        budget={budget}
        savingsRate={budget ? Math.max(0, (budget - monthlySpend) / budget * 100) : 0}
      />

      <AIInsightCard
        text={`本月已消费 ¥${monthlySpend.toLocaleString('zh-CN', { minimumFractionDigits: 0 })}${budget ? `，预算剩余 ¥${(budget - monthlySpend).toLocaleString()}` : ''}。`}
      />

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-base">账单流</h2>
          <a href="/transactions" className="btn-ghost text-sm">查看全部</a>
        </div>
        <TransactionList transactions={transactions} />
      </section>
    </div>
  );
}
