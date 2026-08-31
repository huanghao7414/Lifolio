import Link from 'next/link';

interface Item {
  id: string;
  name: string;
  brand?: string;
  purchase_price: number;
  estimated_current_value?: number;
  image_url?: string;
  usage_count: number;
  ai_hold_recommendation?: 'keep' | 'sell' | 'warning';
}

const REC_BADGE: Record<string, { label: string; cls: string }> = {
  keep:    { label: '持有', cls: 'bg-green-100 text-green-700' },
  sell:    { label: '出售', cls: 'bg-yellow-100 text-yellow-700' },
  warning: { label: '预警', cls: 'bg-red-100 text-red-600' },
};

function ItemCard({ item }: { item: Item }) {
  const rec = item.ai_hold_recommendation ? REC_BADGE[item.ai_hold_recommendation] : null;
  const depPct = item.estimated_current_value
    ? Math.round((1 - item.estimated_current_value / item.purchase_price) * 100)
    : 0;

  return (
    <Link href={`/items/${item.id}`} className="card hover:shadow-md transition-shadow block">
      <div className="aspect-square rounded-xl bg-surface flex items-center justify-center text-4xl mb-3 overflow-hidden">
        {item.image_url
          ? <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
          : '📦'}
      </div>
      <p className="font-semibold text-sm truncate">{item.name}</p>
      {item.brand && <p className="text-xs text-gray-400 truncate">{item.brand}</p>}
      <div className="flex items-center justify-between mt-2">
        <span className="text-sm font-medium text-brand">
          ¥{(item.estimated_current_value ?? item.purchase_price).toLocaleString()}
        </span>
        <span className="text-xs text-gray-400">-{depPct}%</span>
      </div>
      {rec && (
        <span className={`inline-block mt-2 text-xs font-medium px-2 py-0.5 rounded-full ${rec.cls}`}>
          {rec.label}
        </span>
      )}
    </Link>
  );
}

export default function ItemGrid({ items }: { items: Item[] }) {
  if (!items.length) {
    return (
      <div className="card text-center py-12 text-sm text-gray-400">
        <p className="text-3xl mb-2">📦</p>
        暂无物品记录
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
      {items.map(item => <ItemCard key={item.id} item={item} />)}
    </div>
  );
}
