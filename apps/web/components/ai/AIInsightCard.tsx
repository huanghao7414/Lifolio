export default function AIInsightCard({ text }: { text: string }) {
  return (
    <div className="ai-card">
      <div className="ai-tag mb-2">
        <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
          <path d="M7 0c.55 3.6 2.4 5.45 6 6-3.6.55-5.45 2.4-6 6-.55-3.6-2.4-5.45-6-6 3.6-.55 5.45-2.4 6-6z" fill="#FF4500" />
        </svg>
        AI 洞察
      </div>
      <p className="text-sm text-gray-700 leading-relaxed">{text}</p>
    </div>
  );
}
