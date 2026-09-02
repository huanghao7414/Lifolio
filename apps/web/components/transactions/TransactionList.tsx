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
    return (
      <div className="card text-center py-8">
        <p className="text-h3">暂无账单记录</p>
        <p className="text-caption text-ink-2 mt-1">说一句话或拍张小票，AI 帮你记下第一笔</p>
      </div>
    );
  }

  return (
    <div className="card-tight">
      {transactions.map(t => {
        const catName = t.categories?.name ?? '其他';
        return (
          <div key={t.id} className="list-row">
            <div className="w-9 h-9 rounded-md bg-canvas flex items-center justify-center text-lg shrink-0"
                 aria-hidden="true">
              {CATEGORY_ICONS[catName] ?? '📌'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-body font-medium truncate">{t.description || catName}</p>
              <p className="text-caption text-ink-2 tnum">{t.transaction_date} · {catName}</p>
            </div>
            <div className="text-right shrink-0">
              {/* 支出用中性深色，不用红色制造焦虑 */}
              <p className="text-body font-semibold tnum">-¥{Number(t.amount).toLocaleString()}</p>
              {t.ai_flagged && (
                /* 异常三重编码：图标 + 文字 + 颜色，不靠颜色单通道 */
                <span className="badge-danger mt-0.5" title={t.ai_flag_reason}>
                  ⚠ AI 标注
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
