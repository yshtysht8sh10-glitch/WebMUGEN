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

    $catalogPath = $content . '/catalog.json';
    $builtin = ['version' => 1, 'items' => [[
        'id' => 'cyber', 'name' => 'Cyber', 'kind' => 'stage', 'engine' => 'webmugen',
        'source' => 'builtin', 'path' => 'builtin:stage:cyber',
    ]]];
    file_put_contents($catalogPath, json_encode($builtin, JSON_PRETTY_PRINT));
    $config = [
        'storageDir' => $storage,
        'storagePublicBase' => '/DotoEita/16_proxy_release/storage/data',
        'catalogPath' => $catalogPath,
        'publicUrl' => 'https://example.test/DotoEita/50_WEBMUGEN/index.html',
        'defaultStageId' => 'cyber',
    ];

    $rebuilt = webMugenRebuildCatalog($config);
    assertSame(3, count($rebuilt['entries']), 'three valid Character ZIPs are registered');
    assertSame(3, count($rebuilt['excluded']), 'ambiguous, non-Character, and corrupt ZIPs are excluded');
    assertSame(['proxy-release-1', 'proxy-release-2', 'proxy-release-3'], array_column($rebuilt['entries'], 'id'), 'publication IDs are stable Catalog IDs');
    assertSame('different-name/subfolder/character.def', webMugenInspectCharacterZip($storage . '/material-3-archive.zip')['defPath'], 'Character DEF is selected by structure');
    assertSame('cyber', webMugenReadCatalog($catalogPath)['items'][0]['id'], 'built-in entry is preserved');

    $second = webMugenRebuildCatalog($config);
    assertSame(array_column($rebuilt['entries'], 'id'), array_column($second['entries'], 'id'), 'rebuild keeps IDs stable');
    $published = webMugenPublishCharacter($config, '3');
    assertSame('proxy-release-3', $published['entry']['id'], 'single publish returns target Character ID');
    assertSame(
        'https://example.test/DotoEita/50_WEBMUGEN/index.html?character=proxy-release-3&stage=cyber',
        $published['playUrl'],
        'play URL uses the WebMUGEN query contract',
    );

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
