<?php

declare(strict_types=1);

function webMugenCatalogConfig(array $server = []): array
{
    $documentRoot = rtrim((string)($server['DOCUMENT_ROOT'] ?? ''), '/\\');
    $scriptName = str_replace('\\', '/', (string)($server['SCRIPT_NAME'] ?? '/api/catalog.php'));
    $appPath = rtrim(dirname(dirname($scriptName)), '/');
    $scheme = (($server['HTTPS'] ?? '') !== '' && ($server['HTTPS'] ?? '') !== 'off') ? 'https' : 'http';
    $host = (string)($server['HTTP_HOST'] ?? 'localhost');
    return [
        'secret' => (string)(getenv('WEBMUGEN_CATALOG_SECRET') ?: ''),
        'storageDir' => (string)(getenv('WEBMUGEN_PROXY_STORAGE_DIR') ?: $documentRoot . '/DotoEita/16_proxy_release/storage/data'),
        'storagePublicBase' => rtrim((string)(getenv('WEBMUGEN_PROXY_STORAGE_PUBLIC_BASE') ?: '/DotoEita/16_proxy_release/storage/data'), '/'),
        'catalogPath' => (string)(getenv('WEBMUGEN_CATALOG_PATH') ?: dirname(__DIR__) . '/content/catalog.json'),
        'publicUrl' => rtrim((string)(getenv('WEBMUGEN_PUBLIC_URL') ?: $scheme . '://' . $host . $appPath . '/index.html'), '/'),
        'defaultStageId' => (string)(getenv('WEBMUGEN_DEFAULT_STAGE_ID') ?: 'cyber'),
    ];
}

function webMugenAuthorize(string $authorization, string $secret): bool
{
    if ($secret === '') return false;
    if (!preg_match('/^Bearer\s+(.+)$/i', trim($authorization), $match)) return false;
    return hash_equals($secret, trim($match[1]));
}

function webMugenInspectCharacterZip(string $zipPath): array
{
    if (!class_exists('ZipArchive')) {
        throw new RuntimeException('PHP ZipArchive extension is required.', 500);
    }
    $zip = new ZipArchive();
    $opened = $zip->open($zipPath);
    if ($opened !== true) throw new RuntimeException('ZIP is corrupt or unsupported.', 422);
    $candidates = [];
    try {
        for ($index = 0; $index < $zip->numFiles; $index++) {
            $name = (string)$zip->getNameIndex($index);
            if ($name === '' || str_ends_with($name, '/')) continue;
            $normalized = webMugenNormalizeArchivePath($name);
            if ($normalized === null || !str_ends_with(strtolower($normalized), '.def')) continue;
            $bytes = $zip->getFromIndex($index);
            if (!is_string($bytes)) continue;
            $candidate = webMugenInspectCharacterDef($normalized, webMugenDecodeText($bytes));
            if ($candidate !== null) $candidates[] = $candidate;
        }
    } finally {
        $zip->close();
    }
    if (count($candidates) === 0) throw new RuntimeException('ZIP contains no valid Character DEF.', 422);
    if (count($candidates) > 1) {
        throw new RuntimeException('ZIP contains multiple valid Character DEF files: ' . implode(', ', array_column($candidates, 'defPath')) . '.', 422);
    }
    return $candidates[0];
}

function webMugenInspectCharacterDef(string $path, string $text): ?array
{
    $sections = [];
    $section = null;
    foreach (preg_split('/\r\n|\r|\n/', preg_replace('/^\xEF\xBB\xBF/', '', $text) ?? $text) ?: [] as $rawLine) {
        $line = trim((string)(preg_replace('/;.*/', '', $rawLine) ?? ''));
        if ($line === '') continue;
        if (preg_match('/^\[([^]]+)]$/', $line, $match)) {
            $section = strtolower(trim($match[1]));
            if (!isset($sections[$section])) $sections[$section] = [];
            continue;
        }
        if ($section !== null && preg_match('/^([^=]+)=(.*)$/', $line, $match)) {
            $sections[$section][strtolower(trim($match[1]))] = trim(trim($match[2]), "\"'");
        }
    }
    $files = $sections['files'] ?? null;
    if (!isset($sections['info']) || !is_array($files)) return null;
    $hasState = isset($files['cns']) || isset($files['st']) || count(array_filter(array_keys($files), static fn(string $key): bool => preg_match('/^st\d+$/', $key) === 1)) > 0;
    if (!isset($files['cmd'], $files['anim']) || !$hasState) return null;
    $name = trim((string)($sections['info']['displayname'] ?? $sections['info']['name'] ?? pathinfo($path, PATHINFO_FILENAME)));
    return ['defPath' => $path, 'name' => $name !== '' ? $name : pathinfo($path, PATHINFO_FILENAME)];
}

function webMugenNormalizeArchivePath(string $path): ?string
{
    $segments = [];
    foreach (explode('/', str_replace('\\', '/', $path)) as $segment) {
        if ($segment === '' || $segment === '.') continue;
        if ($segment === '..') {
            if (count($segments) === 0) return null;
            array_pop($segments);
            continue;
        }
        $segments[] = $segment;
    }
    return implode('/', $segments);
}

function webMugenDecodeText(string $bytes): string
{
    if (function_exists('mb_check_encoding') && mb_check_encoding($bytes, 'UTF-8')) return $bytes;
    if (function_exists('mb_convert_encoding')) return mb_convert_encoding($bytes, 'UTF-8', 'SJIS-win');
    $converted = @iconv('CP932', 'UTF-8//IGNORE', $bytes);
    return is_string($converted) ? $converted : $bytes;
}

function webMugenScanCatalog(array $config): array
{
    $storageDir = realpath((string)$config['storageDir']);
    if ($storageDir === false || !is_dir($storageDir)) throw new RuntimeException('Configured proxy storage directory does not exist.', 500);
    $entries = [];
    $excluded = [];
    foreach (new DirectoryIterator($storageDir) as $file) {
        if (!$file->isFile() || strtolower($file->getExtension()) !== 'zip') continue;
        try {
            $entries[] = webMugenCatalogEntryForZip($file->getPathname(), $config);
        } catch (Throwable $error) {
            $excluded[] = ['file' => $file->getFilename(), 'code' => 'character.invalid', 'message' => $error->getMessage()];
        }
    }
    usort($entries, static fn(array $left, array $right): int => strcmp($left['id'], $right['id']));
    return ['entries' => $entries, 'excluded' => $excluded];
}

function webMugenCatalogEntryForZip(string $zipPath, array $config, ?string $publicationId = null): array
{
    $storageRoot = realpath((string)$config['storageDir']);
    $resolved = realpath($zipPath);
    if ($storageRoot === false || $resolved === false || !is_file($resolved) || !webMugenPathIsInside($resolved, $storageRoot)) {
        throw new RuntimeException('Character archive is outside the configured storage root.', 403);
    }
    $inspection = webMugenInspectCharacterZip($resolved);
    $fileName = basename($resolved);
    $publicId = $publicationId ?? webMugenPublicationIdFromFileName($fileName);
    $id = $publicId !== null
        ? 'proxy-release-' . strtolower($publicId)
        : 'proxy-release-' . substr(hash_file('sha256', $resolved), 0, 20);
    return [
        'id' => $id,
        'kind' => 'character',
        'engine' => 'winmugen',
        'source' => 'external',
        'name' => $inspection['name'],
        'path' => rtrim((string)$config['storagePublicBase'], '/') . '/' . rawurlencode($fileName),
    ];
}

function webMugenPublicationIdFromFileName(string $fileName): ?string
{
    return preg_match('/^material-([0-9]+)-archive\.[^.]+$/i', $fileName, $match) ? $match[1] : null;
}

function webMugenFindPublicationArchive(array $config, string $publicationId): string
{
    if (!preg_match('/^[0-9]+$/', $publicationId)) throw new RuntimeException('publicationId must be numeric.', 400);
    $matches = glob(rtrim((string)$config['storageDir'], '/\\') . DIRECTORY_SEPARATOR . 'material-' . $publicationId . '-archive.*') ?: [];
    $matches = array_values(array_filter($matches, static fn(string $path): bool => strtolower(pathinfo($path, PATHINFO_EXTENSION)) === 'zip'));
    if (count($matches) !== 1) throw new RuntimeException('Published Character ZIP was not found uniquely.', 404);
    return $matches[0];
}

function webMugenRebuildCatalog(array $config): array
{
    $scan = webMugenScanCatalog($config);
    $catalog = webMugenReadCatalog((string)$config['catalogPath']);
    $preserved = array_values(array_filter($catalog['items'], static fn(array $item): bool => !str_starts_with((string)($item['id'] ?? ''), 'proxy-release-')));
    $document = ['version' => 1, 'items' => array_merge($preserved, $scan['entries'])];
    webMugenWriteCatalogAtomic((string)$config['catalogPath'], $document);
    return ['catalog' => $document, 'entries' => $scan['entries'], 'excluded' => $scan['excluded']];
}

function webMugenPublishCharacter(array $config, string $publicationId, ?string $stageId = null): array
{
    $entry = webMugenCatalogEntryForZip(webMugenFindPublicationArchive($config, $publicationId), $config, $publicationId);
    $catalog = webMugenReadCatalog((string)$config['catalogPath']);
    $items = array_values(array_filter($catalog['items'], static fn(array $item): bool => ($item['id'] ?? null) !== $entry['id']));
    $items[] = $entry;
    $document = ['version' => 1, 'items' => $items];
    webMugenWriteCatalogAtomic((string)$config['catalogPath'], $document);
    return [
        'entry' => $entry,
        'playUrl' => webMugenBuildPlayUrl($config, $document, $entry['id'], $stageId ?? (string)$config['defaultStageId']),
    ];
}

function webMugenBuildPlayUrl(array $config, array $catalog, string $characterId, string $stageId): string
{
    $character = false;
    $stage = false;
    foreach ($catalog['items'] ?? [] as $item) {
        if (($item['id'] ?? null) === $characterId && ($item['kind'] ?? null) === 'character') $character = true;
        if (($item['id'] ?? null) === $stageId && ($item['kind'] ?? null) === 'stage') $stage = true;
    }
    if (!$character) throw new RuntimeException('characterId is not present as a Character in the Catalog.', 404);
    if (!$stage) throw new RuntimeException('stageId is not present as a Stage in the Catalog.', 404);
    $separator = str_contains((string)$config['publicUrl'], '?') ? '&' : '?';
    return (string)$config['publicUrl'] . $separator . http_build_query(['character' => $characterId, 'stage' => $stageId], '', '&', PHP_QUERY_RFC3986);
}

function webMugenReadCatalog(string $path): array
{
    if (!is_file($path)) throw new RuntimeException('Catalog file does not exist.', 500);
    $decoded = json_decode((string)file_get_contents($path), true);
    webMugenValidateCatalog($decoded);
    return $decoded;
}

function webMugenValidateCatalog(mixed $catalog): void
{
    if (!is_array($catalog) || ($catalog['version'] ?? null) !== 1 || !isset($catalog['items']) || !is_array($catalog['items'])) {
        throw new RuntimeException('Catalog must be a version 1 document with an items array.', 500);
    }
    $ids = [];
    foreach ($catalog['items'] as $item) {
        if (!is_array($item)) throw new RuntimeException('Catalog item must be an object.', 500);
        $id = (string)($item['id'] ?? '');
        $path = (string)($item['path'] ?? '');
        if (!preg_match('/^[a-z0-9][a-z0-9_-]{0,63}$/i', $id)) throw new RuntimeException('Catalog item has an invalid ID.', 500);
        if (isset($ids[strtolower($id)])) throw new RuntimeException('Catalog contains a duplicate ID.', 500);
        if (!isset($item['name'], $item['kind'], $item['engine']) || trim((string)$item['name']) === '') throw new RuntimeException('Catalog item is incomplete.', 500);
        if (str_contains(str_replace('\\', '/', $path), '/../') || str_contains($path, '://')) throw new RuntimeException('Catalog item has an unsafe path.', 500);
        $ids[strtolower($id)] = true;
    }
}

function webMugenWriteCatalogAtomic(string $path, array $catalog, ?callable $beforeReplace = null): void
{
    webMugenValidateCatalog($catalog);
    $directory = dirname($path);
    if (!is_dir($directory) || !is_writable($directory)) throw new RuntimeException('Catalog directory is not writable.', 500);
    $temporary = tempnam($directory, '.catalog-');
    if ($temporary === false) throw new RuntimeException('Catalog temporary file could not be created.', 500);
    try {
        $json = json_encode($catalog, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR) . "\n";
        if (file_put_contents($temporary, $json, LOCK_EX) === false) throw new RuntimeException('Catalog temporary file could not be written.', 500);
        webMugenValidateCatalog(json_decode((string)file_get_contents($temporary), true));
        if ($beforeReplace !== null) $beforeReplace($temporary, $path);
        if (DIRECTORY_SEPARATOR === '\\' && is_file($path)) {
            $backup = $path . '.replace-backup';
            if (is_file($backup)) @unlink($backup);
            if (!rename($path, $backup)) throw new RuntimeException('Existing Catalog could not be prepared for replacement.', 500);
            if (!rename($temporary, $path)) {
                @rename($backup, $path);
                throw new RuntimeException('Catalog atomic replacement failed.', 500);
            }
            @unlink($backup);
        } elseif (!rename($temporary, $path)) {
            throw new RuntimeException('Catalog atomic replacement failed.', 500);
        }
    } finally {
        if (is_file($temporary)) @unlink($temporary);
    }
}

function webMugenPathIsInside(string $path, string $root): bool
{
    $path = rtrim(str_replace('\\', '/', $path), '/');
    $root = rtrim(str_replace('\\', '/', $root), '/');
    return strcasecmp($path, $root) === 0 || strncasecmp($path, $root . '/', strlen($root) + 1) === 0;
}
