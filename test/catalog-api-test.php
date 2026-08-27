<?php

declare(strict_types=1);

require_once __DIR__ . '/../public/api/catalog-lib.php';

$root = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'webmugen-catalog-' . bin2hex(random_bytes(6));
$storage = $root . DIRECTORY_SEPARATOR . 'storage';
$content = $root . DIRECTORY_SEPARATOR . 'content';
mkdir($storage, 0777, true);
mkdir($content, 0777, true);

try {
    $characterDef = static fn(string $name): string => "[Info]\nname = \"{$name}\"\n[Files]\ncmd = fighter.cmd\ncns = fighter.cns\nanim = fighter.air\n";
    createZip($storage . '/material-1-archive.zip', ['foo.def' => $characterDef('Root Fighter')]);
    createZip($storage . '/material-2-archive.zip', ['itoko/itoko.def' => $characterDef('Nested Fighter')]);
    createZip($storage . '/material-3-archive.zip', [
        'different-name/stage.def' => "[Info]\nname=Arena\n[Camera]\n[PlayerInfo]\n[Bound]\n[BGDef]\n",
        'different-name/subfolder/character.def' => $characterDef('Different Fighter'),
    ]);
    createZip($storage . '/material-4-archive.zip', ['a.def' => $characterDef('A'), 'b/b.def' => $characterDef('B')]);
    createZip($storage . '/material-5-archive.zip', ['system.def' => "[Info]\nname=System\n[Files]\nspr=system.sff\n"]);
    file_put_contents($storage . '/material-6-archive.zip', 'broken');
    createZip($storage . '/material-7-archive.zip', [
        'arena/arena.def' => "[Info]\nname=Published Arena\n[Camera]\n[PlayerInfo]\n[Bound]\n[BGDef]\nspr=arena.sff\n",
    ]);
    createZip($storage . '/uploaded_938472.zip', ['package/sub/character.def' => $characterDef('Arbitrary Name Fighter')]);
    createZip($root . '/outside.zip', ['outside.def' => $characterDef('Outside Fighter')]);

    $catalogPath = $content . '/catalog.json';
    $builtin = ['version' => 1, 'items' => [
        [
            'id' => 't-h-m-a', 'name' => 'T-H-M-A', 'kind' => 'character', 'engine' => 'winmugen',
            'source' => 'builtin', 'path' => '/chars/T-H-M-A.zip',
        ],
        [
            'id' => 'cyber', 'name' => 'Cyber', 'kind' => 'stage', 'engine' => 'webmugen',
            'source' => 'builtin', 'path' => 'builtin:stage:cyber',
        ],
        [
            'id' => 'default-cyber', 'name' => 'Cyber HUD', 'kind' => 'lifebar', 'engine' => 'webmugen',
            'source' => 'builtin', 'path' => 'builtin:lifebar:default-cyber',
        ],
    ]];
    file_put_contents($catalogPath, json_encode($builtin, JSON_PRETTY_PRINT));
    $config = [
        'storageDir' => $storage,
        'storagePublicBase' => '/DotoEita/16_proxy_release/storage/data',
        'catalogPath' => $catalogPath,
        'publicUrl' => 'https://example.test/DotoEita/50_WebMUGEN/index.html',
        'defaultStageId' => 'cyber',
        'defaultCharacterId' => 't-h-m-a',
    ];

    $rebuilt = webMugenRebuildCatalog($config);
    assertSame(6, count($rebuilt['entries']), 'valid Character and Stage ZIPs are registered regardless of file name');
    assertSame(2, count($rebuilt['excluded']), 'unknown and corrupt ZIPs are excluded');
    assertSame(1, count(array_filter($rebuilt['entries'], static fn(array $entry): bool => $entry['path'] === '/DotoEita/16_proxy_release/storage/data/uploaded_938472.zip')), 'rebuild scans an arbitrary ZIP filename');
    assertSame('different-name/subfolder/character.def', webMugenInspectCharacterZip($storage . '/material-3-archive.zip')['defPath'], 'Character DEF is selected by structure');
    assertSame('a.def', webMugenInspectCharacterZip($storage . '/material-4-archive.zip')['defPath'], 'shallowest Character DEF wins');
    assertSame('arena/arena.def', webMugenInspectStageZip($storage . '/material-7-archive.zip')['defPath'], 'Stage DEF is detected by structure');
    assertSame('t-h-m-a', webMugenReadCatalog($catalogPath)['items'][0]['id'], 'built-in Character is preserved');
    assertSame('cyber', webMugenReadCatalog($catalogPath)['items'][1]['id'], 'built-in Stage is preserved');
    assertSame('default-cyber', webMugenReadCatalog($catalogPath)['items'][2]['id'], 'built-in LifeBar is preserved');

    $second = webMugenRebuildCatalog($config);
    assertSame(array_column($rebuilt['entries'], 'id'), array_column($second['entries'], 'id'), 'rebuild keeps IDs stable');
    if (DIRECTORY_SEPARATOR !== '\\') {
        clearstatcache(true, $catalogPath);
        assertSame(0644, fileperms($catalogPath) & 0777, 'rebuild makes the Catalog publicly readable');
    }
    $published = webMugenPublishCharacter($config, '123', 'uploaded_938472.zip');
    assertSame('proxy-release-123', $published['entry']['id'], 'publication ID is independent from the archive filename');
    assertSame('/DotoEita/16_proxy_release/storage/data/uploaded_938472.zip', $published['entry']['path'], 'the actual archive filename is retained in the Catalog path');
    assertSame(
        'https://example.test/DotoEita/50_WebMUGEN/index.html?character=proxy-release-123&stage=cyber',
        $published['playUrl'],
        'play URL uses the WebMUGEN query contract',
    );
    $publishedStage = webMugenPublishStage($config, '7', 'material-7-archive.zip');
    assertSame('proxy-release-7', $publishedStage['entry']['id'], 'Stage uses the stable publication ID');
    assertSame('stage', $publishedStage['entry']['kind'], 'Stage Catalog kind is retained');
    assertSame(
        'https://example.test/DotoEita/50_WebMUGEN/index.html?character=t-h-m-a&stage=proxy-release-7',
        $publishedStage['playUrl'],
        'Stage play URL uses the configured default Character',
    );

    $draft = webMugenReadCatalog($catalogPath);
    $draft["items"][0]["name"] = 'Edited in GUI';
    $draftRevision = webMugenCatalogRevision($catalogPath);
    $savedDraft = webMugenSaveCatalog($config, $draft, $draftRevision);
    assertSame(count($draft['items']), $savedDraft['itemCount'], 'GUI draft save reports the complete item count');
    assertSame('Edited in GUI', webMugenReadCatalog($catalogPath)['items'][0]['name'], 'GUI draft save replaces the server Catalog');
    assertSame(webMugenCatalogRevision($catalogPath), $savedDraft['revision'], 'GUI draft save returns the written revision');
    if (DIRECTORY_SEPARATOR !== '\\') {
        clearstatcache(true, $catalogPath);
        assertSame(0644, fileperms($catalogPath) & 0777, 'GUI draft save keeps the Catalog publicly readable');
    }

    $beforeInvalidDraft = (string)file_get_contents($catalogPath);
    $duplicateDraft = $draft;
    $duplicateDraft['items'][] = $duplicateDraft['items'][0];
    try {
        webMugenSaveCatalog($config, $duplicateDraft, webMugenCatalogRevision($catalogPath));
        throw new RuntimeException('expected duplicate draft rejection');
    } catch (RuntimeException $error) {
        assertSame(422, $error->getCode(), 'duplicate GUI draft is rejected as invalid');
    }
    assertSame($beforeInvalidDraft, (string)file_get_contents($catalogPath), 'invalid GUI draft leaves the Catalog unchanged');

    $staleRevision = webMugenCatalogRevision($catalogPath);
    $newerCatalog = webMugenReadCatalog($catalogPath);
    $newerCatalog['items'][0]['name'] = 'Changed by another publisher';
    webMugenWriteCatalogAtomic($catalogPath, $newerCatalog);
    try {
        webMugenSaveCatalog($config, $draft, $staleRevision);
        throw new RuntimeException('expected stale GUI draft conflict');
    } catch (RuntimeException $error) {
        assertSame(409, $error->getCode(), 'stale GUI draft is rejected as a conflict');
    }
    assertSame('Changed by another publisher', webMugenReadCatalog($catalogPath)['items'][0]['name'], 'conflict keeps the newer server Catalog');

    foreach (['../uploaded_938472.zip', 'sub/uploaded_938472.zip', 'sub\\uploaded_938472.zip', 'https://example.test/fighter.zip'] as $unsafeArchive) {
        try {
            webMugenPublicationArchivePath($config, $unsafeArchive);
            throw new RuntimeException('expected unsafe archiveFile rejection');
        } catch (RuntimeException $error) {
            assertSame('archiveFile must be a safe ZIP basename.', $error->getMessage(), 'unsafe archiveFile is rejected');
        }
    }
    try {
        webMugenCatalogEntryForZip($root . '/outside.zip', $config, '125');
        throw new RuntimeException('expected storage root rejection');
    } catch (RuntimeException $error) {
        assertSame('Published archive is outside the configured storage root.', $error->getMessage(), 'storage root escape is rejected');
    }

    $beforeInvalidStage = (string)file_get_contents($catalogPath);
    try {
        webMugenPublishCharacter($config, '124', 'uploaded_938472.zip', 'missing-stage');
        throw new RuntimeException('expected missing Stage rejection');
    } catch (RuntimeException $error) {
        assertSame('stageId is not present as a Stage in the Catalog.', $error->getMessage(), 'missing Stage is rejected before writing');
    }
    assertSame($beforeInvalidStage, (string)file_get_contents($catalogPath), 'invalid Stage leaves the Catalog unchanged');

    $before = (string)file_get_contents($catalogPath);
    try {
        webMugenWriteCatalogAtomic($catalogPath, $builtin, static function (): void {
            throw new RuntimeException('simulated pre-replace failure');
        });
        throw new RuntimeException('expected simulated write failure');
    } catch (RuntimeException $error) {
        assertSame('simulated pre-replace failure', $error->getMessage(), 'simulated failure is observed');
    }
    assertSame($before, (string)file_get_contents($catalogPath), 'failed update leaves current Catalog unchanged');

    $chmodCall = null;
    webMugenWriteCatalogAtomic(
        $catalogPath,
        $builtin,
        null,
        static function (string $path, int $mode) use (&$chmodCall): bool {
            $chmodCall = [$path, $mode];
            return true;
        },
    );
    assertSame([$catalogPath, 0644], $chmodCall, 'atomic replacement applies public permissions to the final Catalog path');

    $warnings = [];
    webMugenWriteCatalogAtomic(
        $catalogPath,
        $builtin,
        null,
        static fn(string $path, int $mode): bool => false,
        static function (string $message) use (&$warnings): void {
            $warnings[] = $message;
        },
    );
    assertSame(1, count($warnings), 'chmod failure emits one warning');
    assertSame(true, str_contains($warnings[0], 'failed to set generated Catalog permissions to 0644'), 'chmod warning identifies the failed mode');
    assertSame($builtin, webMugenReadCatalog($catalogPath), 'chmod failure does not discard the successfully replaced Catalog');

    echo "catalog-api-test: PASS\n";
} finally {
    removeTree($root);
}

function createZip(string $path, array $entries): void
{
    $zip = new ZipArchive();
    if ($zip->open($path, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) throw new RuntimeException('fixture ZIP creation failed');
    foreach ($entries as $name => $contents) $zip->addFromString($name, $contents);
    $zip->close();
}

function assertSame(mixed $expected, mixed $actual, string $label): void
{
    if ($expected !== $actual) throw new RuntimeException($label . ': expected ' . var_export($expected, true) . ', got ' . var_export($actual, true));
}

function removeTree(string $path): void
{
    if (!is_dir($path)) return;
    $items = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($path, FilesystemIterator::SKIP_DOTS), RecursiveIteratorIterator::CHILD_FIRST);
    foreach ($items as $item) $item->isDir() ? rmdir($item->getPathname()) : unlink($item->getPathname());
    rmdir($path);
}
