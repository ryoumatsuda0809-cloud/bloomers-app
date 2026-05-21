"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Circle, Lock, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
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
  status: QuestStatus;
  onComplete: (id: string) => Promise<void>;
  onGitHubSave?: () => Promise<void>;
  gitHubSaveStatus?: 'idle' | 'loading' | 'success' | 'error';
  gitHubRepoUrl?: string;
  href?: string;
}

const STATUS_CONFIG = {
  active: {
    bar: "bg-primary",
    badge: "bg-accent text-accent-foreground",
    badgeLabel: "進行中",
    icon: <Sparkles className="size-4 text-primary shrink-0" />,
    ring: "ring-2 ring-primary shadow-md",
    prompt: "text-primary",
    promptPrefix: "$ ",
    buttonClass: "bg-primary text-primary-foreground hover:bg-primary/90 rounded-md h-9 text-sm font-semibold",
    buttonLabel: "クエストを完了する",
    disabled: false,
  },
  completed: {
    bar: "bg-accent",
    badge: "bg-accent/50 text-accent-foreground",
    badgeLabel: "完了",
    icon: <CheckCircle2 className="size-4 text-primary shrink-0" />,
    ring: "opacity-70",
    prompt: "text-muted-foreground",
    promptPrefix: "✓ ",
    buttonClass: "bg-accent/30 text-accent-foreground rounded-md h-9 text-sm font-semibold cursor-default",
    buttonLabel: "完了済み",
    disabled: true,
  },
  unlocked: {
    bar: "bg-accent/60",
    badge: "bg-accent/40 text-accent-foreground",
    badgeLabel: "解放済み",
    icon: <Circle className="size-4 text-primary/70 shrink-0" />,
    ring: "",
    prompt: "text-muted-foreground",
    promptPrefix: "$ ",
    buttonClass: "bg-accent/30 text-accent-foreground rounded-md h-9 text-sm font-semibold",
    buttonLabel: "完了する",
    disabled: true,
  },
  locked: {
    bar: "bg-muted",
    badge: "bg-muted text-muted-foreground",
    badgeLabel: "ロック中",
    icon: <Lock className="size-4 text-muted-foreground shrink-0" />,
    ring: "opacity-50",
    prompt: "text-muted-foreground",
    promptPrefix: "# ",
    buttonClass: "bg-muted text-muted-foreground rounded-md h-9 text-sm font-semibold cursor-not-allowed",
    buttonLabel: "ロック中",
    disabled: true,
  },
} as const;

export default function QuestCard({
  id,
  title,
  description,
  status,
  onComplete,
  onGitHubSave,
  gitHubSaveStatus = 'idle',
  gitHubRepoUrl = '',
  href,
}: QuestCardProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const config = STATUS_CONFIG[status];

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
      {/* アクセントバー */}
      <div
        className={`h-1.5 w-full ${config.bar} shrink-0`}
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

      <CardFooter className="pt-0 flex flex-col gap-2">
        {href && (
          <Link
            href={href}
            className="w-full h-10 bg-card border border-primary/40 text-primary text-sm font-semibold rounded-xl hover:bg-accent/30 transition flex items-center justify-center"
          >
            クエストを進める
          </Link>
        )}
        {href && id === 'q5' && (
          <>
            {gitHubSaveStatus === 'idle' && (
              <Button
                variant="outline"
                className="w-full"
                onClick={onGitHubSave}
                disabled={false}
              >
                プロジェクトを保存する
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
                className="text-sm text-primary underline text-center w-full"
              >
                保存完了！確認する
              </a>
            )}
            {gitHubSaveStatus === 'error' && (
              <p className="text-destructive text-sm text-center w-full">
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
          {isSubmitting ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              処理中...
            </span>
          ) : config.buttonLabel}
        </Button>
      </CardFooter>
    </Card>
  );
}
