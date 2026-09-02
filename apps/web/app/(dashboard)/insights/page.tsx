'use client';

import { useEffect, useState } from 'react';
import { getAPIClient } from '@/lib/api';
import type { InsightReport, ValueScore } from '@lifolio/shared-types';
import AIInsightCard from '@/components/ai/AIInsightCard';
import AssetTimeline from '@/components/charts/AssetTimeline';

export default function InsightsPage() {
  const [report, setReport] = useState<InsightReport | null>(null);
  const [score, setScore] = useState<ValueScore | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'current_month' | 'last_month'>('current_month');

  useEffect(() => {
    const api = getAPIClient();
    setLoading(true);
    Promise.all([api.getInsightReport(period), api.getValueScore()])
      .then(([r, s]) => { setReport(r); setScore(s); })
      .finally(() => setLoading(false));
  }, [period]);

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center h-64">
        <div className="ai-tag animate-pulse">✦ AI 正在分析中...</div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">价值</h1>
        <div className="flex gap-2">
          {(['current_month', 'last_month'] as const).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`text-sm px-3 py-1.5 rounded-xl font-medium transition-colors ${
                period === p ? 'bg-accent-strong text-white' : 'text-ink-2 hover:bg-surface'
              }`}
            >
              {p === 'current_month' ? '本月' : '上月'}
            </button>
          ))}
        </div>
      </div>

      {/* Value Score */}
      {score && (
        <div className="card text-center py-6">
          <p className="text-sm text-ink-2 mb-2">生活价值评分</p>
          <p className="text-6xl font-bold text-accent">{Math.round(score.score)}</p>
          <p className="text-xs text-ink-2 mt-1">满分 100 分</p>
          <div className="grid grid-cols-4 gap-3 mt-4 pt-4 border-t border-gray-100">
            {Object.entries(score.breakdown).map(([key, val]) => (
              <div key={key} className="text-center">
                <p className="text-xs text-ink-2">{
                  { savings_rate: '储蓄', spend_diversity: '多样性', asset_utilization: '利用率', budget_adherence: '预算' }[key]
                }</p>
                <p className="font-semibold text-sm">{Math.round(val as number)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI Report */}
      {report && (
        <>
          <AIInsightCard text={report.summary} />

          <section>
            <h2 className="font-semibold mb-3">消费分类</h2>
            <div className="card space-y-3">
              {report.categories_breakdown.map(cat => (
                <div key={cat.category} className="flex items-center gap-3">
                  <span className="text-sm w-10 text-ink-2">{cat.category}</span>
                  <div className="flex-1 bg-surface rounded-full h-2">
                    <div
                      className="h-2 rounded-full bg-accent"
                      style={{ width: `${cat.percentage}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium w-20 text-right">
                    ¥{cat.amount.toLocaleString()} <span className="text-ink-2">({cat.percentage.toFixed(0)}%)</span>
                  </span>
                </div>
              ))}
            </div>
          </section>

          {score?.suggestions?.length > 0 && (
            <section>
              <h2 className="font-semibold mb-3">AI 建议</h2>
              <ul className="space-y-2">
                {score.suggestions.map((s, i) => (
                  <li key={i} className="ai-card text-sm">✦ {s}</li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
