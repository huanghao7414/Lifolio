const CATEGORY_ICONS: Record<string, string> = {
  餐饮: '🍜', 通勤: '🚇', 购物: '🛍', 娱乐: '🎮', 医疗: '💊', 教育: '📚', 其他: '📌',
};

interface Transaction {
  id: string;
  amount: number;
  description?: string;
  transaction_date: string;
  ai_flagged?: boolean;
  ai_flag_reason?: string;
  categories?: { name: string; name_en: string } | null;
}

export default function TransactionList({ transactions }: { transactions: Transaction[] }) {
  if (!transactions.length) {
    return <div className="card text-center py-8 text-sm text-gray-400">暂无账单记录</div>;
  }

  return (
    <div className="card divide-y divide-gray-50">
      {transactions.map(t => {
        const catName = t.categories?.name ?? '其他';
        return (
          <div key={t.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
            <div className="w-9 h-9 rounded-xl bg-surface flex items-center justify-center text-lg shrink-0">
              {CATEGORY_ICONS[catName] ?? '📌'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{t.description || catName}</p>
              <p className="text-xs text-gray-400">{t.transaction_date} · {catName}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-sm font-semibold">-¥{Number(t.amount).toLocaleString()}</p>
              {t.ai_flagged && (
                <p className="text-xs text-brand mt-0.5">⚠ AI 标注</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
