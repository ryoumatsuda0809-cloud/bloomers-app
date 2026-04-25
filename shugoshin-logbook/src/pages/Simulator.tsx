
import ROISimulator from "@/components/ROISimulator";

export default function Simulator() {
  return (
    <div className="min-h-screen bg-background">
      {/* ── ヘッダー ── */}
      <header className="sticky top-0 z-30 border-b bg-primary px-4 py-4">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent">
            <img src="/icon-192.png" alt="守護神" className="h-5 w-5 rounded-md" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-primary-foreground">守護神</h1>
            <p className="text-xs text-primary-foreground/70">ROI &amp; リスク シミュレーター</p>
          </div>
        </div>
      </header>

      {/* ── 本体 ── */}
      <main className="mx-auto max-w-3xl px-4 py-6 pb-16">
        <ROISimulator />
      </main>
    </div>
  );
}
