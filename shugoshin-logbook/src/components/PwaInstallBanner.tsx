import { useState } from "react";
import { usePwaInstall } from "@/hooks/usePwaInstall";
import { X, Smartphone, Share } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export default function PwaInstallBanner() {
  const { isInstallable, isIos, isStandalone, promptInstall } = usePwaInstall();
  const [dismissed, setDismissed] = useState(false);
  const [iosDialogOpen, setIosDialogOpen] = useState(false);

  // Don't show if already standalone or dismissed
  if (isStandalone || dismissed) return null;
  // Only show if installable (Android) or iOS Safari
  if (!isInstallable && !isIos) return null;

  const handleClick = async () => {
    if (isIos) {
      setIosDialogOpen(true);
    } else {
      await promptInstall();
    }
  };

  return (
    <>
      <div className="flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
        <Smartphone className="h-5 w-5 shrink-0 text-primary" />
        <p className="min-w-0 flex-1 text-sm text-foreground">
          ホーム画面に追加して素早くアクセス
        </p>
        <Button size="sm" variant="default" onClick={handleClick} className="shrink-0">
          追加
        </Button>
        <button
          onClick={() => setDismissed(true)}
          className="shrink-0 rounded-lg p-1 text-muted-foreground hover:bg-muted"
          aria-label="閉じる"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* iOS Guide Dialog */}
      <Dialog open={iosDialogOpen} onOpenChange={setIosDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-lg">📱 ホーム画面に追加</DialogTitle>
            <DialogDescription>
              iOSではブラウザの共有メニューからインストールできます。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
                1
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">共有ボタンをタップ</p>
                <p className="text-xs text-muted-foreground">
                  画面下部の <Share className="inline h-3.5 w-3.5" /> ボタンを押します
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
                2
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">「ホーム画面に追加」を選択</p>
                <p className="text-xs text-muted-foreground">
                  メニューを下にスクロールして見つけてください
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
                3
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">「追加」をタップ</p>
                <p className="text-xs text-muted-foreground">
                  ホーム画面にアプリアイコンが表示されます
                </p>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
