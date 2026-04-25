import { useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { useOrganization } from "@/hooks/useOrganization";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function UnassignedAlert() {
  const { orgId, loading, refetch } = useOrganization();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (loading || orgId !== null) return null;

  const handleSubmit = async () => {
    const trimmed = code.trim();
    if (trimmed.length < 4) {
      setError("招待コードを入力してください");
      return;
    }
    setError("");
    setSubmitting(true);
    const { error: rpcError } = await supabase.rpc(
      "join_organization_by_invite_code",
      { _code: trimmed }
    );
    setSubmitting(false);
    if (rpcError) {
      setError("招待コードが間違っているか、有効期限が切れています");
      return;
    }
    toast({ title: "組織に参加しました" });
    setOpen(false);
    setCode("");
    refetch();
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-3 border border-amber-300 bg-amber-50 px-4 min-h-[56px] text-left text-amber-800 transition-colors hover:bg-amber-100"
      >
        <AlertTriangle className="h-5 w-5 shrink-0" />
        <span className="text-sm font-medium">
          現在、どの会社にも所属していません。タップして招待コードを入力 →
        </span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>招待コードを入力</DialogTitle>
            <DialogDescription>
              所属先の管理者から受け取った6桁のコードを入力してください
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <Input
              value={code}
              onChange={(e) => {
                setCode(e.target.value.toUpperCase());
                setError("");
              }}
              placeholder="例: A1B2C3"
              maxLength={6}
              autoCapitalize="characters"
              className="text-2xl font-mono uppercase tracking-widest text-center h-14"
            />

            {error && (
              <p className="text-destructive text-sm text-center">{error}</p>
            )}

            <Button
              onClick={handleSubmit}
              disabled={submitting || code.trim().length < 4}
              className="w-full h-12 text-base"
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              コードを送信して所属する
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
