'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { signUp, signIn } from '@/app/actions/auth'

const authSchema = z.object({
  email: z.string().email('有効なメールアドレスを入力してください'),
  password: z.string().min(6, 'パスワードは6文字以上で入力してください'),
})

type AuthFormValues = z.infer<typeof authSchema>

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AuthFormValues>({
    resolver: zodResolver(authSchema),
  })

  const onSubmit = async (values: AuthFormValues) => {
    setServerError(null)

    const action = mode === 'signup' ? signUp : signIn
    const { error } = await action(values.email, values.password)

    if (error) {
      setServerError(error)
      return
    }

    router.push('/')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-purple-50/20 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">

        {/* ロゴ */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <span className="text-3xl">🌸</span>
          <span className="text-2xl font-bold tracking-tight text-zinc-800">Bloomers</span>
        </div>

        <Card className="rounded-2xl shadow-md ring-1 ring-zinc-100">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-bold text-zinc-800">
              {mode === 'login' ? 'ログイン' : 'アカウント登録'}
            </CardTitle>
            <CardDescription className="text-xs text-zinc-500">
              {mode === 'login'
                ? 'メールアドレスとパスワードでログイン'
                : 'メールアドレスとパスワードで新規登録'}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-5">

            {/* Googleログイン（ダミー） */}
            <Button
              type="button"
              variant="outline"
              className="w-full h-9 text-sm font-medium gap-2"
              disabled
            >
              <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Googleでログイン（準備中）
            </Button>

            {/* 区切り線 */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-zinc-200" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-white px-3 text-xs text-zinc-400">または</span>
              </div>
            </div>

            {/* メール/パスワードフォーム */}
            <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">

              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-medium text-zinc-700">
                  メールアドレス
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  autoComplete="email"
                  aria-invalid={!!errors.email}
                  className="h-9 text-sm"
                  {...register('email')}
                />
                {errors.email && (
                  <p className="text-xs text-red-500">{errors.email.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-xs font-medium text-zinc-700">
                  パスワード
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="6文字以上"
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  aria-invalid={!!errors.password}
                  className="h-9 text-sm"
                  {...register('password')}
                />
                {errors.password && (
                  <p className="text-xs text-red-500">{errors.password.message}</p>
                )}
              </div>

              {serverError && (
                <p className="text-xs text-red-500 bg-red-50 rounded-md px-3 py-2">
                  {serverError}
                </p>
              )}

              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-9 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white text-sm font-semibold"
              >
                {isSubmitting
                  ? '処理中...'
                  : mode === 'login'
                  ? 'ログイン'
                  : '登録する'}
              </Button>
            </form>

            {/* モード切り替え */}
            <p className="text-center text-xs text-zinc-500">
              {mode === 'login' ? 'アカウントをお持ちでない方は' : 'すでにアカウントをお持ちの方は'}
              <button
                type="button"
                onClick={() => {
                  setMode(mode === 'login' ? 'signup' : 'login')
                  setServerError(null)
                }}
                className="ml-1 text-indigo-600 hover:underline font-medium"
              >
                {mode === 'login' ? '新規登録' : 'ログイン'}
              </button>
            </p>

          </CardContent>
        </Card>

      </div>
    </div>
  )
}
