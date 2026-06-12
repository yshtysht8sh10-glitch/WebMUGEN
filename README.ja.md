# WebMUGEN

WebMUGEN は、TypeScript + React + Vite で作る、ブラウザ上で動く MUGEN 互換格闘ゲームエンジンの実験プロジェクトです。

最終的には、`kfm.zip` のような MUGEN キャラクターパッケージを読み込み、`.def`、`.air`、`.cns`、`.cmd`、`.sff` などを解釈して、ブラウザ上でキャラクターを動かすことを目標にしています。

## 現在の到達点

ここまでに実装している主な要素は以下です。

- CNS パーサ
- ステートマシン
- 基本 Trigger
- State Controller
- HitDef
- 被弾 State
- AIR パーサ
- Clsn1 / Clsn2 パーサ
- Clsn ベースのヒット判定
- CMD パーサ
- 入力バッファ
- 必殺技コマンド State
- Projectile Controller
- SpritePack レンダラー試作

まだ描画・物理・MUGEN互換性は簡易実装です。SFF、SND、Helper、Guard、Round 管理などは今後のフェーズで対応予定です。

## 目指している読み込み構造

```text
character.zip
  ├─ character.def
  ├─ character.air
  ├─ character.cns
  ├─ character.cmd
  ├─ character.sff
  └─ character.snd

↓

WebMUGEN loader
↓
DefDocument / AirDocument / CnsDocument / CmdDocument / SffDocument
↓
Game loop
↓
Canvas renderer
```

つまり、MUGEN キャラクターを Web 上で動かすためのエンジンを作っています。

## 開発方法

```powershell
npm install
npm test
npm run dev
```

## ドキュメント

ドキュメントは、読みやすさを重視して単独 HTML ファイルとして管理します。

- [WebMUGEN Docs](docs/webmugen/index.html)
- [WinMUGEN Spec Notes](docs/mugen-spec/winmugen/index.html)
- [English README](README.md)
