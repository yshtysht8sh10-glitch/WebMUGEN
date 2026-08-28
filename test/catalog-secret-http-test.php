<?php

declare(strict_types=1);

$root = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'webmugen-catalog-secret-http-' . bin2hex(random_bytes(6));
$public = $root . DIRECTORY_SEPARATOR . 'public';
$api = $public . DIRECTORY_SEPARATOR . 'api';
$config = $public . DIRECTORY_SEPARATOR . 'config';
$content = $public . DIRECTORY_SEPARATOR . 'content';
$storage = $root . DIRECTORY_SEPARATOR . 'storage';
$configPath = $config . DIRECTORY_SEPARATOR . 'catalog-config.php';
$originalEnvironmentSecret = getenv('WEBMUGEN_CATALOG_SECRET');
$originalStorageDir = getenv('WEBMUGEN_PROXY_STORAGE_DIR');
$server = null;

try {
    if (!extension_loaded('curl')) throw new RuntimeException('PHP curl extension is required.');
    foreach ([$api, $config, $content, $storage] as $directory) {
        if (!mkdir($directory, 0777, true) && !is_dir($directory)) throw new RuntimeException('failed to create test directory');
    }
    copy(__DIR__ . '/../public/api/catalog.php', $api . '/catalog.php');
    copy(__DIR__ . '/../public/api/catalog-lib.php', $api . '/catalog-lib.php');
    copy(__DIR__ . '/../public/content/catalog.json', $content . '/catalog.json');

    putenv('WEBMUGEN_CATALOG_SECRET');
    putenv('WEBMUGEN_PROXY_STORAGE_DIR=' . $storage);
    writeHttpSecretConfig($configPath, 'http-file-secret-value', true);
    $server = startCatalogServer($public);
    $debugXToken = 'http-debug-x-token-value';
    $debug = catalogResponse(str_replace('action=play-url', 'action=debug', $server['url']), 'http-file-secret-value', $debugXToken);
    assertHttpStatus(200, $debug['status'], 'debug enabled');
    $debugJson = json_decode($debug['body'], true, flags: JSON_THROW_ON_ERROR);
    assertHttpValue(true, $debugJson['configFileExists'], 'debug config exists');
    assertHttpValue(true, $debugJson['configFileReadable'], 'debug config readable');
    assertHttpValue(true, $debugJson['configFileLoaded'], 'debug config loaded');
    assertHttpValue('config', $debugJson['secretSource'], 'debug secret source');
    assertHttpValue(strlen('http-file-secret-value'), $debugJson['secretLength'], 'debug secret length');
    assertHttpValue(true, $debugJson['authorizationHeaderExists'], 'debug Authorization exists');
    assertHttpValue(strlen('Bearer http-file-secret-value'), $debugJson['authorizationHeaderLength'], 'debug Authorization length');
    assertHttpValue('HTTP_AUTHORIZATION', $debugJson['authorizationHeaderSource'], 'debug Authorization source');
    assertHttpValue(true, $debugJson['bearerPrefix'], 'debug Bearer prefix');
    assertHttpValue(true, $debugJson['xWebMugenTokenExists'], 'debug X-WebMUGEN-Token exists');
    assertHttpValue(strlen($debugXToken), $debugJson['xWebMugenTokenLength'], 'debug X-WebMUGEN-Token length');
    assertHttpValue('bearer', $debugJson['selectedAuthSource'], 'debug selected auth source');
    assertHttpValue(true, in_array('HTTP_AUTHORIZATION', $debugJson['serverHeaderKeys'], true), 'debug lists Authorization server key');
    assertHttpValue(true, in_array('HTTP_X_WEBMUGEN_TOKEN', $debugJson['serverHeaderKeys'], true), 'debug lists X token server key');
    assertHttpValue(false, str_contains($debug['body'], 'http-file-secret-value'), 'debug omits secret and Authorization values');
    assertHttpValue(false, str_contains($debug['body'], $debugXToken), 'debug omits X-WebMUGEN-Token value');
    assertHttpStatus(200, catalogRequest($server['url'], 'http-file-secret-value'), 'config file only');
    assertHttpStatus(200, catalogRequest($server['url'], null, 'http-file-secret-value'), 'X-WebMUGEN-Token only');
    $authorizeUrl = str_replace('action=play-url', 'action=authorize', $server['url']);
    $authorize = catalogResponse($authorizeUrl, 'http-file-secret-value');
    assertHttpStatus(200, $authorize['status'], 'Development Mode Pass authorization');
    $authorizeJson = json_decode($authorize['body'], true, flags: JSON_THROW_ON_ERROR);
    assertHttpValue(true, $authorizeJson['success'], 'Development Mode authorization success');
    assertHttpValue('development', $authorizeJson['mode'], 'Development Mode authorization profile');
    assertHttpValue(false, str_contains($authorize['body'], 'http-file-secret-value'), 'Development Mode authorization omits Pass');
    assertHttpStatus(401, catalogRequest($authorizeUrl, 'wrong-token'), 'Development Mode rejects an invalid Pass');
    assertHttpStatus(401, catalogRequest($authorizeUrl, null, null), 'Development Mode requires a Pass');
    $rebuild = catalogResponse(str_replace('action=play-url', 'action=rebuild', $server['url']), null, 'http-file-secret-value');
    assertHttpStatus(200, $rebuild['status'], 'X-WebMUGEN-Token rebuild');
    assertHttpValue(true, json_decode($rebuild['body'], true, flags: JSON_THROW_ON_ERROR)['success'], 'X-WebMUGEN-Token rebuild success');
    if (DIRECTORY_SEPARATOR !== '\\') {
        clearstatcache(true, $content . '/catalog.json');
        assertHttpValue(0644, fileperms($content . '/catalog.json') & 0777, 'rebuild Catalog permission');
    }
    $publicCatalog = catalogGetResponse(str_replace('/api/catalog.php?action=play-url', '/content/catalog.json', $server['url']));
    assertHttpStatus(200, $publicCatalog['status'], 'generated Catalog public GET');
    $publicCatalogJson = json_decode($publicCatalog['body'], true, flags: JSON_THROW_ON_ERROR);
    assertHttpValue(1, $publicCatalogJson['version'], 'generated Catalog Runtime schema version');
    assertHttpValue(true, is_array($publicCatalogJson['items']), 'generated Catalog Runtime items');
    $saveRevision = hash_file('sha256', $content . '/catalog.json');
    if (!is_string($saveRevision)) throw new RuntimeException('failed to hash Catalog fixture');
    $publicCatalogJson['items'][0]['name'] = 'Saved through GUI API';
    $saveUrl = str_replace('action=play-url', 'action=save-catalog', $server['url']);
    $save = catalogResponse($saveUrl, null, 'http-file-secret-value', [
        'catalog' => $publicCatalogJson,
        'expectedRevision' => $saveRevision,
    ]);
    assertHttpStatus(200, $save['status'], 'X-WebMUGEN-Token GUI Catalog save');
    $saveJson = json_decode($save['body'], true, flags: JSON_THROW_ON_ERROR);
    assertHttpValue(true, $saveJson['success'], 'GUI Catalog save success');
    assertHttpValue(count($publicCatalogJson['items']), $saveJson['itemCount'], 'GUI Catalog save item count');
    assertHttpValue('Saved through GUI API', json_decode((string)file_get_contents($content . '/catalog.json'), true, flags: JSON_THROW_ON_ERROR)['items'][0]['name'], 'GUI Catalog save updates the server file');
    if (DIRECTORY_SEPARATOR !== '\\') {
        clearstatcache(true, $content . '/catalog.json');
        assertHttpValue(0644, fileperms($content . '/catalog.json') & 0777, 'GUI Catalog save permission');
    }
    $servedAfterSave = catalogGetResponse(str_replace('/api/catalog.php?action=play-url', '/content/catalog.json', $server['url']));
    assertHttpValue('Saved through GUI API', json_decode($servedAfterSave['body'], true, flags: JSON_THROW_ON_ERROR)['items'][0]['name'], 'public Catalog GET exposes the GUI change');

    $conflict = catalogResponse($saveUrl, null, 'http-file-secret-value', [
        'catalog' => $publicCatalogJson,
        'expectedRevision' => $saveRevision,
    ]);
    assertHttpStatus(409, $conflict['status'], 'stale GUI Catalog save conflict');
    assertHttpValue('catalog.conflict', json_decode($conflict['body'], true, flags: JSON_THROW_ON_ERROR)['error']['code'], 'conflict response code');

    $invalidCatalog = $publicCatalogJson;
    $invalidCatalog['items'][] = $invalidCatalog['items'][0];
    $invalid = catalogResponse($saveUrl, null, 'http-file-secret-value', [
        'catalog' => $invalidCatalog,
        'expectedRevision' => (string)$saveJson['revision'],
    ]);
    assertHttpStatus(422, $invalid['status'], 'invalid GUI Catalog rejected');
    assertHttpValue('catalog.invalid', json_decode($invalid['body'], true, flags: JSON_THROW_ON_ERROR)['error']['code'], 'invalid GUI Catalog response code');
    assertHttpStatus(401, catalogResponse($saveUrl, null, null, ['catalog' => $publicCatalogJson, 'expectedRevision' => (string)$saveJson['revision']])['status'], 'GUI Catalog save requires authentication');
    assertHttpStatus(401, catalogRequest($server['url'], null, null), 'missing Authorization and X-WebMUGEN-Token');
    assertHttpStatus(401, catalogRequest($server['url'], null, 'wrong-token'), 'mismatched X-WebMUGEN-Token');
    assertHttpStatus(401, catalogRequest($server['url'], 'wrong-token', 'http-file-secret-value'), 'Bearer mismatch takes priority over matching X-WebMUGEN-Token');
    assertHttpStatus(200, catalogRequest($server['url'], 'http-file-secret-value', 'http-file-secret-value'), 'matching Bearer and X-WebMUGEN-Token');
    stopCatalogServer($server);
    $server = null;

    writeHttpSecretConfig($configPath, 'http-file-secret-value', false);
    putenv('WEBMUGEN_CATALOG_SECRET=http-environment-secret-value');
    $server = startCatalogServer($public);
    assertHttpStatus(404, catalogRequest(str_replace('action=play-url', 'action=debug', $server['url']), 'http-file-secret-value'), 'debug disabled');
    assertHttpStatus(200, catalogRequest($server['url'], 'http-file-secret-value'), 'config file takes priority');
    assertHttpStatus(401, catalogRequest($server['url'], 'http-environment-secret-value'), 'environment token loses to config file');
    stopCatalogServer($server);
    $server = null;

    unlink($configPath);
    $server = startCatalogServer($public);
    assertHttpStatus(200, catalogRequest($server['url'], 'http-environment-secret-value'), 'environment only');
    stopCatalogServer($server);
    $server = null;

    putenv('WEBMUGEN_CATALOG_SECRET');
    $server = startCatalogServer($public);
    assertHttpStatus(401, catalogRequest($server['url'], 'any-token'), 'missing configuration');

    echo "catalog-secret-http-test: PASS\n";
} finally {
    if (is_array($server)) stopCatalogServer($server);
    if ($originalEnvironmentSecret === false) putenv('WEBMUGEN_CATALOG_SECRET');
    else putenv('WEBMUGEN_CATALOG_SECRET=' . $originalEnvironmentSecret);
    if ($originalStorageDir === false) putenv('WEBMUGEN_PROXY_STORAGE_DIR');
    else putenv('WEBMUGEN_PROXY_STORAGE_DIR=' . $originalStorageDir);
    removeHttpTestTree($root);
}

function startCatalogServer(string $documentRoot): array
{
    $socket = stream_socket_server('tcp://127.0.0.1:0', $errorNumber, $errorMessage);
    if ($socket === false) throw new RuntimeException($errorMessage, $errorNumber);
    $address = (string)stream_socket_get_name($socket, false);
    fclose($socket);
    $port = (int)substr(strrchr($address, ':'), 1);
    $process = proc_open(
        [PHP_BINARY, '-S', '127.0.0.1:' . $port, '-t', $documentRoot],
        [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']],
        $pipes,
        $documentRoot,
    );
    if (!is_resource($process)) throw new RuntimeException('failed to start PHP server');
    fclose($pipes[0]);
    $url = 'http://127.0.0.1:' . $port . '/api/catalog.php?action=play-url';
    $deadline = microtime(true) + 5;
    do {
        $status = catalogRequest($url, 'startup-probe');
        if ($status !== 0) return ['process' => $process, 'pipes' => $pipes, 'url' => $url];
        usleep(100000);
    } while (microtime(true) < $deadline);
    stopCatalogServer(['process' => $process, 'pipes' => $pipes, 'url' => $url]);
    throw new RuntimeException('PHP server did not start.');
}

function stopCatalogServer(array $server): void
{
    $process = $server['process'];
    if (is_resource($process)) {
        $status = proc_get_status($process);
        if (($status['running'] ?? false) && PHP_OS_FAMILY === 'Windows' && (int)($status['pid'] ?? 0) > 0) {
            exec('taskkill /F /T /PID ' . (int)$status['pid'] . ' >NUL 2>NUL');
        } elseif ($status['running'] ?? false) {
            proc_terminate($process);
        }
        foreach ($server['pipes'] as $pipe) if (is_resource($pipe)) fclose($pipe);
        proc_close($process);
    }
}

function catalogRequest(string $url, ?string $token = null, ?string $xToken = null): int
{
    return catalogResponse($url, $token, $xToken)['status'];
}

function catalogResponse(string $url, ?string $token = null, ?string $xToken = null, ?array $payload = null): array
{
    $curl = curl_init($url);
    $headers = ['Content-Type: application/json'];
    if ($token !== null) $headers[] = 'Authorization: Bearer ' . $token;
    if ($xToken !== null) $headers[] = 'X-WebMUGEN-Token: ' . $xToken;
    curl_setopt_array($curl, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 2,
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_POSTFIELDS => json_encode($payload ?? ['characterId' => 'kfm', 'stageId' => 'cyber']),
    ]);
    $body = curl_exec($curl);
    if ($body === false && curl_errno($curl) !== CURLE_COULDNT_CONNECT) {
        $message = curl_error($curl);
        curl_close($curl);
        throw new RuntimeException($message);
    }
    $status = (int)curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
    curl_close($curl);
    return ['status' => $status, 'body' => is_string($body) ? $body : ''];
}

function catalogGetResponse(string $url): array
{
    $curl = curl_init($url);
    curl_setopt_array($curl, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 2,
    ]);
    $body = curl_exec($curl);
    if ($body === false) {
        $message = curl_error($curl);
        curl_close($curl);
        throw new RuntimeException($message);
    }
    $status = (int)curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
    curl_close($curl);
    return ['status' => $status, 'body' => is_string($body) ? $body : ''];
}

function writeHttpSecretConfig(string $path, string $secret, bool $debug = false): void
{
    $source = "<?php\n\nreturn [\n    'secret' => " . var_export($secret, true) . ",\n    'debug' => " . var_export($debug, true) . ",\n];\n";
    if (file_put_contents($path, $source) === false) throw new RuntimeException('failed to write test config');
}

function assertHttpStatus(int $expected, int $actual, string $label): void
{
    if ($expected !== $actual) throw new RuntimeException($label . ': expected HTTP ' . $expected . ', got ' . $actual);
}

function assertHttpValue(mixed $expected, mixed $actual, string $label): void
{
    if ($expected !== $actual) throw new RuntimeException($label . ': expected ' . var_export($expected, true) . ', got ' . var_export($actual, true));
}

function removeHttpTestTree(string $path): void
{
    if (!is_dir($path)) return;
    $items = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($path, FilesystemIterator::SKIP_DOTS), RecursiveIteratorIterator::CHILD_FIRST);
    foreach ($items as $item) $item->isDir() ? rmdir($item->getPathname()) : unlink($item->getPathname());
    rmdir($path);
}
