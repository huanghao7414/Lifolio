interface Props {
  monthlySpend: number;
  budget: number | null;
  savingsRate: number;
}

export default function OverviewCard({ monthlySpend, budget, savingsRate }: Props) {
  const usedPct = budget ? Math.min((monthlySpend / budget) * 100, 100) : 0;

  return (
    <div className="card bg-[#1A1A1A] text-white p-6 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-white/50">本月净支出</p>
          {budget && (
            <p className="text-xs text-white/40 mt-0.5">
              预算 ¥{budget.toLocaleString()} · 剩 ¥{(budget - monthlySpend).toLocaleString()}
            </p>
          )}
        </div>
        <span className="text-xs bg-white/10 text-white/60 px-2 py-1 rounded-full">本月</span>
      </div>

      <p className="text-4xl font-bold">¥{monthlySpend.toLocaleString('zh-CN', { minimumFractionDigits: 0 })}</p>

      {budget && (
        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-brand rounded-full transition-all"
            style={{ width: `${usedPct}%` }}
          />
        </div>
      )}

      <div className="flex gap-6 pt-2 border-t border-white/10">
        <div>
          <p className="text-xs text-white/40">本月储蓄率</p>
          <p className="font-semibold mt-0.5">{Math.round(savingsRate)}%</p>
        </div>
      </div>
    </div>
  );
}
