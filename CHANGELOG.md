# Changelog

## 0.6.8 - 2026-09-02

- Exposed the production DEF, text decoding, compatibility, and SFF sprite pipeline through a browser-safe integration entry point for Proxy Release previews.
- Kept ACT selection and SFF v1/v2 palette behavior on the same implementation used by the WebMUGEN character runtime.

## 0.6.7 - 2026-09-02

- Added opaque 128-bit Catalog IDs for unlisted proxy-release play URLs while retaining numeric publication IDs as server-only lifecycle keys.
- Preserved opaque IDs across re-registration, deletion, and Catalog rebuilds, including replacement of legacy numeric entries.

## 0.6.6 - 2026-09-02

- Added backward-compatible `public` / `unlisted` Catalog visibility independent from Catalog membership.
- Excluded unlisted content from normal selectors and fallbacks while allowing exact Character/Stage IDs from dedicated play URLs.
- Preserved proxy entry visibility across authenticated publication and Catalog rebuilds.

## 0.6.5 - 2026-09-02

- Added authenticated, idempotent deletion of proxy-release Catalog entries for temporary-publication cleanup.

## 0.6.0 - 2026-08-25

- Added authenticated proxy-release Stage publication with stable Catalog IDs and playable Character/Stage URLs.
- Made Character and Stage ZIP DEF selection deterministic by preferring the shallowest and simplest valid definition.

## Unreleased

- Initial project structure.
- HTML documentation policy.
- Architecture and design philosophy notes.
