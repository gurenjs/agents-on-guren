---
title: "Agents on Guren: AIエージェントに自作フレームワークを360回解かせてわかったこと"
emoji: "🔥"
type: "tech"
topics: ["guren", "bun", "claudecode", "ai", "typescript"]
published: false
---

## はじめに

2026年8月13日、Rails Foundationが「Agents on Rails: the first benchmark report」を公開しました。21個のタスクを8つのモデルに3回ずつ、計504回解かせたベンチマークです。

https://rubyonrails.org/2026/8/13/agents-on-rails-the-first-benchmark-report

個人的にいちばん興味深かったのはモデルの順位ではなく、次の指摘でした。「RailsのAPIを思い出せる率はモデルによって8%から35%までばらつく。APIを使った解の方が手書きの再実装より成功率が高い。しかも手書きの解はチームが保守すべきコードとして残る」。記事は「ガイドやAPIドキュメントを渡すと結果が変わるかは今後調べる」と締めくくられています。

この記事では、私が開発しているBun向けフルスタックフレームワークGurenで、同じ規模のベンチマークを回した結果を紹介します。Gurenは新しいフレームワークなので、モデルはAPIをほぼ覚えていません。そこで「思い出せるか」ではなく「思い出せないものを、エージェント用の設定一式(以下ハーネス)がどこまで補えるか」を測りました。

https://guren.dev

計測に使ったのはClaude Code、Claude Haiku 4.5 / Sonnet 5 / Opus 5、Guren 2.x系(`@guren/server` 2.6.0、`@guren/orm` 2.4.0、`@guren/cli` 2.5.0)です。

## 1. 前提知識: Gurenのエージェント向けコマンド

本文に何度も出てくるので、先に3つのコマンドを紹介しておきます。どれも`bunx guren ...`で実行するCLIで、人間が使うこともできますが、主にAIエージェントに読ませる想定で作っています。

**`guren context`**は、プロジェクトの地図をMarkdownで出力します。モデル・ルート・ページ・コントローラの一覧に加えて、末尾にフレームワークAPIの署名ダイジェスト(検証済みの早見表)が付きます。

```
# Project Context

## Stack
- Framework: Guren ^1.6.1
- Runtime: Bun
- ORM: Drizzle
- Frontend: React + Inertia.js

## Models (2)
### Post
- Table: `posts`
- belongsTo: `author` → PostAuthorSummary
...
## Guren API Signatures (digest)

Verified quick reference — trust this and `.claude/rules/*.md` over grepping `node_modules/@guren/*`.

### Models (@guren/orm)
- Statics: `find(id)` → record | null · `findOrFail(id)` (throws, renders 404) · `first(where?)` ·
  `all()` · `create(data)` · `update(where, data)` · `delete(where)` · `paginate(options?)` ·
```

**`guren check`**は、ルートとコントローラとページの配線、生成ファイルの有無、ルートファイルが実際にマウントされているか、といった整合性を検査します。たとえば後述するバグ入りのアプリで実行すると、こう指摘してくれます。

```
 WARN  [warn] routes/web.ts route path: get('/archive/:date*') reads as a wildcard,
 but ':name*' is not wildcard syntax in Hono: it registers a single-segment
 parameter named literally 'date*'. A request spanning more than one segment
 404s, and req.param('date') is undefined.
ℹ        → Use a constrained parameter to match across segments — '/archive/:date{.+}'.
Results: 9 passed, 5 warnings, 0 failures
```

**`guren audit`**は、更新系ルートにバリデーションや認可があるか、生SQLや秘密情報が混ざっていないか、といったセキュリティ面を検査します。

```
 ERROR  [fail] [A03] PUT /posts/:id: Route body schema is type-only for controller
 actions — PostController.update reads the body without calling validateBody().
ℹ        → Call this.validateBody(schema) in PostController.update.
Results: 18 passed, 1 warnings, 1 failures, 0 ignored
```

そして**`guren agent:init`**は、これらをエージェントに使わせるための設定一式(CLAUDE.md、ルール、スキル、フック)をプロジェクトに書き出します。セッション開始時に`guren context`の出力を自動で読ませるフックもここに含まれます。今回のベンチマークで比較したのは、この設定一式の有無です。

## 2. 何を測ったのか

### 対象アプリ

公開されている`create-guren-app@1.8.0`でblogテンプレートをそのまま生成したアプリを使いました。

```bash
bunx create-guren-app@1.8.0 agents-on-guren-app --blueprint blog --db sqlite --agents none
```

npmから解決される版そのものなので、ユーザーが手元で作るアプリと同じ状態です。投稿・ユーザー・認証・ポリシー・リソース・検索ルートを持つ小さなブログです。

### タスク

20個の小さなタスクを用意しました。内訳はバグ修正6件、セキュリティ修正4件、機能追加10件です。

バグとセキュリティの問題は、生成直後のアプリにパッチで「仕込んだ」うえで、ユーザーからの報告文として出題します。たとえば「ログインしていれば誰でも他人の投稿を消せる」「アーカイブのURLが404になる」「編集を保存するとブラウザがループする」といった文面です。機能追加は「下書き機能」「スラッグURL」「ログインのレート制限」「認証ページの日本語化」「登録後のウェルカムメールをキューで送る」などです。

各タスクには、エージェントには見せない隠しテストと、こちらで用意した参照解があります。「開始状態では隠しテストが落ちること」「参照解を当てると通ること」を機械的に確認してからタスクセットに入れました。課題文には、解決に使うAPI名やファイル名、コマンド名は書いていません。

なお、タスクの起草はタスクごとの設計メモをもとにClaudeのサブエージェントが行い、上の検証を通ったものだけを人手でレビューして採用しています。

### 2つの条件

- **bare**: エージェント向けの案内が何もない、生成直後の状態。ただしコードと`node_modules/@guren/*/dist/*.d.ts`は読めるので、「情報ゼロ」ではなく「ハーネスなし」です
- **shipped**: 同じ状態で`bunx guren agent:init --target claude`を実行した状態。ベンチマークのために手書きしたものはありません

### 実行方法

全セル共通でheadlessのClaude Code(`claude -p`)を使いました。ファイル編集は自動承認、Bashは開発用コマンドの許可リストのみ、最大120ターン、MCPサーバーなし、ユーザー設定やプラグインなし、Webツールなし、`curl`なしです。プロンプトは固定の前置き(完了条件はtypecheckと既存テストが通ること)とタスク文だけです。

セッション終了後、エージェントのパッチを新しいworktreeに適用し、codegenを再生成してtypecheck、既存テスト、隠しテストの順に流します。typecheckと隠しテストの両方が通ればPASSです。

行列は20タスク × 3モデル × 2条件 × 3試行 = **360セル**で、1台のMacで8時間32分かかりました。現金コストは$0(Claude Maxのサブスクリプション)、CLIが報告するAPI換算コストは$600でした。

## 3. 結果

| モデル | 条件 | 合格 | 総ターン数 | 差 | 総コスト(API換算) | 差 |
|---|---|---|---|---|---|---|
| Haiku 4.5 | bare | 51/60 (85%) | 2,475 | | $21.02 | |
| Haiku 4.5 | shipped | **54/60 (90%)** | 2,073 | **−16%** | $22.26 | +6% |
| Sonnet 5 | bare | 58/60 (97%) | 3,599 | | $137.55 | |
| Sonnet 5 | shipped | **60/60 (100%)** | 2,596 | **−28%** | $102.67 | **−25%** |
| Opus 5 | bare | 60/60 (100%) | 3,361 | | $168.42 | |
| Opus 5 | shipped | 60/60 (100%) | 2,494 | **−26%** | $148.30 | **−12%** |

読み取れることは3つあります。

**上位モデルでは合否がほぼ天井で、ハーネスの効果は「手数」に出ます。** Opusはどちらの条件でも全問正解、Sonnetはハーネスありで全問、なしで58/60でした。変わったのは必要な仕事量で、ターン数は26〜28%減、コストは12〜25%減です。Sonnet+ハーネス(60/60、$103)は、Opusのハーネスなし(60/60、$168)と同じ合格率を61%のコストで達成しています。

**安いモデルでは合格率そのものが動きます。** Haikuは85%から90%に上がりました。一方でコストは6%増えています。ハーネスの分は入力トークンとして払うので、1ターンが安いモデルではその増分が見えます。ただ、Haikuでは丸ごと救われたタスクもあり、`published-flag`が1/3から3/3、`typed-form-register`、`post-slug-binding`、`i18n-ja-catalog`がそれぞれ2/3から3/3になりました。

**効果がいちばん大きいのはデバッグ系です。** カテゴリ別の平均ターン数(bare → shipped)は、バグ修正が34.9 → 22.0(−37%)、セキュリティ修正が36.6 → 23.9(−35%)、機能追加が69.2 → 56.8(−18%)でした。仕込んだバグやセキュリティ穴は、`guren check`や`guren audit`がそのまま名指しする種類のものです。実際、shipped条件のエージェントは180セル中**119セル**で`guren check`を実行し、bare条件では15セルだけでした(bare側で見つけたエージェントは`package.json`を読んで辿り着いています)。

いちばんわかりやすい例が`route-wildcard-404`です。ルートを`/archive/:date*`と登録してあり、Honoはこれを「`date*`という名前のパラメータ」として扱うので、実際のURLが全部404になるというバグです。Sonnetはbareだと80ターン・$5.18かかりましたが、ハーネスありでは`bunx guren check`を1回打った時点で先ほどの警告が出て、37ターン・$1.77で終わりました。

タスクごとに3試行の平均でペア比較すると、shippedの方がターン数が少なかったのはSonnetで20タスク中18、Opusで16、Haikuで13でした。逆転しているのは、1行修正で済む最も簡単なタスク(案内文を読む分だけ余計にかかる)と、最難関の`welcome-mail-job`(どちらの条件も上限まで使い切りがち)に集中しています。

## 4. APIは使われたのか

Railsの記事にならって、合格したパッチを静的にスキャンし、フレームワークのAPIを使った解か、手書きで再実装した解かを分類しました(タスクごとに判定用の正規表現を用意しています)。集計では、bareの合格セルの65%、shippedの70%がフレームワークAPIだけの解でした。差は控えめです。

タスクごとに見ると、はっきりした傾向が出ています。

- **ダイジェストにAPI名が載っているものは、どちらの条件でも使われます。** `validateBody`、`authorize`、`redirect`、`paginate`、リソースのフィールド、クエリの絞り込みなどは、ほとんどのバグ・セキュリティタスクで両条件とも9/9がAPI利用でした
- **ハーネスが言及していないAPIは使われません。** `open-redirect-login`では、フレームワークに`isSafeRedirectUrl`というヘルパーがあるにもかかわらず、両条件合わせて17セル中0セルがそれを使い、全部が手書きのチェックでした。`health-db-probe`でも、`createHealthManager`を見つけたセルですら`SELECT 1`を手書きしていました。`guren context`のダイジェストがどちらにも触れていないのが原因です。モデルではなくこちら側の宿題です
- **フレームワーク側の穴もあります。** `post-slug-binding`ではルートモデルバインディングを使ったセルが0でした。2.6.0では主キー以外でバインドできなかったので当然で、こちらは修正済みです

## 5. 失敗はどこで起きたか

360セル中FAILは17セルです。うち11セルが`api-posts-contract`という1つのタスクに集中しており(Haikuは0/6、Sonnetのbareは1/3)、原因はタスクを書いている最中に見つかったフレームワークのバグでした。`@guren/orm` 2.4.0の`paginate()`はeager loadingを無視するため、`.with('author').paginate()`の結果は`author`がnullになります(`.get()`なら付きます)。アプリ自身の`index`アクションと同じ書き方を踏襲したエージェントは著者フィールドを落とし、隠しテストに2件落ちました。OpusとハーネスありのSonnetは空のフィールドに気づいて回避しましたが、Haikuは気づきませんでした。

このバグはblogテンプレート自身の投稿一覧にも影響していて、mainでは修正済みで次の`@guren/orm`リリースに入ります。タスク自体はこのまま残すつもりです。ドキュメント通りに動かないAPIは実際にエージェントが遭遇するものですし、それにどう反応するかも計測する価値があるからです。

残りの失敗はHaikuの難タスク(`welcome-mail-job`、`published-flag`、`post-slug-binding`)と、`route-wildcard-404`でHaikuが同じ名前のルートを2本登録してしまったケースです。後者は隠しテストは全部通ったのですが、codegenを再生成すると識別子が重複してtypecheckが落ちました。次に`bun run dev`したら壊れる欠陥なので、FAILとして数えています。

セキュリティ系の4タスクはすべて「脆弱性の説明+修正依頼」の文面にしてあります。60セル・3モデルで**拒否は0件**でした。Railsの報告ではFable 5がセキュリティタスクを3件拒否していたので、出題の書き方でだいぶ変わるようです。

## 6. Guren側で見つかったこと

自分のフレームワーク相手にベンチマークを書くのは、隠しテスト付きのドッグフーディングでもあります。実バグ・ギャップが4件見つかりました。最初の2件は修正済み、残り2件はissue化済みです。

- `QueryBuilder.paginate()`がeager loadを落とす(上記)
- ルートモデルバインディングが主キー以外でバインドできない
- キューのジョブ内で`Job.make()`が「Container not initialized」で落ちる(起動時にコンテナが渡されていない)
- `guren context`のダイジェストにヘルスチェックとリダイレクト安全化のヘルパーが載っていない(利用率の結果にそのまま出ています)

## 7. 注意点

- ランナーはClaude Code 1種類です。最小構成の別エージェントでの検証は今回は見送ったので、条件間の比較がClaude Code固有でないかは測定ではなく主張になります。Railsの数字は別のランナーで出ているので同じ物差しには載りません
- shipped条件で実際に届いていたのは、CLAUDE.md・ルール・スキル・セッション開始時のダイジェスト注入(SessionStartフックは180セル全部で発火)です。編集のたびに`guren check`を走らせるPostToolUseフックはheadless実行では発火しませんでした(0/180、worktreeが未信頼扱いのため)。つまり計測したのは「セッション開始時の配達」だけで、効果はむしろ控えめに出ています
- 「bare」は情報ゼロではありません。コードと型定義は読めるので、SonnetやOpusは120ターンあれば`.d.ts`からほぼ全部を再構成できます
- 壁時計時間は同じマシンで他の作業も動いていたのでぶれています。コストはCLIのAPI換算値です
- 各セルはN=3です。タスク単位の差はぶれますが、集計の方向は3モデルとも、事前の較正ラウンドと本計測とも一致しました

## まとめ

あくまで個人的な意見になりますがまとめると、以下のようになります。

- モデルが知らないフレームワークでも、上位モデルは型定義から自力で解いてしまう。ハーネスの効果は「合否」ではなく「手数とコスト」に出る(ターン数−26〜28%、コスト−12〜25%)
- 安いモデルほど合否そのものが動く(Haikuで+5ポイント)
- 効くのは、`guren check`や`guren audit`のように**欠陥を名指しできる**コンテキスト。デバッグ系タスクでターン数が3割以上減った
- ハーネスが言及していないAPIは、120ターンあっても使われない。ダイジェストに載せるものが結果を決める

Railsが「今後調べる」と書いていた問いに対する、Gurenの上での答えは「効く、特にコンテキストが欠陥を名指しできる場面で」でした。次は、ダイジェストにヘルスチェックとリダイレクト安全化を足して2タスクを再計測すること、`paginate()`とバインディングの修正版で`api-posts-contract`と`post-slug-binding`を再計測すること、そして別ランナーで同じ行列を回すことです。

タスク(課題文・仕込みパッチ・隠しテスト・参照解)、実行スクリプト、360セル分のパッチと判定はリポジトリで、イベントストリーム全量はリリースの添付ファイルとして公開しています。

https://github.com/gurenjs/agents-on-guren

英語版のレポートはguren.devに掲載しています。

https://guren.dev/blog/agents-on-guren-the-first-benchmark-report
