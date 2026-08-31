'use client';

import { useEffect, useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { getAPIClient } from '@/lib/api';

interface Props {
  purchasePrice: number;
  purchaseDate: string;
  category: string;
  itemId?: string;
}

export default function DepreciationChart({ purchasePrice, purchaseDate, category, itemId }: Props) {
  const [data, setData] = useState<{ date: string; value: number }[]>([]);

  useEffect(() => {
    if (!itemId) {
      // Build a simple client-side curve if no itemId
      const points: { date: string; value: number }[] = [];
      const rates: Record<string, number> = {
        electronics: 0.30, clothing: 0.40, furniture: 0.15, vehicle: 0.20,
        appliance: 0.20, other: 0.25,
      };
      const rate = rates[category] ?? 0.25;
      const start = new Date(purchaseDate);
      for (let m = 0; m <= 36; m++) {
        const d = new Date(start);
        d.setMonth(d.getMonth() + m);
        const days = (d.getTime() - start.getTime()) / 86400000;
        const daily = 1 - (1 - rate) ** (1 / 365);
        const value = Math.max(purchasePrice * (1 - daily) ** days, purchasePrice * 0.05);
        points.push({ date: d.toISOString().split('T')[0], value: Math.round(value) });
      }
      setData(points);
      return;
    }
    getAPIClient().getItemDepreciation(itemId).then(dep => setData(dep.timeline));
  }, [itemId, purchasePrice, purchaseDate, category]);

  const today = new Date().toISOString().split('T')[0];

  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="depGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#FF4500" stopOpacity={0.2} />
            <stop offset="95%" stopColor="#FF4500" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="date"
          tick={{ fontSize: 10, fill: '#9CA3AF' }}
          tickFormatter={d => d.slice(0, 7)}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fontSize: 10, fill: '#9CA3AF' }}
          tickFormatter={v => `¥${(v / 1000).toFixed(0)}k`}
          tickLine={false}
          axisLine={false}
          width={48}
        />
        <Tooltip
          formatter={(v: number) => [`¥${v.toLocaleString()}`, '估值']}
          labelFormatter={l => `日期: ${l}`}
          contentStyle={{ fontSize: 12, borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
        />
        <ReferenceLine x={today} stroke="#FF4500" strokeDasharray="4 2" strokeWidth={1.5} label={{ value: '今天', fill: '#FF4500', fontSize: 10 }} />
        <Area
          type="monotone"
          dataKey="value"
          stroke="#FF4500"
          strokeWidth={2}
          fill="url(#depGrad)"
          dot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
