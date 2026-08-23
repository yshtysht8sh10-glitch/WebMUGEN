<?php

declare(strict_types=1);

require_once __DIR__ . '/../public/api/catalog-lib.php';

$root = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'webmugen-catalog-secret-' . bin2hex(random_bytes(6));
$configPath = $root . DIRECTORY_SEPARATOR . 'catalog-config.php';
$originalEnvironmentSecret = getenv('WEBMUGEN_CATALOG_SECRET');
mkdir($root, 0777, true);

try {
    putenv('WEBMUGEN_CATALOG_SECRET');
    writeSecretConfig($configPath, 'file-secret-value');
    assertSecret('file-secret-value', webMugenCatalogSecret($configPath), 'config file only');
    assertSecret(true, webMugenAuthorize('Bearer file-secret-value', webMugenCatalogSecret($configPath)), 'config file Bearer authorization');
    $fileState = webMugenCatalogSecurityState($configPath);
    assertSecret('config', $fileState['secretSource'], 'config file source');
    assertSecret(true, $fileState['configFileLoaded'], 'config file loaded');
    assertSecret(false, $fileState['debug'], 'debug defaults off');

    unlink($configPath);
    putenv('WEBMUGEN_CATALOG_SECRET=environment-secret-value');
    assertSecret('environment-secret-value', webMugenCatalogSecret($configPath), 'environment only');
    assertSecret(true, webMugenAuthorize('Bearer environment-secret-value', webMugenCatalogSecret($configPath)), 'environment Bearer authorization');

    writeSecretConfig($configPath, '');
    assertSecret('environment-secret-value', webMugenCatalogSecret($configPath), 'empty config file secret falls back to environment');

    writeSecretConfig($configPath, 'file-secret-value');
    assertSecret('file-secret-value', webMugenCatalogSecret($configPath), 'config file takes priority');
    assertSecret(false, webMugenAuthorize('Bearer environment-secret-value', webMugenCatalogSecret($configPath)), 'environment token is rejected when file secret is configured');

    unlink($configPath);
    putenv('WEBMUGEN_CATALOG_SECRET');
    assertSecret('', webMugenCatalogSecret($configPath), 'missing configuration');
    assertSecret(false, webMugenAuthorize('Bearer any-token', webMugenCatalogSecret($configPath)), 'missing configuration rejects authorization');

    assertSecret('HTTP_AUTHORIZATION', webMugenAuthorizationHeader(['HTTP_AUTHORIZATION' => 'Bearer server-token'], ['Authorization' => 'Bearer apache-token'], ['Authorization' => 'Bearer all-token'])['source'], 'server Authorization priority');
    assertSecret('apache_request_headers', webMugenAuthorizationHeader([], ['authorization' => 'Bearer apache-token'], ['Authorization' => 'Bearer all-token'])['source'], 'Apache Authorization fallback');
    assertSecret('getallheaders', webMugenAuthorizationHeader([], [], ['AUTHORIZATION' => 'Bearer all-token'])['source'], 'getallheaders Authorization fallback');
    assertSecret('none', webMugenAuthorizationHeader([], [], [])['source'], 'missing Authorization header');

    echo "catalog-secret-test: PASS\n";
} finally {
    if ($originalEnvironmentSecret === false) putenv('WEBMUGEN_CATALOG_SECRET');
    else putenv('WEBMUGEN_CATALOG_SECRET=' . $originalEnvironmentSecret);
    if (is_file($configPath)) unlink($configPath);
    if (is_dir($root)) rmdir($root);
}

function writeSecretConfig(string $path, string $secret, bool $debug = false): void
{
    $source = "<?php\n\nreturn [\n    'secret' => " . var_export($secret, true) . ",\n    'debug' => " . var_export($debug, true) . ",\n];\n";
    if (file_put_contents($path, $source) === false) throw new RuntimeException('failed to write test config');
}

function assertSecret(mixed $expected, mixed $actual, string $label): void
{
    if ($expected !== $actual) throw new RuntimeException($label . ': expected ' . var_export($expected, true) . ', got ' . var_export($actual, true));
}
