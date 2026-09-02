import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import DepreciationChart from '@/components/charts/DepreciationChart';
import AIInsightCard from '@/components/ai/AIInsightCard';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ItemDetailPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: item } = await supabase
    .from('items')
    .select('*')
    .eq('id', id)
    .eq('user_id', user!.id)
    .single();

  if (!item) notFound();

  const purchaseDate = new Date(item.purchase_date);
  const daysHeld = Math.floor((Date.now() - purchaseDate.getTime()) / 86400000);
  const costPerUse = item.usage_count > 0
    ? ((item.estimated_current_value ?? item.purchase_price) / item.usage_count).toFixed(2)
    : null;

  const recLabel: Record<string, string> = { keep: '✅ 继续持有', sell: '💰 建议出售', warning: '⚠️ 闲置预警' };

  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto space-y-6">
      <div className="flex items-start gap-4">
        {item.image_url ? (
          <img src={item.image_url} alt={item.name} className="w-20 h-20 rounded-2xl object-cover" />
        ) : (
          <div className="w-20 h-20 rounded-2xl bg-surface flex items-center justify-center text-3xl">📦</div>
        )}
        <div>
          <h1 className="text-xl font-bold">{item.name}</h1>
          {item.brand && <p className="text-sm text-ink-2">{item.brand} {item.model}</p>}
          <p className="text-sm text-ink-2 mt-1">购入 {purchaseDate.toLocaleDateString('zh-CN')} · 持有 {daysHeld} 天</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="card text-center">
          <p className="text-xs text-ink-2 mb-1">购入价</p>
          <p className="font-bold text-lg">¥{Number(item.purchase_price).toLocaleString()}</p>
        </div>
        <div className="card text-center">
          <p className="text-xs text-ink-2 mb-1">当前估值</p>
          <p className="font-bold text-lg text-accent-text">
            ¥{Number(item.estimated_current_value ?? item.purchase_price).toLocaleString()}
          </p>
        </div>
        <div className="card text-center">
          <p className="text-xs text-ink-2 mb-1">使用次数</p>
          <p className="font-bold text-lg">{item.usage_count}</p>
        </div>
      </div>

      {costPerUse && (
        <p className="text-sm text-ink-2 text-center">每次使用成本约 ¥{costPerUse}</p>
      )}

      {item.ai_hold_recommendation && (
        <AIInsightCard
          text={`AI 持有建议：${recLabel[item.ai_hold_recommendation] ?? item.ai_hold_recommendation}`}
        />
      )}

      <section>
        <h2 className="font-semibold mb-3">折旧曲线</h2>
        <div className="card">
          <DepreciationChart
            purchasePrice={item.purchase_price}
            purchaseDate={item.purchase_date}
            category={item.category}
          />
        </div>
      </section>
    </div>
  );
}
