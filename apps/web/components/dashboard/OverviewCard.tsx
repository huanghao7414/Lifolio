interface Props {
  monthlySpend: number;
  budget: number | null;
  savingsRate: number;
}

export default function OverviewCard({ monthlySpend, budget, savingsRate }: Props) {
  const usedPct = budget ? Math.min((monthlySpend / budget) * 100, 100) : 0;
  const overBudget = budget ? monthlySpend > budget : false;

  return (
    <div className="bg-ai-surface text-ai-text rounded-card shadow-2 p-6 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-caption text-ai-sub">本月净支出</p>
          {budget && (
            <p className="text-micro text-ai-sub mt-0.5 tnum">
              预算 ¥{budget.toLocaleString()} · 剩 ¥{(budget - monthlySpend).toLocaleString()}
            </p>
          )}
        </div>
        <span className="text-micro bg-white/10 text-ai-sub px-2 py-1 rounded-full">本月</span>
      </div>

      <p className="text-display font-extrabold tnum">
        ¥{monthlySpend.toLocaleString('zh-CN', { minimumFractionDigits: 0 })}
      </p>

      {budget && (
        <div className="progress" role="progressbar" aria-valuenow={Math.round(usedPct)}
             aria-valuemin={0} aria-valuemax={100} aria-label="本月预算使用进度">
          <span
            className={overBudget ? '!bg-danger' : ''}
            style={{ width: `${usedPct}%` }}
          />
        </div>
      )}

      <div className="flex gap-6 pt-2 border-t border-white/10">
        <div>
          <p className="text-caption text-ai-sub">本月储蓄率</p>
          <p className="text-h3 font-semibold mt-0.5 tnum">{Math.round(savingsRate)}%</p>
        </div>
      </div>
    </div>
  );
}
