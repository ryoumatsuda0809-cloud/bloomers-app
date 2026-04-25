import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { FisheryData } from "@/hooks/useEvidence";

interface FisheryFormProps {
  value: Partial<FisheryData>;
  onChange: (data: Partial<FisheryData>) => void;
}

const CATCH_NUMBER_LENGTH = 16;

export function FisheryForm({ value, onChange }: FisheryFormProps) {
  const catchNumberInvalid =
    !!value.catch_number && value.catch_number.length !== CATCH_NUMBER_LENGTH;

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-muted/40 p-5">
      <p className="text-sm font-semibold text-muted-foreground">
        水産物情報の入力（水産流通適正化法）
      </p>

      {/* 品目 */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="fishery-species" className="text-base font-semibold">
          品目 <span className="text-destructive">*</span>
        </Label>
        <Input
          id="fishery-species"
          type="text"
          placeholder="例: マグロ、サバ、カツオ"
          value={value.species ?? ""}
          onChange={(e) => onChange({ ...value, species: e.target.value })}
          className="h-12 text-base"
          autoComplete="off"
        />
      </div>

      {/* 重量 */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="fishery-weight" className="text-base font-semibold">
          重量（kg） <span className="text-destructive">*</span>
        </Label>
        <Input
          id="fishery-weight"
          type="number"
          inputMode="decimal"
          min="0.1"
          step="0.1"
          placeholder="例: 450.5"
          value={value.weight_kg ?? ""}
          onChange={(e) =>
            onChange({
              ...value,
              weight_kg: e.target.value === "" ? undefined : Number(e.target.value),
            })
          }
          className="h-12 text-base"
        />
      </div>

      {/* 漁獲番号 / 荷口番号 */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="fishery-catch-number" className="text-base font-semibold">
          漁獲番号 / 荷口番号（{CATCH_NUMBER_LENGTH}桁）{" "}
          <span className="text-destructive">*</span>
        </Label>
        <Input
          id="fishery-catch-number"
          type="text"
          inputMode="text"
          maxLength={CATCH_NUMBER_LENGTH}
          placeholder={`${CATCH_NUMBER_LENGTH}桁の英数字`}
          value={value.catch_number ?? ""}
          onChange={(e) =>
            onChange({ ...value, catch_number: e.target.value })
          }
          className={`h-12 font-mono text-base tracking-widest ${
            catchNumberInvalid ? "border-destructive focus-visible:ring-destructive" : ""
          }`}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="characters"
        />
        <div className="flex items-center justify-between px-1">
          {catchNumberInvalid ? (
            <p className="text-sm text-destructive">
              {CATCH_NUMBER_LENGTH}桁で入力してください（現在: {value.catch_number?.length}桁）
            </p>
          ) : (
            <span />
          )}
          <p className="text-xs text-muted-foreground tabular-nums">
            {value.catch_number?.length ?? 0} / {CATCH_NUMBER_LENGTH}
          </p>
        </div>
      </div>
    </div>
  );
}
