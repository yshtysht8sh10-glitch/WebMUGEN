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
    createZip($storage . '/uploaded_938472.zip', ['package/sub/character.def' => $characterDef('Arbitrary Name Fighter')]);
    createZip($root . '/outside.zip', ['outside.def' => $characterDef('Outside Fighter')]);

    $catalogPath = $content . '/catalog.json';
    $builtin = ['version' => 1, 'items' => [
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
        'publicUrl' => 'https://example.test/DotoEita/50_WEBMUGEN/index.html',
        'defaultStageId' => 'cyber',
    ];

    $rebuilt = webMugenRebuildCatalog($config);
    assertSame(4, count($rebuilt['entries']), 'all four valid Character ZIPs are registered regardless of file name');
    assertSame(3, count($rebuilt['excluded']), 'ambiguous, non-Character, and corrupt ZIPs are excluded');
    assertSame(1, count(array_filter($rebuilt['entries'], static fn(array $entry): bool => $entry['path'] === '/DotoEita/16_proxy_release/storage/data/uploaded_938472.zip')), 'rebuild scans an arbitrary ZIP filename');
    assertSame('different-name/subfolder/character.def', webMugenInspectCharacterZip($storage . '/material-3-archive.zip')['defPath'], 'Character DEF is selected by structure');
    assertSame('cyber', webMugenReadCatalog($catalogPath)['items'][0]['id'], 'built-in entry is preserved');
    assertSame('default-cyber', webMugenReadCatalog($catalogPath)['items'][1]['id'], 'built-in LifeBar is preserved');

    $second = webMugenRebuildCatalog($config);
    assertSame(array_column($rebuilt['entries'], 'id'), array_column($second['entries'], 'id'), 'rebuild keeps IDs stable');
    $published = webMugenPublishCharacter($config, '123', 'uploaded_938472.zip');
    assertSame('proxy-release-123', $published['entry']['id'], 'publication ID is independent from the archive filename');
    assertSame('/DotoEita/16_proxy_release/storage/data/uploaded_938472.zip', $published['entry']['path'], 'the actual archive filename is retained in the Catalog path');
    assertSame(
        'https://example.test/DotoEita/50_WEBMUGEN/index.html?character=proxy-release-123&stage=cyber',
        $published['playUrl'],
        'play URL uses the WebMUGEN query contract',
    );

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
        assertSame('Character archive is outside the configured storage root.', $error->getMessage(), 'storage root escape is rejected');
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
