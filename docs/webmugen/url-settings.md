# URL content settings

WebMUGEN accepts catalog IDs in the query string:

```text
https://example.com/webmugen/?character=t-h-m-a&stage=fresh
```

`character` must name a character entry and `stage` must name a stage entry in the publisher's validated content catalog. The values are IDs, not paths or URLs. Find valid IDs in `public/content/catalog.json` or in the Settings content selectors.

Startup priority is `URL query > localStorage user settings > default-settings.json > compiled fallback`. A partial URL changes only that content type. For example, `?character=kfm` keeps the stored/default stage, audio, input, and display settings.

URL selections are session overrides and are not automatically written to localStorage. Reloading the same URL reapplies them; opening the application without the query returns to the earlier stored selections. Selecting content in Settings is an explicit user action and becomes the new stored choice.

Unknown IDs, wrong-kind IDs, empty or overlong values, and duplicate keys are ignored, falling back to the stored/default selection. Examples such as `?character=../../file`, `?stage=https://example.com/x`, or `?character=fresh` cannot cause arbitrary loading. Development mode appends the acceptance/fallback diagnostic to the catalog status; public mode does not expose that detail.
