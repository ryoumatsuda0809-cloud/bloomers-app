// knowledge_chunks テーブルに追加知識を投入するスクリプト
// 実行: node scripts/seed-knowledge.mjs

const GEMINI_KEY = process.env.GEMINI_API_KEY
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!GEMINI_KEY || !SUPABASE_URL || !SUPABASE_ANON) {
  console.error('環境変数が不足しています。.env.local を読み込んでから実行してください。')
  process.exit(1)
}

const NEW_CHUNKS = [
  {
    trigger: 'Next.js App Routerとは・ページの作り方',
    fact: 'Next.js 13以降のApp Routerでは、app/フォルダ内にpage.tsxを置くだけでルーティングが完成する。サーバーコンポーネントがデフォルトで、データ取得はコンポーネント内に書ける。',
    insight: '初心者が最初に躓くのは「どこにファイルを置けばURLになるか」という感覚。ファイル=URLという直感的なルールさえ掴めば、残りは自然に理解できる。',
    quest_seed: 'app/hello/page.tsx を作ってブラウザで/helloを開くという体験から始める。ルーティングの感覚を体で覚えさせる最初のクエスト。',
  },
  {
    trigger: 'Supabase Authとは・ログイン機能の仕組み',
    fact: 'Supabase AuthはJWTベースの認証基盤。supabase.auth.signUp()でユーザー登録、signInWithPassword()でログイン、getUser()で現在のユーザーを取得できる。メール確認・OAuth連携も内蔵。',
    insight: '認証は「誰がアクセスしているか」を証明する仕組み。Supabaseはこの複雑さを3行のコードに凝縮している。初心者にはまず「IDカード」の比喩で説明するのが効果的。',
    quest_seed: 'ログインページを作りsupabase.auth.signInWithPasswordを呼ぶ。成功したらdashboardへリダイレクト。認証の成功体験を最短で得させるクエスト。',
  },
  {
    trigger: 'データベースとスプレッドシートの違い・テーブル設計',
    fact: 'データベースのテーブルはExcelのシートに似ているが、行の追加・検索・結合が高速。Supabaseではテーブルエディタでスプレッドシート感覚でデータを見られる。',
    insight: '「DBはスプレッドシートの超高速版」という比喩が初心者に最も刺さる。SELECT=フィルター、INSERT=新しい行を追加、UPDATE=セルを書き換える、という対応で理解が一気に進む。',
    quest_seed: 'Supabaseのテーブルエディタで自分のprofilesテーブルを見て、自分のレコードを確認する体験。「自分のデータがここにある」という実感を持たせる。',
  },
  {
    trigger: 'APIとは何か・フロントエンドとバックエンドの関係',
    fact: 'APIはアプリ同士が会話するための窓口。Next.jsのServer Actionsを使えばフロントエンドからサーバーの処理を直接呼べる。URLを経由したfetchより直感的。',
    insight: 'APIの概念は「レストランの注文窓口」で説明するのが最もわかりやすい。客（フロント）が注文（リクエスト）を渡し、厨房（バックエンド）が料理（レスポンス）を返す。',
    quest_seed: 'Server Actionを1つ作り、ボタンクリックでsupabaseからデータを取得して画面に表示する。フロント↔バックの往復を体験させるクエスト。',
  },
  {
    trigger: '環境変数とは・.env.localの使い方',
    fact: '環境変数はAPIキーやDB接続情報など秘密の設定値を安全に管理する仕組み。Next.jsでは.env.localに書き、NEXT_PUBLIC_プレフィックスがないものはサーバーのみで使える。',
    insight: 'APIキーのGit漏洩は初心者の最大リスク。「鍵を玄関に貼り出すな」という比喩で重要性を伝える。.gitignoreに.env.localが入っているか確認させることが最重要の習慣づけ。',
    quest_seed: '.env.localを作り、NEXT_PUBLIC_SUPABASE_URLを設定してコードから参照する。環境変数の読み方を体で覚えるクエスト。',
  },
  {
    trigger: 'Vercelデプロイ・本番公開の仕組み',
    fact: 'VercelはGitHubと連携することで、mainブランチにpushするだけで自動的に本番デプロイが走る。環境変数はVercelのダッシュボードで設定する。',
    insight: '「GitHubにpushしたら数分で世界中からアクセスできる」という体験は初心者に最大の達成感を与える。この体験を早い段階でさせることがモチベーション維持の鍵。',
    quest_seed: 'VercelにGitHubリポジトリを連携してデプロイ。完成したURLを誰かに送ってもらう。初公開の達成感を最速で体験させるクエスト。',
  },
  {
    trigger: 'MVPとは何か・最小限のプロダクト設計',
    fact: 'MVP（Minimum Viable Product）は「最小限の機能で価値を検証できる製品」。完璧を目指さず、コアの価値を一番速く届けることを優先する。',
    insight: '初心者は完璧なプロダクトを作ろうとして動けなくなる。「10人に使ってもらえる粗削りなものの方が、誰にも使われない完璧なものより価値がある」という思想の転換が必要。',
    quest_seed: '作りたいサービスの機能リストを書き、そのうち「これだけあれば使える」を1つ選ぶ。それがMVP。選択の体験を通じて絞り込みの感覚を養うクエスト。',
  },
  {
    trigger: 'TypeScriptの型とは何か・なぜ型を書くのか',
    fact: 'TypeScriptの型は変数が「どんなデータを持つか」を事前に宣言する仕組み。型エラーはコードを実行する前にミスを教えてくれる。string、number、booleanが基本。',
    insight: '型は「食器棚のラベル」に例えられる。ラベルがあれば間違ったものを入れようとした時に気づける。型なしは暗闇の中で料理するようなもの。',
    quest_seed: 'UserProfile型を定義して、プロフィールデータを型付きで扱う。型エラーを意図的に起こして直す体験。エラーは敵ではなく親切なメッセージと気づかせるクエスト。',
  },
  {
    trigger: 'Reactコンポーネントとは・UIの部品化',
    fact: 'Reactのコンポーネントは再利用可能なUI部品。関数コンポーネントとしてJSXを返す関数を作り、<MyComponent />と呼び出すだけで使える。',
    insight: 'コンポーネントは「レゴブロック」。一度作ったブロックは何度でも組み合わせて使える。UIの共通部分を見つけてコンポーネント化すると、変更が一箇所で済む。',
    quest_seed: 'ボタンをButtonコンポーネントとして切り出し、複数の場所で使う。コンポーネント化の「あ、なるほど」体験を作るクエスト。',
  },
  {
    trigger: 'RLS（行レベルセキュリティ）とは・Supabaseのデータ保護',
    fact: 'RLSはデータベースの行ごとにアクセス制御をかける仕組み。「自分のデータしか見られない」というポリシーを書くことで、APIキーが漏れても他人のデータは守られる。',
    insight: 'RLSなしのテーブルはAPIで全件取得できる。初心者がRLSを忘れると「全ユーザーのメールアドレスが誰でも見える」状態になる。セキュリティの基礎として最初から習慣にさせる。',
    quest_seed: 'profilesテーブルにRLSを設定し、ログインしていないユーザーからデータを守る。セキュリティポリシーの書き方と「なぜ必要か」を体験するクエスト。',
  },
  {
    trigger: 'エラーとの向き合い方・デバッグの基礎',
    fact: 'エラーはバグの場所と理由を教えてくれるメッセージ。console.logでデータを出力して確認する、エラーメッセージをそのまま検索する、の2つが初心者の基本スキル。',
    insight: '初心者はエラーを「失敗」と感じて怖くなる。しかしエラーメッセージは「ここがおかしい」という親切な道案内。エラーを「情報」として読む姿勢が身についた瞬間に成長が加速する。',
    quest_seed: '意図的にエラーを起こし、メッセージを読んで自分で直す体験。AIに「このエラーメッセージの意味を教えて」と聞く練習。エラーを友達にするクエスト。',
  },
  {
    trigger: 'Git・GitHubとは・コードの保存と管理',
    fact: 'Gitはコードの変更履歴を保存するツール。GitHubはその保存先をクラウドに持つサービス。git add → git commit → git pushの3ステップでコードを保存・共有できる。',
    insight: 'Gitは「コードのタイムマシン」。ゲームのセーブポイントと同じで、失敗してもいつでも戻れる安心感がある。この安心感があると、初心者は大胆に試せるようになる。',
    quest_seed: '最初のコミットをGitHubにpushする。コミットメッセージに「最初の一歩」と書く。Gitの習慣化と達成感を同時に与えるクエスト。',
  },
  {
    trigger: 'ZustandとReact状態管理・useStateとの違い',
    fact: 'Zustandはシンプルなグローバル状態管理ライブラリ。useStateは1コンポーネント内の状態管理、Zustandは複数コンポーネントで共有する状態に使う。createで作ったstoreをどこからでも呼べる。',
    insight: '「同じデータを複数の場所で使いたい」という瞬間がZustandを使うタイミング。useStateを「個人のメモ帳」、Zustandを「共有ホワイトボード」と比喩すると理解が早い。',
    quest_seed: 'クエスト進捗をZustandのstoreで管理し、異なるコンポーネントから同じ状態を読む。グローバル状態の概念を体験するクエスト。',
  },
  {
    trigger: 'Tailwind CSSとは・クラスでスタイルを当てる方法',
    fact: 'Tailwind CSSはCSSのクラスを組み合わせてスタイルを書くフレームワーク。className="text-lg font-bold text-blue-500"のように書くだけでスタイルが当たる。CSSファイルを別に書く必要がない。',
    insight: 'Tailwindは「CSSをHTMLに書く」という発想の転換。最初は長いclassNameに違和感を覚えるが、慣れると「どこを直せばいいか」が一目瞭然になる。コンポーネントとスタイルが一箇所に集まる強みがある。',
    quest_seed: 'ボタンにTailwindでスタイルを当て、ホバー時の色変化を実装する。className を増やすだけでUIが変わる体験。CSSの壁を低くするクエスト。',
  },
  {
    trigger: 'プロダクトのユーザーテスト・フィードバックの集め方',
    fact: 'ユーザーテストは実際の利用者にプロダクトを触ってもらい、操作の詰まりや感想を観察する手法。最低5人に使ってもらうと主要な問題の約80%が見つかる（ニールセンの法則）。',
    insight: 'LINEで友達に送って「使ってみて感想教えて」が最速のユーザーテスト。完璧になってから見せようとするより、荒削りな段階で見せる方が有益なフィードバックが得られる。',
    quest_seed: '作ったMVPを3人の友人に試してもらい、「どこで詰まったか」を記録する。フィードバックをNextクエストの課題に変換する体験。',
  },
]

async function embed(text) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-2:embedContent?key=${GEMINI_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'models/gemini-embedding-2',
        content: { parts: [{ text }] },
        outputDimensionality: 768,
      }),
    }
  )
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Embedding API error ${res.status}: ${err}`)
  }
  const data = await res.json()
  return data.embedding?.values
}

async function insertChunk(chunk, embedding) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/knowledge_chunks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON,
      Authorization: `Bearer ${SUPABASE_ANON}`,
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      trigger: chunk.trigger,
      fact: chunk.fact,
      insight: chunk.insight,
      quest_seed: chunk.quest_seed,
      embedding: `[${embedding.join(',')}]`,
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Insert error ${res.status}: ${err}`)
  }
}

async function main() {
  console.log(`${NEW_CHUNKS.length}件の知識チャンクを追加します...\n`)

  for (let i = 0; i < NEW_CHUNKS.length; i++) {
    const chunk = NEW_CHUNKS[i]
    process.stdout.write(`[${i + 1}/${NEW_CHUNKS.length}] ${chunk.trigger} ... `)

    try {
      const embedText = `${chunk.trigger}\n${chunk.insight}\n${chunk.quest_seed}`
      const embedding = await embed(embedText)
      if (!embedding) throw new Error('embedding がnull')

      await insertChunk(chunk, embedding)
      console.log('✅')
    } catch (err) {
      console.log(`❌ ${err.message}`)
    }

    // レート制限を避けるため少し待つ
    if (i < NEW_CHUNKS.length - 1) {
      await new Promise((r) => setTimeout(r, 500))
    }
  }

  console.log('\n完了！')
}

main()
