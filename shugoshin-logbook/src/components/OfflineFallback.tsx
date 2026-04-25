import { WifiOff, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function OfflineFallback() {
  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-primary px-6 text-center">
      <WifiOff className="h-16 w-16 text-primary-foreground/60" />
      <h1 className="mt-6 text-2xl font-bold text-primary-foreground">
        📡 現在オフラインです
      </h1>
      <p className="mt-3 max-w-xs text-base text-primary-foreground/70">
        電波の良い場所で再度お試しください。接続が回復すると自動的に復帰します。
      </p>
      <Button
        variant="secondary"
        size="lg"
        className="mt-8"
        onClick={() => window.location.reload()}
      >
        <RefreshCw className="mr-2 h-5 w-5" />
        再読み込み
      </Button>
    </div>
  );
}
