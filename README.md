# WebMUGEN

WebMUGEN is an experimental browser-based MUGEN-compatible fighting game engine built with TypeScript, React, and Vite.

The long-term goal is to load MUGEN character packages such as `kfm.zip`, read files like `.def`, `.air`, `.cns`, `.cmd`, `.sff`, and run the character inside a web browser.

## Current status

Implemented so far:

- CNS parser
- State machine
- Basic triggers
- State controllers
- HitDef
- Hit states
- AIR parser
- Clsn1 / Clsn2 parser
- Clsn-based hit detection
- CMD parser
- Input buffer
- Special command state
- Projectile controller
- SpritePack renderer prototype

The engine still uses a simplified renderer and simplified physics. Full SFF/SND/Helper/Guard/Round support is planned for later phases.

## Project direction

The target loading flow is:

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

## Development

```powershell
npm install
npm test
npm run dev
```

## Documentation

Documentation is written as standalone HTML files.

- [WebMUGEN Docs](docs/webmugen/index.html)
- [WinMUGEN Spec Notes](docs/mugen-spec/winmugen/index.html)
- [日本語 README](README.ja.md)
