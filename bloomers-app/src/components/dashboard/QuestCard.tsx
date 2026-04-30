"use client";

import { useState } from "react";
import { CheckCircle2, Circle, Lock, Sparkles, Terminal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { QuestStatus } from "@/store/useQuestStore";

interface QuestCardProps {
  id: string;
  title: string;
  description: string;
  promptPreview: string;
  status: QuestStatus;
  onComplete: (id: string) => Promise<void>;
  onGitHubSave?: () => Promise<void>;
  gitHubSaveStatus?: 'idle' | 'loading' | 'success' | 'error';
  gitHubRepoUrl?: string;
}

const STATUS_CONFIG = {
  active: {
    bar: "from-indigo-500 via-purple-500 to-pink-500",
    badge: "bg-indigo-100 text-indigo-700",
    badgeLabel: "進行中",
    icon: <Sparkles className="size-4 text-indigo-500 shrink-0" />,
    ring: "ring-2 ring-indigo-400 shadow-lg shadow-indigo-100",
    prompt: "text-emerald-400",
    promptPrefix: "$ ",
    buttonClass: "bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-md h-9 text-sm font-semibold",
    buttonLabel: "✨ クエストを完了する",
    disabled: false,
  },
  completed: {
    bar: "from-emerald-400 to-teal-500",
    badge: "bg-emerald-100 text-emerald-700",
    badgeLabel: "完了",
    icon: <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />,
    ring: "opacity-70",
    prompt: "text-zinc-500",
    promptPrefix: "✓ ",
    buttonClass: "bg-emerald-100 text-emerald-700 rounded-md h-9 text-sm font-semibold cursor-default",
    buttonLabel: "✅ 完了済み",
    disabled: true,
  },
  unlocked: {
    bar: "from-violet-400 to-indigo-400",
    badge: "bg-violet-100 text-violet-700",
    badgeLabel: "解放済み",
    icon: <Circle className="size-4 text-violet-400 shrink-0" />,
    ring: "",
    prompt: "text-zinc-400",
    promptPrefix: "$ ",
    buttonClass: "bg-violet-100 text-violet-700 rounded-md h-9 text-sm font-semibold",
    buttonLabel: "完了する",
    disabled: true,
  },
  locked: {
    bar: "bg-zinc-200",
    badge: "bg-zinc-100 text-zinc-400",
    badgeLabel: "🔒 ロック中",
    icon: <Lock className="size-4 text-zinc-400 shrink-0" />,
    ring: "opacity-50",
    prompt: "text-zinc-600",
    promptPrefix: "# ",
    buttonClass: "bg-zinc-100 text-zinc-400 rounded-md h-9 text-sm font-semibold cursor-not-allowed",
    buttonLabel: "🔒 ロック中",
    disabled: true,
  },
} as const;

export default function QuestCard({
  id,
  title,
  description,
  promptPreview,
  status,
  onComplete,
  onGitHubSave,
  gitHubSaveStatus = 'idle',
  gitHubRepoUrl = '',
}: QuestCardProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const config = STATUS_CONFIG[status];
  const isLocked = status === "locked";

  const handleClick = async () => {
    if (config.disabled || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onComplete(id);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card
      className={`relative flex flex-col overflow-hidden rounded-xl transition-all duration-300 ${config.ring}`}
    >
      {/* グラデーションアクセントバー */}
      <div
        className={`h-1.5 w-full bg-gradient-to-r ${config.bar} shrink-0`}
      />

      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {config.icon}
            <CardTitle className="text-sm font-bold leading-snug truncate">
              {title}
            </CardTitle>
          </div>
          <Badge
            variant="secondary"
            className={`shrink-0 text-xs px-2 py-0.5 ${config.badge}`}
          >
            {config.badgeLabel}
          </Badge>
        </div>
        <CardDescription className="text-xs mt-1 leading-relaxed">
          {description}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex-1 pt-0">
        {/* プロンプトプレビュー */}
        <div className="rounded-lg bg-zinc-900 p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <Terminal className="size-3 text-zinc-500" />
            <span className="text-xs text-zinc-500 font-mono">アクション</span>
          </div>
          <p className={`font-mono text-xs leading-relaxed break-all ${config.prompt}`}>
            <span className="text-zinc-500">{config.promptPrefix}</span>
            {isLocked ? "前のクエストを完了してください" : promptPreview}
          </p>
        </div>
      </CardContent>

      <CardFooter className="pt-0 flex flex-col gap-2">
        {id === 'q5' && status === 'active' && (
          <>
            {gitHubSaveStatus === 'idle' && (
              <Button
                variant="outline"
                className="w-full"
                onClick={onGitHubSave}
                disabled={false}
              >
                🚀 プロジェクトを保存する
              </Button>
            )}
            {gitHubSaveStatus === 'loading' && (
              <Button variant="outline" className="w-full" disabled>
                保存中...
              </Button>
            )}
            {gitHubSaveStatus === 'success' && (
              <a
                href={gitHubRepoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-green-600 underline text-center w-full"
              >
                ✅ 保存完了！確認する
              </a>
            )}
            {gitHubSaveStatus === 'error' && (
              <p className="text-red-500 text-sm text-center w-full">
                保存に失敗しました。もう一度お試しください。
              </p>
            )}
          </>
        )}
        <Button
          className={`w-full ${config.buttonClass}`}
          disabled={config.disabled || isSubmitting}
          onClick={handleClick}
        >
          {isSubmitting ? "処理中..." : config.buttonLabel}
        </Button>
      </CardFooter>
    </Card>
  );
}
