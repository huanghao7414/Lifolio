import Sidebar from '@/components/layout/Sidebar';
import AIChatPanel from '@/components/ai/AIChatPanel';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-surface">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">{children}</main>
      <AIChatPanel />
    </div>
  );
}
