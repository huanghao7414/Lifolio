export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="auth-page min-h-svh flex flex-col items-center justify-center px-5 py-10 sm:py-16">
      <div className="w-full max-w-[420px]">{children}</div>
      <p className="mt-7 text-xs tracking-[0.16em] text-ink-2">YOUR LIFE, QUANTIFIED.</p>
    </main>
  );
}
