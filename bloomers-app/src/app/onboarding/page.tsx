'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { generateIdeasWithAI, saveOnboardingData } from '@/app/actions/onboarding'
import type { PersonalityData, IdeaCard } from '@/app/actions/onboarding'

const MBTI_TYPES = [
  'INTJ', 'INTP', 'ENTJ', 'ENTP',
  'INFJ', 'INFP', 'ENFJ', 'ENFP',
  'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ',
  'ISTP', 'ISFP', 'ESTP', 'ESFP',
]

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
  const [timeUsage, setTimeUsage] = useState('')
  const [mbti, setMbti] = useState('')
  const [knowsMbti, setKnowsMbti] = useState<boolean | null>(null)
  const [personalityType, setPersonalityType] = useState<'intuitive' | 'planned' | null>(null)
  const [localPain, setLocalPain] = useState('')
  const [ideas, setIdeas] = useState<IdeaCard[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [selectError, setSelectError] = useState<string | null>(null)

  const timeChips = [
    'ゲーム・動画', '音楽・ライブ', 'スポーツ・筋トレ',
    'バイト', '勉強・資格', '友達と遊ぶ',
  ]

  const localChips = [
    '地元に○○がない', '大学の手続きが面倒',
    'バイト先の非効率', '趣味仲間と繋がれない',
  ]

  const getMbtiLabel = () => {
    if (knowsMbti === false) {
      return personalityType === 'intuitive' ? 'ENFP（直感型）' : 'ISTJ（計画型）'
    }
    return mbti
  }

  const handleStep3Next = async () => {
    if (!localPain.trim()) return
    setIsLoading(true)
    setStep(4)

    const personality: PersonalityData = {
      timeUsage,
      mbti: getMbtiLabel(),
      localPain,
    }

    const generated = await generateIdeasWithAI(personality)
    setIdeas(generated)
    setIsLoading(false)
  }

  const handleSelectIdea = async (idea: IdeaCard) => {
    setIsLoading(true)
    setSelectError(null)
    const personality: PersonalityData = {
      timeUsage,
      mbti: getMbtiLabel(),
      localPain,
    }
    const result = await saveOnboardingData(personality, idea, ideas)
    if (result.error) {
      setSelectError('保存に失敗しました。もう一度試してください。')
      setIsLoading(false)
      return
    }
    router.push('/')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-900 to-pink-900 flex items-center justify-center px-4">
      <div className="w-full max-w-lg">

        <div className="flex items-center justify-center gap-2 mb-10">
          <span className="text-3xl">🌸</span>
          <span className="text-2xl font-bold text-white tracking-tight">Bloomers</span>
        </div>

        {/* Step 1: 時間の使い方 */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="text-center space-y-3">
              <div className="flex items-center justify-center gap-2" aria-label="ステップ 1 / 3">
                {[1, 2, 3].map((s) => (
                  <div
                    key={s}
                    className={`h-2 rounded-full transition-all duration-300 ${
                      s === 1 ? 'w-6 bg-purple-400' : 'w-2 bg-white/20'
                    }`}
                  />
                ))}
              </div>
              <h1 className="text-2xl font-bold text-white leading-snug">
                あなたが一番<br />
                時間を使っていることは？
              </h1>
              <p className="text-white/50 text-sm">
                趣味でも、バイトでも、なんでも
              </p>
            </div>
            <textarea
              value={timeUsage}
              onChange={(e) => setTimeUsage(e.target.value)}
              placeholder="自由に書いてください..."
              aria-label="一番時間を使っていることを入力"
              className="w-full h-28 bg-white/10 text-white placeholder-white/40 rounded-2xl p-4 resize-none border border-white/20 focus:outline-none focus:border-purple-400"
            />
            <div className="flex flex-wrap gap-2">
              {timeChips.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => setTimeUsage(chip)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition ${
                    timeUsage === chip
                      ? 'bg-purple-500 border-purple-400 text-white'
                      : 'bg-white/10 text-white/70 border-white/20 hover:bg-white/20'
                  }`}
                >
                  {chip}
                </button>
              ))}
            </div>
            <Button
              onClick={() => setStep(2)}
              disabled={!timeUsage.trim()}
              className="w-full h-12 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold rounded-2xl"
            >
              次へ →
            </Button>
          </div>
        )}

        {/* Step 2: MBTI */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="text-center space-y-3">
              <div className="flex items-center justify-center gap-2" aria-label="ステップ 2 / 3">
                {[1, 2, 3].map((s) => (
                  <div
                    key={s}
                    className={`h-2 rounded-full transition-all duration-300 ${
                      s === 2 ? 'w-6 bg-purple-400' : s < 2 ? 'w-2 bg-purple-600' : 'w-2 bg-white/20'
                    }`}
                  />
                ))}
              </div>
              <h1 className="text-2xl font-bold text-white leading-snug">
                MBTIを知っていますか？
              </h1>
            </div>

            {knowsMbti === null && (
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setKnowsMbti(true)}
                  className="h-16 bg-white/10 hover:bg-white/20 border border-white/20 rounded-2xl text-white font-medium transition"
                >
                  知っている
                </button>
                <button
                  type="button"
                  onClick={() => setKnowsMbti(false)}
                  className="h-16 bg-white/10 hover:bg-white/20 border border-white/20 rounded-2xl text-white font-medium transition"
                >
                  知らない / わからない
                </button>
              </div>
            )}

            {knowsMbti === true && (
              <div className="space-y-4">
                <div className="grid grid-cols-4 gap-2">
                  {MBTI_TYPES.map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setMbti(type)}
                      className={`h-10 rounded-xl text-sm font-medium transition border ${
                        mbti === type
                          ? 'bg-purple-500 border-purple-400 text-white'
                          : 'bg-white/10 border-white/20 text-white/70 hover:bg-white/20'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => { setKnowsMbti(null); setMbti('') }}
                  className="text-white/40 text-sm hover:text-white/70 transition"
                >
                  ← 戻る
                </button>
              </div>
            )}

            {knowsMbti === false && (
              <div className="space-y-4">
                <p className="text-white/70 text-center text-sm">
                  直感で選んでください
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPersonalityType('intuitive')}
                    className={`h-20 rounded-2xl border transition p-3 text-left ${
                      personalityType === 'intuitive'
                        ? 'bg-purple-500 border-purple-400 text-white'
                        : 'bg-white/10 border-white/20 text-white/70 hover:bg-white/20'
                    }`}
                  >
                    <p className="font-semibold">直感型</p>
                    <p className="text-xs mt-1 opacity-70">やりながら考える派</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPersonalityType('planned')}
                    className={`h-20 rounded-2xl border transition p-3 text-left ${
                      personalityType === 'planned'
                        ? 'bg-purple-500 border-purple-400 text-white'
                        : 'bg-white/10 border-white/20 text-white/70 hover:bg-white/20'
                    }`}
                  >
                    <p className="font-semibold">計画型</p>
                    <p className="text-xs mt-1 opacity-70">まず計画を立てる派</p>
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => { setKnowsMbti(null); setPersonalityType(null) }}
                  className="text-white/40 text-sm hover:text-white/70 transition w-full text-center"
                >
                  ← 戻る
                </button>
              </div>
            )}

            {((knowsMbti === true && mbti) || (knowsMbti === false && personalityType)) && (
              <div className="flex gap-3">
                <Button
                  onClick={() => setStep(1)}
                  variant="outline"
                  className="h-12 px-6 border-white/30 text-white hover:bg-white/10 rounded-2xl"
                >
                  ← 戻る
                </Button>
                <Button
                  onClick={() => setStep(3)}
                  className="flex-1 h-12 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold rounded-2xl"
                >
                  次へ →
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Step 3: 地元・日常の不便 */}
        {step === 3 && (
          <div className="space-y-6">
            <div className="text-center space-y-3">
              <div className="flex items-center justify-center gap-2" aria-label="ステップ 3 / 3">
                {[1, 2, 3].map((s) => (
                  <div
                    key={s}
                    className={`h-2 rounded-full transition-all duration-300 ${
                      s === 3 ? 'w-6 bg-purple-400' : 'w-2 bg-purple-600'
                    }`}
                  />
                ))}
              </div>
              <h1 className="text-2xl font-bold text-white leading-snug">
                地元・学校・日常で<br />
                「なんでこれないんだろう」<br />
                と思うことは？
              </h1>
            </div>
            <textarea
              value={localPain}
              onChange={(e) => setLocalPain(e.target.value)}
              placeholder="自由に書いてください..."
              aria-label="地元・学校・日常で不便に思うことを入力"
              className="w-full h-28 bg-white/10 text-white placeholder-white/40 rounded-2xl p-4 resize-none border border-white/20 focus:outline-none focus:border-purple-400"
            />
            <div className="flex flex-wrap gap-2">
              {localChips.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => setLocalPain(chip)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition ${
                    localPain === chip
                      ? 'bg-purple-500 border-purple-400 text-white'
                      : 'bg-white/10 text-white/70 border-white/20 hover:bg-white/20'
                  }`}
                >
                  {chip}
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <Button
                onClick={() => setStep(2)}
                variant="outline"
                className="h-12 px-6 border-white/30 text-white hover:bg-white/10 rounded-2xl"
              >
                ← 戻る
              </Button>
              <Button
                onClick={handleStep3Next}
                disabled={!localPain.trim()}
                className="flex-1 h-12 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold rounded-2xl"
              >
                アイデアを見る ✨
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: アイデア選択 */}
        {step === 4 && (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <p className="text-purple-300 text-sm font-medium">あなただけの提案</p>
              <h1 className="text-2xl font-bold text-white">
                {isLoading ? 'あなたを分析中...' : '作るものを選んでください'}
              </h1>
              {isLoading && (
                <p className="text-white/50 text-sm">
                  あなたの答えを元にアイデアを考えています
                </p>
              )}
            </div>

            {isLoading ? (
              <div className="flex justify-center py-12">
                <div className="w-12 h-12 rounded-full border-4 border-purple-500 border-t-transparent animate-spin" />
              </div>
            ) : (
              <div className="space-y-3">
                {ideas.map((idea) => (
                  <button
                    key={idea.title}
                    onClick={() => handleSelectIdea(idea)}
                    disabled={isLoading}
                    className="w-full text-left bg-white/10 hover:bg-white/20 border border-white/20 hover:border-purple-400 rounded-2xl p-5 transition group"
                  >
                    <p className="text-white font-semibold text-lg group-hover:text-purple-300 transition">
                      {idea.title}
                    </p>
                    <p className="text-white/60 text-sm mt-1">
                      {idea.description}
                    </p>
                  </button>
                ))}
                <button
                  onClick={() => setStep(1)}
                  className="w-full text-white/40 text-sm hover:text-white/70 transition pt-2"
                >
                  最初からやり直す
                </button>
                {selectError && (
                  <p className="text-red-400 text-sm text-center">
                    {selectError}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  )
}
