'use client';

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface Props {
  data: { date: string; value: number }[];
}

export default function AssetTimeline({ data }: Props) {
  return (
    <div className="card">
      <p className="text-sm font-semibold mb-3">资产时间线</p>
      <ResponsiveContainer width="100%" height={160}>
        <AreaChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="assetGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#FF4500" stopOpacity={0.15} />
              <stop offset="95%" stopColor="#FF4500" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9CA3AF' }} tickFormatter={d => d.slice(5)} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 10, fill: '#9CA3AF' }} tickFormatter={v => `¥${(v / 1000).toFixed(0)}k`} tickLine={false} axisLine={false} width={44} />
          <Tooltip formatter={(v: number) => [`¥${v.toLocaleString()}`, '净资产']} contentStyle={{ fontSize: 12, borderRadius: 12, border: 'none' }} />
          <Area type="monotone" dataKey="value" stroke="#FF4500" strokeWidth={2} fill="url(#assetGrad)" dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
