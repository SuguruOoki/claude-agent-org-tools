# claude-agent-org-tools

> [English](./README.md)

Claude Code Agent Team 向けの組織論ベースツール集。

製造業・ソフトウェア工学の組織パターンから導出した4つのツールを提供します。

| ツール | 由来 | 目的 |
|--------|------|------|
| **Andon Signal** | トヨタ生産方式 | 緊急停止。全エージェントの書き込みをブロック |
| **Team Topology Protocol** | Team Topologies (Skelton & Pais) | ファイル所有権の境界を強制 |
| **RACI Auto-Router** | RACIマトリクス | タスク完了通知を役割別にルーティング |
| **Organizational Memory** | アジャイルレトロスペクティブ | セッション終了時にふりかえりを自動生成 |

## クイックスタート

```bash
cd your-project

# npm
npx claude-agent-org-tools init

# pnpm
pnpm dlx claude-agent-org-tools init

# yarn
yarn dlx claude-agent-org-tools init

# bun
bunx claude-agent-org-tools init
```

このコマンド1つで以下が完了します：
1. フックスクリプトを `.claude/hooks/org-tools.mjs` に配置
2. `.claude/org-tools/config.json` をデフォルト設定で生成
3. `.claude/settings.json` にフック定義を安全にマージ（既存のフックは壊しません）

## デフォルトの有効/無効

| ツール | デフォルト | 理由 |
|--------|-----------|------|
| Andon Signal | ON | 設定不要。andonファイルがなければ何も起きない |
| Organizational Memory | ON | 設定不要。セッション終了時にレトロスペクティブを生成 |
| Team Topology | OFF | `topology.json` にエージェントの所有権マップが必要 |
| RACI Auto-Router | OFF | `raci.json` にルーティングマトリクスが必要 |

## CLIコマンド

```bash
claude-org init                          # プロジェクトを初期化
claude-org status                        # ツールの状態を表示
claude-org enable <tool>                 # 有効化: andon|topology|raci|orgMemory
claude-org disable <tool>               # 無効化
claude-org andon <team> "理由"           # 緊急停止を発動
claude-org andon <team> --release        # 緊急停止を解除
claude-org andon <team> "理由" --severity warning  # 警告のみ（ブロックなし）
```

## 動作の仕組み

1つのJavaScriptファイル（`.claude/hooks/org-tools.mjs`）がすべてのフックイベントを処理します。

```
PreToolUse (Write|Edit|Bash)  → Andonチェック + Topology境界チェック
PostToolUse (TaskUpdate)      → RACIルーティング提案
Stop                          → レトロスペクティブ生成
```

ツールのON/OFFは `.claude/org-tools/config.json` で制御します。`settings.json` を直接編集する必要はありません。

## ツール詳細

### Andon Signal（緊急停止）

クリティカルな問題を検出した際に緊急停止を発動します：

```bash
claude-org andon backend "DBスキーマ変更が進行中"
```

`.claude/org-tools/andon/backend.json` が作成されます。このファイルが存在する間、すべての `Write`、`Edit`、`Bash` ツール呼び出しがブロック（exit code 2）されます。

解決したら解除：

```bash
claude-org andon backend --release
```

### Team Topology Protocol（チーム境界）

`.claude/org-tools/topology.json` にエージェントのファイル所有権を定義します：

```json
{
  "agents": [
    {
      "name": "frontend",
      "type": "stream-aligned",
      "owns": ["src/frontend/**", "src/components/**"],
      "interactionMode": "collaboration"
    },
    {
      "name": "platform",
      "type": "platform",
      "owns": ["infra/**"],
      "interactionMode": "facilitating"
    }
  ]
}
```

- `facilitating` モード：所有ファイルへのWrite/Editは**ブロック**
- `collaboration` モード：チーム間の書き込みは**警告**を出力（v0.1）

設定ファイルを作成後に有効化：

```bash
claude-org enable topology
```

### RACI Auto-Router（ルーティング）

`.claude/org-tools/raci.json` にルーティングルールを定義します：

```json
{
  "matrix": [
    {
      "taskPattern": "deploy.*production",
      "responsible": "sre",
      "accountable": "tech-lead",
      "consulted": ["qa"],
      "informed": ["product-manager"]
    }
  ]
}
```

`TaskUpdate` で status が `completed` に設定され、subject がパターンにマッチすると、ルーティング提案が `.claude/org-tools/raci-suggestions.jsonl` に記録されます。

v0.1 はログ出力のみです。チームリーダーがログを読んで手動でメッセージを送信する運用です。

設定ファイルを作成後に有効化：

```bash
claude-org enable raci
```

### Organizational Memory（組織記憶）

セッション終了時（`Stop` フック）に、アクティブなチームごとにMarkdownレトロスペクティブを生成します：

```
.claude/org-tools/retrospectives/{team-name}-{date}.md
```

含まれる内容：
- タスク完了統計
- タスクごとのステータス一覧
- 所見（全完了、失敗、未完了の状況）

## ファイル構成

```
.claude/
  hooks/
    org-tools.mjs             # 単一フックエントリポイント（自動生成）
  org-tools/
    config.json               # ツール有効/無効の設定
    andon/                    # Andonシグナルファイル（チーム別）
    retrospectives/           # 生成されたレトロスペクティブ
    topology.json             # [ユーザー作成] エージェント所有権マップ
    raci.json                 # [ユーザー作成] RACIルーティングマトリクス
    raci-suggestions.jsonl    # [自動生成] RACIルーティングログ
```

## 必要環境

- Node.js >= 18（または Bun >= 1.0）
- Claude Code（hooks対応版）

## 開発

```bash
bun install
bun test
bun run build   # TypeScriptをdist/にコンパイル
```

## ライセンス

MIT
