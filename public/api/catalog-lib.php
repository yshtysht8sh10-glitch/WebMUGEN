<?php

declare(strict_types=1);

function webMugenCatalogConfig(array $server = []): array
{
    $documentRoot = rtrim((string)($server['DOCUMENT_ROOT'] ?? ''), '/\\');
    $scriptName = str_replace('\\', '/', (string)($server['SCRIPT_NAME'] ?? '/api/catalog.php'));
    $appPath = rtrim(dirname(dirname($scriptName)), '/');
    $scheme = (($server['HTTPS'] ?? '') !== '' && ($server['HTTPS'] ?? '') !== 'off') ? 'https' : 'http';
    $host = (string)($server['HTTP_HOST'] ?? 'localhost');
    $security = webMugenCatalogSecurityState();
    return [
        'secret' => $security['secret'],
        'secretSource' => $security['secretSource'],
        'debug' => $security['debug'],
        'configFilePath' => $security['configFilePath'],
        'configFileExists' => $security['configFileExists'],
        'configFileReadable' => $security['configFileReadable'],
        'configFileLoaded' => $security['configFileLoaded'],
        'storageDir' => (string)(getenv('WEBMUGEN_PROXY_STORAGE_DIR') ?: $documentRoot . '/DotoEita/16_proxy_release/storage/data'),
        'storagePublicBase' => rtrim((string)(getenv('WEBMUGEN_PROXY_STORAGE_PUBLIC_BASE') ?: '/DotoEita/16_proxy_release/storage/data'), '/'),
        'catalogPath' => (string)(getenv('WEBMUGEN_CATALOG_PATH') ?: dirname(__DIR__) . '/content/catalog.json'),
        'publicUrl' => rtrim((string)(getenv('WEBMUGEN_PUBLIC_URL') ?: $scheme . '://' . $host . $appPath . '/index.html'), '/'),
        'defaultStageId' => (string)(getenv('WEBMUGEN_DEFAULT_STAGE_ID') ?: 'cyber'),
        'defaultCharacterId' => (string)(getenv('WEBMUGEN_DEFAULT_CHARACTER_ID') ?: 't-h-m-a'),
    ];
}

function webMugenCatalogSecret(?string $configPath = null): string
{
    return webMugenCatalogSecurityState($configPath)['secret'];
}

function webMugenCatalogSecurityState(?string $configPath = null): array
{
    $path = $configPath ?? dirname(__DIR__) . '/config/catalog-config.php';
    $exists = is_file($path);
    $readable = $exists && is_readable($path);
    $loaded = false;
    $fileConfig = [];
    if ($readable) {
        $fileConfig = require $path;
        $loaded = is_array($fileConfig);
        if (!$loaded) $fileConfig = [];
    }
    $fileSecret = is_string($fileConfig['secret'] ?? null) ? trim($fileConfig['secret']) : '';
    $environmentSecret = trim((string)(getenv('WEBMUGEN_CATALOG_SECRET') ?: ''));
    $secretSource = $fileSecret !== '' ? 'config' : ($environmentSecret !== '' ? 'environment' : 'none');
    return [
        'secret' => $fileSecret !== '' ? $fileSecret : $environmentSecret,
        'secretSource' => $secretSource,
        'debug' => $loaded && ($fileConfig['debug'] ?? false) === true,
        'configFilePath' => $path,
        'configFileExists' => $exists,
        'configFileReadable' => $readable,
        'configFileLoaded' => $loaded,
    ];
}

function webMugenAuthorizationHeader(array $server = [], ?array $apacheHeaders = null, ?array $allHeaders = null): array
{
    $serverValue = trim((string)($server['HTTP_AUTHORIZATION'] ?? ''));
    if ($serverValue !== '') return ['value' => $serverValue, 'source' => 'HTTP_AUTHORIZATION'];
    $redirectValue = trim((string)($server['REDIRECT_HTTP_AUTHORIZATION'] ?? ''));
    if ($redirectValue !== '') return ['value' => $redirectValue, 'source' => 'REDIRECT_HTTP_AUTHORIZATION'];

    if ($apacheHeaders === null) {
        $apacheHeaders = function_exists('apache_request_headers') ? apache_request_headers() : [];
    }
    $apacheValue = webMugenHeaderValue(is_array($apacheHeaders) ? $apacheHeaders : [], 'Authorization');
    if ($apacheValue !== '') return ['value' => $apacheValue, 'source' => 'apache_request_headers'];

    if ($allHeaders === null) {
        $allHeaders = function_exists('getallheaders') ? getallheaders() : [];
    }
    $allValue = webMugenHeaderValue(is_array($allHeaders) ? $allHeaders : [], 'Authorization');
    if ($allValue !== '') return ['value' => $allValue, 'source' => 'getallheaders'];

    return ['value' => '', 'source' => 'none'];
}

function webMugenXTokenHeader(array $server = [], ?array $apacheHeaders = null, ?array $allHeaders = null): array
{
    $serverValue = trim((string)($server['HTTP_X_WEBMUGEN_TOKEN'] ?? ''));
    if ($serverValue !== '') return ['value' => $serverValue, 'source' => 'HTTP_X_WEBMUGEN_TOKEN'];
    $redirectValue = trim((string)($server['REDIRECT_HTTP_X_WEBMUGEN_TOKEN'] ?? ''));
    if ($redirectValue !== '') return ['value' => $redirectValue, 'source' => 'REDIRECT_HTTP_X_WEBMUGEN_TOKEN'];

    if ($apacheHeaders === null) {
        $apacheHeaders = function_exists('apache_request_headers') ? apache_request_headers() : [];
    }
    $apacheValue = webMugenHeaderValue(is_array($apacheHeaders) ? $apacheHeaders : [], 'X-WebMUGEN-Token');
    if ($apacheValue !== '') return ['value' => $apacheValue, 'source' => 'apache_request_headers'];

    if ($allHeaders === null) {
        $allHeaders = function_exists('getallheaders') ? getallheaders() : [];
    }
    $allValue = webMugenHeaderValue(is_array($allHeaders) ? $allHeaders : [], 'X-WebMUGEN-Token');
    if ($allValue !== '') return ['value' => $allValue, 'source' => 'getallheaders'];

    return ['value' => '', 'source' => 'none'];
}

function webMugenApiTokenState(array $server = [], ?array $apacheHeaders = null, ?array $allHeaders = null): array
{
    if ($apacheHeaders === null) {
        $apacheHeaders = function_exists('apache_request_headers') ? apache_request_headers() : [];
    }
    if ($allHeaders === null) {
        $allHeaders = function_exists('getallheaders') ? getallheaders() : [];
    }
    $authorization = webMugenAuthorizationHeader($server, is_array($apacheHeaders) ? $apacheHeaders : [], is_array($allHeaders) ? $allHeaders : []);
    $xToken = webMugenXTokenHeader($server, is_array($apacheHeaders) ? $apacheHeaders : [], is_array($allHeaders) ? $allHeaders : []);
    if ($authorization['value'] !== '') {
        $token = '';
        if (preg_match('/^Bearer\s+(.+)$/i', trim((string)$authorization['value']), $match) === 1) $token = trim($match[1]);
        return ['token' => $token, 'selectedAuthSource' => 'bearer', 'authorization' => $authorization, 'xToken' => $xToken];
    }
    if ($xToken['value'] !== '') {
        return ['token' => (string)$xToken['value'], 'selectedAuthSource' => 'x-webmugen-token', 'authorization' => $authorization, 'xToken' => $xToken];
    }
    return ['token' => '', 'selectedAuthSource' => 'none', 'authorization' => $authorization, 'xToken' => $xToken];
}

function webMugenAuthorizeRequest(array $tokenState, string $secret): bool
{
    $token = (string)($tokenState['token'] ?? '');
    return $secret !== '' && $token !== '' && hash_equals($secret, $token);
}

function webMugenDebugServerHeaderKeys(array $server): array
{
    $keys = array_values(array_filter(array_map('strval', array_keys($server)), static fn(string $key): bool => str_starts_with($key, 'HTTP_') || str_starts_with($key, 'REDIRECT_HTTP_')));
    sort($keys, SORT_STRING);
    return $keys;
}

function webMugenHeaderValue(array $headers, string $name): string
{
    foreach ($headers as $headerName => $value) {
        if (strcasecmp((string)$headerName, $name) === 0) return trim((string)$value);
    }
    return '';
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
    return webMugenSelectPreferredDefCandidate($candidates);
}

function webMugenInspectStageZip(string $zipPath): array
{
    if (!class_exists('ZipArchive')) throw new RuntimeException('PHP ZipArchive extension is required.', 500);
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
            $candidate = webMugenInspectStageDef($normalized, webMugenDecodeText($bytes));
            if ($candidate !== null) $candidates[] = $candidate;
        }
    } finally {
        $zip->close();
    }
    if ($candidates === []) throw new RuntimeException('ZIP contains no valid Stage DEF.', 422);
    return webMugenSelectPreferredDefCandidate($candidates);
}

function webMugenInspectStageDef(string $path, string $text): ?array
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
    if (
        (!isset($sections['info']) && !isset($sections['stageinfo']))
        || !isset($sections['camera'], $sections['playerinfo'], $sections['bound'], $sections['bgdef'])
        || trim((string)($sections['bgdef']['spr'] ?? '')) === ''
    ) return null;
    $name = trim((string)($sections['info']['name'] ?? $sections['stageinfo']['name'] ?? pathinfo($path, PATHINFO_FILENAME)));
    return ['defPath' => $path, 'name' => $name !== '' ? $name : pathinfo($path, PATHINFO_FILENAME)];
}

function webMugenSelectPreferredDefCandidate(array $candidates): array
{
    usort($candidates, static function (array $left, array $right): int {
        $leftRank = webMugenDefCandidateRank((string)$left['defPath']);
        $rightRank = webMugenDefCandidateRank((string)$right['defPath']);
        foreach (['depth', 'nameComplexity', 'nameLength'] as $key) {
            $comparison = $leftRank[$key] <=> $rightRank[$key];
            if ($comparison !== 0) return $comparison;
        }
        return strcmp($leftRank['path'], $rightRank['path']);
    });
    return $candidates[0];
}

function webMugenDefCandidateRank(string $path): array
{
    $normalized = trim(str_replace('\\', '/', $path), '/');
    $stem = preg_replace('/\.[^.]+$/', '', basename($normalized)) ?? basename($normalized);
    $complexity = preg_match_all('/[^\pL\pN]/u', $stem, $unused);
    if ($complexity === false) $complexity = strlen((string)(preg_replace('/[A-Za-z0-9]/', '', $stem) ?? $stem));
    return [
        'depth' => substr_count($normalized, '/'),
        'nameComplexity' => $complexity,
        'nameLength' => function_exists('mb_strlen') ? mb_strlen($stem, 'UTF-8') : strlen($stem),
        'path' => $normalized,
    ];
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
    if (strncmp($bytes, "\xEF\xBB\xBF", 3) === 0) return substr($bytes, 3);
    if (strncmp($bytes, "\xFF\xFE", 2) === 0) {
        $content = substr($bytes, 2);
        if (function_exists('mb_convert_encoding')) return mb_convert_encoding($content, 'UTF-8', 'UTF-16LE');
        $converted = @iconv('UTF-16LE', 'UTF-8//IGNORE', $content);
        return is_string($converted) ? $converted : $bytes;
    }
    if (strncmp($bytes, "\xFE\xFF", 2) === 0) {
        $content = substr($bytes, 2);
        if (function_exists('mb_convert_encoding')) return mb_convert_encoding($content, 'UTF-8', 'UTF-16BE');
        $converted = @iconv('UTF-16BE', 'UTF-8//IGNORE', $content);
        return is_string($converted) ? $converted : $bytes;
    }
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
            $entries[] = webMugenCatalogEntryForAnyZip($file->getPathname(), $config);
        } catch (Throwable $error) {
            $excluded[] = ['file' => $file->getFilename(), 'code' => 'character.invalid', 'message' => $error->getMessage()];
        }
    }
    usort($entries, static fn(array $left, array $right): int => strcmp($left['id'], $right['id']));
    return ['entries' => $entries, 'excluded' => $excluded];
}

function webMugenCatalogEntryForZip(string $zipPath, array $config, ?string $publicationId = null): array
{
    return webMugenCatalogEntryForKind($zipPath, $config, $publicationId, 'character');
}

function webMugenStageCatalogEntryForZip(string $zipPath, array $config, ?string $publicationId = null): array
{
    return webMugenCatalogEntryForKind($zipPath, $config, $publicationId, 'stage');
}

function webMugenCatalogEntryForAnyZip(string $zipPath, array $config, ?string $publicationId = null): array
{
    try {
        return webMugenCatalogEntryForKind($zipPath, $config, $publicationId, 'character');
    } catch (RuntimeException $characterError) {
        if ($characterError->getCode() !== 422) throw $characterError;
        try {
            return webMugenCatalogEntryForKind($zipPath, $config, $publicationId, 'stage');
        } catch (RuntimeException $stageError) {
            if ($stageError->getCode() !== 422) throw $stageError;
            throw new RuntimeException('ZIP contains no valid Character or Stage DEF.', 422);
        }
    }
}

function webMugenCatalogEntryForKind(string $zipPath, array $config, ?string $publicationId, string $kind): array
{
    $storageRoot = realpath((string)$config['storageDir']);
    $resolved = realpath($zipPath);
    if ($storageRoot === false || $resolved === false || !is_file($resolved) || !webMugenPathIsInside($resolved, $storageRoot)) {
        throw new RuntimeException('Published archive is outside the configured storage root.', 403);
    }
    $inspection = $kind === 'stage' ? webMugenInspectStageZip($resolved) : webMugenInspectCharacterZip($resolved);
    $fileName = basename($resolved);
    $publicId = $publicationId ?? webMugenPublicationIdFromFileName($fileName);
    $id = $publicId !== null
        ? 'proxy-release-' . strtolower($publicId)
        : 'proxy-release-' . substr(hash_file('sha256', $resolved), 0, 20);
    return [
        'id' => $id,
        'kind' => $kind,
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

function webMugenPublicationArchivePath(array $config, string $archiveFile): string
{
    if (
        $archiveFile === ''
        || $archiveFile !== trim($archiveFile)
        || str_contains($archiveFile, '..')
        || str_contains($archiveFile, '/')
        || str_contains($archiveFile, '\\')
        || str_contains($archiveFile, '://')
        || preg_match('/[\x00-\x1f\x7f]/', $archiveFile)
        || preg_match('/\A[\pL\pN][\pL\pN._ ()+\-]*\.zip\z/ui', $archiveFile) !== 1
    ) {
        throw new RuntimeException('archiveFile must be a safe ZIP basename.', 400);
    }
    $path = rtrim((string)$config['storageDir'], '/\\') . DIRECTORY_SEPARATOR . $archiveFile;
    $storageRoot = realpath((string)$config['storageDir']);
    $resolved = realpath($path);
    if ($storageRoot === false || $resolved === false || !is_file($resolved)) {
        throw new RuntimeException('Published ZIP was not found.', 404);
    }
    if (!webMugenPathIsInside($resolved, $storageRoot)) {
        throw new RuntimeException('Published archive is outside the configured storage root.', 403);
    }
    return $resolved;
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

function webMugenPublishCharacter(array $config, string $publicationId, string $archiveFile, ?string $stageId = null): array
{
    if (!preg_match('/^[0-9]+$/', $publicationId)) throw new RuntimeException('publicationId must be numeric.', 400);
    $entry = webMugenCatalogEntryForZip(webMugenPublicationArchivePath($config, $archiveFile), $config, $publicationId);
    $catalog = webMugenReadCatalog((string)$config['catalogPath']);
    $items = array_values(array_filter($catalog['items'], static fn(array $item): bool => ($item['id'] ?? null) !== $entry['id']));
    $items[] = $entry;
    $document = ['version' => 1, 'items' => $items];
    $playUrl = webMugenBuildPlayUrl($config, $document, $entry['id'], $stageId ?? (string)$config['defaultStageId']);
    webMugenValidateCatalog($document);
    webMugenWriteCatalogAtomic((string)$config['catalogPath'], $document);
    return [
        'entry' => $entry,
        'playUrl' => $playUrl,
    ];
}

function webMugenPublishStage(array $config, string $publicationId, string $archiveFile, ?string $characterId = null): array
{
    if (!preg_match('/^[0-9]+$/', $publicationId)) throw new RuntimeException('publicationId must be numeric.', 400);
    $entry = webMugenStageCatalogEntryForZip(webMugenPublicationArchivePath($config, $archiveFile), $config, $publicationId);
    $catalog = webMugenReadCatalog((string)$config['catalogPath']);
    $items = array_values(array_filter($catalog['items'], static fn(array $item): bool => ($item['id'] ?? null) !== $entry['id']));
    $items[] = $entry;
    $document = ['version' => 1, 'items' => $items];
    $playUrl = webMugenBuildPlayUrl($config, $document, $characterId ?? (string)$config['defaultCharacterId'], $entry['id']);
    webMugenValidateCatalog($document);
    webMugenWriteCatalogAtomic((string)$config['catalogPath'], $document);
    return ['entry' => $entry, 'playUrl' => $playUrl];
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

function webMugenCatalogRevision(string $path): string
{
    if (!is_file($path) || !is_readable($path)) throw new RuntimeException('Catalog file is not readable.', 500);
    $revision = hash_file('sha256', $path);
    if (!is_string($revision)) throw new RuntimeException('Catalog revision could not be calculated.', 500);
    return $revision;
}

function webMugenSaveCatalog(array $config, mixed $catalog, string $expectedRevision): array
{
    if (preg_match('/^[a-f0-9]{64}$/', $expectedRevision) !== 1) {
        throw new RuntimeException('expectedRevision must be a SHA-256 hash.', 400);
    }
    if (!is_array($catalog)) throw new RuntimeException('Catalog draft is required.', 422);
    try {
        webMugenValidateCatalog($catalog);
    } catch (RuntimeException $error) {
        throw new RuntimeException($error->getMessage(), 422, $error);
    }

    $catalogPath = (string)$config['catalogPath'];
    if (!hash_equals($expectedRevision, webMugenCatalogRevision($catalogPath))) {
        throw new RuntimeException('Catalog changed after this draft was loaded. Reload before saving.', 409);
    }
    webMugenWriteCatalogAtomic(
        $catalogPath,
        $catalog,
        static function (string $temporaryPath, string $finalPath) use ($expectedRevision): void {
            if (!hash_equals($expectedRevision, webMugenCatalogRevision($finalPath))) {
                throw new RuntimeException('Catalog changed while this draft was being saved. Reload before retrying.', 409);
            }
        },
    );
    return [
        'revision' => webMugenCatalogRevision($catalogPath),
        'itemCount' => count($catalog['items']),
    ];
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
        $name = trim((string)($item['name'] ?? ''));
        $kind = (string)($item['kind'] ?? '');
        $engine = (string)($item['engine'] ?? '');
        $path = (string)($item['path'] ?? '');
        if (!preg_match('/^[a-z0-9][a-z0-9_-]{0,63}$/i', $id)) throw new RuntimeException('Catalog item has an invalid ID.', 500);
        if (isset($ids[strtolower($id)])) throw new RuntimeException('Catalog contains a duplicate ID.', 500);
        $nameLength = function_exists('mb_strlen') ? mb_strlen($name, 'UTF-8') : strlen($name);
        if ($name === '' || $nameLength > 120) throw new RuntimeException('Catalog item has an invalid name.', 500);
        if (!in_array($kind, ['character', 'stage', 'lifebar'], true)) throw new RuntimeException('Catalog item has an unknown kind.', 500);
        if (!in_array($engine, ['winmugen', 'webmugen'], true)) throw new RuntimeException('Catalog item has an unknown engine.', 500);
        if (isset($item['source']) && !in_array($item['source'], ['builtin', 'external'], true)) throw new RuntimeException('Catalog item has an unknown source.', 500);
        if (!webMugenCatalogItemPathIsValid($path, $kind, $engine)) throw new RuntimeException('Catalog item has an invalid path.', 500);
        $ids[strtolower($id)] = true;
    }
}

function webMugenCatalogItemPathIsValid(string $path, string $kind, string $engine): bool
{
    $normalized = str_replace('\\', '/', trim($path));
    if ($normalized === '' || str_contains($normalized, '://') || str_starts_with($normalized, '//')) return false;
    foreach (explode('/', $normalized) as $part) {
        if ($part === '.' || $part === '..') return false;
    }
    $lower = strtolower($normalized);
    if ($engine === 'webmugen') {
        return str_starts_with($normalized, 'builtin:' . $kind . ':')
            || str_ends_with($lower, '.json');
    }
    if ($kind === 'lifebar') return str_ends_with($lower, '.def');
    return str_ends_with($lower, '.def') || str_ends_with($lower, '.zip');
}

function webMugenWriteCatalogAtomic(
    string $path,
    array $catalog,
    ?callable $beforeReplace = null,
    ?callable $chmodFile = null,
    ?callable $warningLogger = null,
): void
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
        webMugenSetCatalogPublicPermissions($path, $chmodFile, $warningLogger);
    } finally {
        if (is_file($temporary)) @unlink($temporary);
    }
}

function webMugenSetCatalogPublicPermissions(
    string $path,
    ?callable $chmodFile = null,
    ?callable $warningLogger = null,
): bool {
    $chmodFile ??= static fn(string $catalogPath, int $mode): bool => @chmod($catalogPath, $mode);
    if ($chmodFile($path, 0644)) return true;

    $message = 'WebMUGEN Catalog warning: failed to set generated Catalog permissions to 0644: ' . $path;
    if ($warningLogger !== null) $warningLogger($message);
    else error_log($message);
    return false;
}

function webMugenPathIsInside(string $path, string $root): bool
{
    $path = rtrim(str_replace('\\', '/', $path), '/');
    $root = rtrim(str_replace('\\', '/', $root), '/');
    return strcasecmp($path, $root) === 0 || strncasecmp($path, $root . '/', strlen($root) + 1) === 0;
}
