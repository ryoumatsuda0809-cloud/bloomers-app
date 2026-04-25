"use client";

import { useQuestStore } from "@/store/useQuestStore";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Circle, Lock } from "lucide-react";

export default function QuestDashboard() {
  const quests = useQuestStore((state) => state.quests);
  const activeQuest = useQuestStore((state) => state.getActiveQuest());
  const completeQuest = useQuestStore((state) => state.completeQuest);

  return (
    <div className="container mx-auto p-6 max-w-5xl">
      <h1 className="text-3xl font-bold mb-8 text-zinc-800">Bloomers Quest Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* 左側: プログレス・ツリー */}
        <div className="col-span-1 space-y-4">
          <h2 className="text-xl font-semibold mb-4 text-zinc-700">Progress Tree</h2>
          {quests.map((quest) => (
            <Card key={quest.id} className={`border-l-4 ${
              quest.status === 'active' ? 'border-l-blue-500 bg-blue-50/50' : 
              quest.status === 'completed' ? 'border-l-green-500' : 'border-l-zinc-200 opacity-60'
            }`}>
              <CardHeader className="p-4">
                <CardTitle className="text-sm flex items-center gap-2">
                  {quest.status === 'completed' && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                  {quest.status === 'active' && <Circle className="w-4 h-4 text-blue-500 fill-blue-500" />}
                  {quest.status === 'locked' && <Lock className="w-4 h-4 text-zinc-400" />}
                  {quest.status === 'unlocked' && <Circle className="w-4 h-4 text-zinc-400" />}
                  {quest.title}
                </CardTitle>
              </CardHeader>
            </Card>
          ))}
        </div>

        {/* 右側: インストラクション・カード & メンター・ウィンドウ */}
        <div className="col-span-2 space-y-6">
          {activeQuest ? (
            <>
              <Card className="border-blue-200 shadow-md">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-2xl text-blue-900">{activeQuest.title}</CardTitle>
                      <CardDescription className="mt-2 text-zinc-600">{activeQuest.description}</CardDescription>
                    </div>
                    <Badge variant="secondary" className="bg-blue-100 text-blue-800">Active</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="bg-zinc-900 rounded-md p-4 text-zinc-100 font-mono text-sm">
                    <p className="text-zinc-400"># アクション</p>
                    <p>このタスクを完了させて次へ進みましょう。</p>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button 
                    className="w-full bg-blue-600 hover:bg-blue-700" 
                    onClick={() => completeQuest(activeQuest.id)}
                  >
                    クエストを完了する
                  </Button>
                </CardFooter>
              </Card>

              {/* メンター・ウィンドウ */}
              <Card className="bg-zinc-50 border-dashed border-2">
                <CardContent className="p-6">
                  <div className="flex gap-4">
                    <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center shrink-0 text-xl">
                      🤖
                    </div>
                    <div>
                      <h4 className="font-bold text-zinc-800 mb-1">Mentor's Note</h4>
                      <p className="text-sm text-zinc-600">
                        「完了する」ボタンを押してみてください。バック裏ではZustandによる依存関係（dependsOn）の評価が行われ、未解放だった次のクエストが自動的にアクティブになります。これが「迷わないレール」の根幹です。
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card className="bg-green-50 border-green-200">
              <CardContent className="p-10 text-center">
                <h2 className="text-2xl font-bold text-green-800 mb-2">🎉 全クエスト完了！</h2>
                <p className="text-green-600">おめでとうございます。ロードマップを完走しました。</p>
              </CardContent>
            </Card>
          )}
        </div>
        
      </div>
    </div>
  );
}
