<?php

declare(strict_types=1);

require_once __DIR__ . '/catalog-lib.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

try {
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') throw new RuntimeException('POST is required.', 405);
    $config = webMugenCatalogConfig($_SERVER);
    $tokenState = webMugenApiTokenState($_SERVER);
    $authorizationState = $tokenState['authorization'];
    $xTokenState = $tokenState['xToken'];
    $authorization = (string)$authorizationState['value'];
    $payload = json_decode((string)file_get_contents('php://input'), true);
    if (!is_array($payload)) $payload = [];
    $action = (string)($_GET['action'] ?? $payload['action'] ?? '');

    if ($action === 'debug') {
        if (($config['debug'] ?? false) !== true) throw new RuntimeException('Unknown Catalog API action.', 404);
        echo json_encode([
            'configFileExists' => (bool)$config['configFileExists'],
            'configFileReadable' => (bool)$config['configFileReadable'],
            'configFileLoaded' => (bool)$config['configFileLoaded'],
            'configFilePath' => (string)$config['configFilePath'],
            'secretSource' => (string)$config['secretSource'],
            'secretLength' => strlen((string)$config['secret']),
            'developmentPassConfigured' => (string)$config['developmentPassHash'] !== '',
            'developmentPassSource' => (string)$config['developmentPassSource'],
            'authorizationHeaderExists' => $authorization !== '',
            'authorizationHeaderLength' => strlen($authorization),
            'authorizationHeaderSource' => (string)$authorizationState['source'],
            'bearerPrefix' => preg_match('/^Bearer(?:\s|$)/i', $authorization) === 1,
            'xWebMugenTokenExists' => (string)$xTokenState['value'] !== '',
            'xWebMugenTokenLength' => strlen((string)$xTokenState['value']),
            'selectedAuthSource' => (string)$tokenState['selectedAuthSource'],
            'serverHeaderKeys' => webMugenDebugServerHeaderKeys($_SERVER),
            'storageDir' => (string)$config['storageDir'],
            'catalogPath' => (string)$config['catalogPath'],
            'defaultSettingsPath' => (string)$config['defaultSettingsPath'],
            'publicUrl' => (string)$config['publicUrl'],
        ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
        return;
    }

    if ($action === 'authorize') {
        $password = webMugenDevelopmentPassHeader($_SERVER);
        if (!webMugenVerifyDevelopmentPass($password, (string)$config['developmentPassHash'])) throw new RuntimeException('Development Mode authorization failed.', 401);
        $sessionToken = webMugenIssueDevelopmentToken((string)$config['secret'], (int)$config['developmentSessionTtl']);
        echo json_encode([
            'success' => true,
            'mode' => 'development',
            'sessionToken' => $sessionToken,
            'expiresIn' => (int)$config['developmentSessionTtl'],
        ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
        return;
    } else {
        if (!webMugenAuthorizeApiOrDevelopmentRequest($tokenState, (string)$config['secret'])) throw new RuntimeException('Catalog API authorization failed.', 401);
    }

    if ($action === 'publish-character') {
        $publicationId = (string)($payload['publicationId'] ?? '');
        $archiveFile = (string)($payload['archiveFile'] ?? '');
        $result = webMugenPublishCharacter($config, $publicationId, $archiveFile, isset($payload['stageId']) ? (string)$payload['stageId'] : null, (string)($payload['visibility'] ?? 'public'), isset($payload['accessKey']) ? (string)$payload['accessKey'] : null);
        echo json_encode([
            'success' => true,
            'characterId' => $result['entry']['id'],
            'characterPath' => $result['entry']['path'],
            'visibility' => webMugenCatalogVisibility($result['entry']),
            'playUrl' => $result['playUrl'],
        ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
    } elseif ($action === 'publish-stage') {
        $publicationId = (string)($payload['publicationId'] ?? '');
        $archiveFile = (string)($payload['archiveFile'] ?? '');
        $result = webMugenPublishStage($config, $publicationId, $archiveFile, isset($payload['characterId']) ? (string)$payload['characterId'] : null, (string)($payload['visibility'] ?? 'public'), isset($payload['accessKey']) ? (string)$payload['accessKey'] : null);
        echo json_encode([
            'success' => true,
            'stageId' => $result['entry']['id'],
            'stagePath' => $result['entry']['path'],
            'visibility' => webMugenCatalogVisibility($result['entry']),
            'playUrl' => $result['playUrl'],
        ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
    } elseif ($action === 'save-catalog') {
        $result = webMugenSaveCatalog(
            $config,
            $payload['catalog'] ?? null,
            (string)($payload['expectedRevision'] ?? ''),
        );
        echo json_encode([
            'success' => true,
            'revision' => $result['revision'],
            'itemCount' => $result['itemCount'],
        ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
    } elseif ($action === 'save-default-settings') {
        $result = webMugenSaveDefaultSettings($config, $payload['settings'] ?? null);
        echo json_encode([
            'success' => true,
            'version' => $result['version'],
            'path' => $result['path'],
        ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
    } elseif ($action === 'delete-content') {
        $result = webMugenDeletePublishedContent($config, (string)($payload['publicationId'] ?? ''), isset($payload['accessKey']) ? (string)$payload['accessKey'] : null);
        echo json_encode([
            'success' => true,
            'deleted' => $result['deleted'],
            'contentId' => $result['contentId'],
        ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
    } elseif ($action === 'rebuild') {
        $result = webMugenRebuildCatalog($config);
        echo json_encode(['success' => true, 'registered' => count($result['entries']), 'excluded' => $result['excluded']], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
    } elseif ($action === 'scan-catalog') {
        $result = webMugenScanCatalog($config);
        echo json_encode([
            'success' => true,
            'storagePublicBase' => (string)$config['storagePublicBase'],
            'entries' => $result['entries'],
            'excluded' => $result['excluded'],
        ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
    } elseif ($action === 'play-url') {
        $catalog = webMugenReadCatalog((string)$config['catalogPath']);
        $playUrl = webMugenBuildPlayUrl($config, $catalog, (string)($payload['characterId'] ?? ''), (string)($payload['stageId'] ?? $config['defaultStageId']));
        echo json_encode(['success' => true, 'playUrl' => $playUrl], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
    } else {
        throw new RuntimeException('Unknown Catalog API action.', 404);
    }
} catch (Throwable $error) {
    $status = $error->getCode();
    if (!is_int($status) || $status < 400 || $status > 599) $status = 500;
    http_response_code($status);
    echo json_encode([
        'success' => false,
        'error' => ['code' => webMugenErrorCode($error, $status, isset($action) ? (string)$action : ''), 'message' => $error->getMessage()],
    ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
}

function webMugenErrorCode(Throwable $error, int $status, string $action = ''): string
{
    if ($status === 401) return 'auth.failed';
    if ($status === 409) return 'catalog.conflict';
    if ($status === 404) return 'not_found';
    if ($status === 422) {
        if ($action === 'save-catalog') return 'catalog.invalid';
        if ($action === 'save-default-settings') return 'settings.invalid';
        return $action === 'publish-stage' ? 'stage.invalid' : 'character.invalid';
    }
    if ($status === 405) return 'method.invalid';
    return $action === 'save-default-settings' ? 'settings.failed' : 'catalog.failed';
}
