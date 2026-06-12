# KFM character assets

Place KFM files here for the Phase23 loading experiment.

Expected example:

```text
public/chars/kfm/
  kfm.def
  kfm.cns
  kfm.cmd
  kfm.air
  kfm.sff
```

The app tries to load:

```text
/chars/kfm/kfm.def
```

If loading fails, it falls back to the built-in sample character.
