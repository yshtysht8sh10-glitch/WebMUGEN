<?php

declare(strict_types=1);

require_once __DIR__ . '/../public/api/catalog-lib.php';

$root = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'webmugen-catalog-secret-' . bin2hex(random_bytes(6));
$configPath = $root . DIRECTORY_SEPARATOR . 'catalog-config.php';
$originalEnvironmentSecret = getenv('WEBMUGEN_CATALOG_SECRET');
$originalEnvironmentDevelopmentPassHash = getenv('WEBMUGEN_DEVELOPMENT_PASS_HASH');
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

    $sharedSecret = 'shared-request-token';
    $httpAuthorization = webMugenApiTokenState(['HTTP_AUTHORIZATION' => 'Bearer ' . $sharedSecret], [], []);
    assertSecret('HTTP_AUTHORIZATION', $httpAuthorization['authorization']['source'], 'HTTP Authorization priority');
    assertSecret(true, webMugenAuthorizeRequest($httpAuthorization, $sharedSecret), 'HTTP Authorization authenticates');

    $redirectAuthorization = webMugenApiTokenState(['REDIRECT_HTTP_AUTHORIZATION' => 'Bearer ' . $sharedSecret], [], []);
    assertSecret('REDIRECT_HTTP_AUTHORIZATION', $redirectAuthorization['authorization']['source'], 'redirect Authorization fallback');
    assertSecret(true, webMugenAuthorizeRequest($redirectAuthorization, $sharedSecret), 'redirect Authorization authenticates');

    $apacheAuthorization = webMugenApiTokenState([], ['authorization' => 'Bearer ' . $sharedSecret], []);
    assertSecret('apache_request_headers', $apacheAuthorization['authorization']['source'], 'Apache Authorization fallback');
    assertSecret(true, webMugenAuthorizeRequest($apacheAuthorization, $sharedSecret), 'Apache Authorization authenticates');

    $allAuthorization = webMugenApiTokenState([], [], ['AUTHORIZATION' => 'Bearer ' . $sharedSecret]);
    assertSecret('getallheaders', $allAuthorization['authorization']['source'], 'getallheaders Authorization fallback');
    assertSecret(true, webMugenAuthorizeRequest($allAuthorization, $sharedSecret), 'getallheaders Authorization authenticates');

    $xToken = webMugenApiTokenState(['HTTP_X_WEBMUGEN_TOKEN' => $sharedSecret], [], []);
    assertSecret('x-webmugen-token', $xToken['selectedAuthSource'], 'X-WebMUGEN-Token fallback selected');
    assertSecret(true, webMugenAuthorizeRequest($xToken, $sharedSecret), 'X-WebMUGEN-Token authenticates');

    assertSecret(false, webMugenAuthorizeRequest(webMugenApiTokenState([], [], []), $sharedSecret), 'missing headers reject authentication');
    assertSecret(false, webMugenAuthorizeRequest(webMugenApiTokenState(['HTTP_X_WEBMUGEN_TOKEN' => 'wrong-token'], [], []), $sharedSecret), 'mismatched X-WebMUGEN-Token rejects authentication');
    $bearerWins = webMugenApiTokenState(['HTTP_AUTHORIZATION' => 'Bearer wrong-token', 'HTTP_X_WEBMUGEN_TOKEN' => $sharedSecret], [], []);
    assertSecret('bearer', $bearerWins['selectedAuthSource'], 'Bearer remains preferred when both headers exist');
    assertSecret(false, webMugenAuthorizeRequest($bearerWins, $sharedSecret), 'mismatched Bearer is not rescued by matching X-WebMUGEN-Token');
    $developmentPass = 'separate-development-pass';
    $developmentPassHash = password_hash($developmentPass, PASSWORD_DEFAULT);
    assertSecret(true, webMugenVerifyDevelopmentPass($developmentPass, $developmentPassHash), 'Development Pass hash verifies');
    assertSecret(false, webMugenVerifyDevelopmentPass($sharedSecret, $developmentPassHash), 'API token is not a Development Pass');
    $developmentToken = webMugenIssueDevelopmentToken($sharedSecret, 900, 1000);
    assertSecret(true, webMugenVerifyDevelopmentToken($developmentToken, $sharedSecret, 1001), 'issued Development session verifies');
    assertSecret(true, webMugenAuthorizeApiOrDevelopmentRequest(webMugenApiTokenState(['HTTP_AUTHORIZATION' => 'Bearer ' . $developmentToken], [], []), $sharedSecret, 1001), 'Development session authorizes API request');
    assertSecret(false, webMugenVerifyDevelopmentToken($developmentToken, 'different-api-secret', 1001), 'Development session is signed by the API secret');
    assertSecret(false, webMugenVerifyDevelopmentToken($developmentToken, $sharedSecret, 1900), 'expired Development session is rejected');
    assertSecret(false, webMugenVerifyDevelopmentToken($developmentToken . 'tampered', $sharedSecret, 1001), 'tampered Development session is rejected');
    assertSecret(['HTTP_AUTHORIZATION', 'HTTP_X_WEBMUGEN_TOKEN', 'REDIRECT_HTTP_AUTHORIZATION'], webMugenDebugServerHeaderKeys([
        'HTTP_X_WEBMUGEN_TOKEN' => 'hidden',
        'REQUEST_METHOD' => 'POST',
        'REDIRECT_HTTP_AUTHORIZATION' => 'hidden',
        'HTTP_AUTHORIZATION' => 'hidden',
    ]), 'debug returns only sorted HTTP server key names');

    echo "catalog-secret-test: PASS\n";
} finally {
    if ($originalEnvironmentSecret === false) putenv('WEBMUGEN_CATALOG_SECRET');
    else putenv('WEBMUGEN_CATALOG_SECRET=' . $originalEnvironmentSecret);
    if ($originalEnvironmentDevelopmentPassHash === false) putenv('WEBMUGEN_DEVELOPMENT_PASS_HASH');
    else putenv('WEBMUGEN_DEVELOPMENT_PASS_HASH=' . $originalEnvironmentDevelopmentPassHash);
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
