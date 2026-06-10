# CNS Parser

CNS parser converts WinMUGEN / MUGEN 1.0 / MUGEN 1.1 style CNS text into WebMUGEN internal definitions.

Implementation order:

1. Section parser: `[StateDef n]`, `[State ...]`
2. Key-value parser
3. Trigger collection
4. Simple expression parser
5. Controller-specific normalization
