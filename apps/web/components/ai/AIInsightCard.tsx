interface Props {
  text: string;
  /** AI 结论必须附可执行下一步 —— 设计系统硬约束 */
  action?: { label: string; onClick: () => void };
  className?: string;
}

export default function AIInsightCard({ text, action, className = '' }: Props) {
  return (
    <div className={`ai-card ${className}`}>
      <div className="ai-tag mb-2">
        <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <path d="M7 0c.55 3.6 2.4 5.45 6 6-3.6.55-5.45 2.4-6 6-.55-3.6-2.4-5.45-6-6 3.6-.55 5.45-2.4 6-6z" fill="#D63600" />
        </svg>
        ✦ AI 洞察
      </div>
      <p className="ai-text">{text}</p>
      {action && (
        <button onClick={action.onClick} className="ai-action mt-3">
          {action.label}
        </button>
      )}
    </div>
  );
}
