<?php

declare(strict_types=1);

require_once __DIR__ . '/catalog-lib.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

try {
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') throw new RuntimeException('POST is required.', 405);
    $config = webMugenCatalogConfig($_SERVER);
    $authorization = (string)($_SERVER['HTTP_AUTHORIZATION'] ?? '');
    if (!webMugenAuthorize($authorization, (string)$config['secret'])) throw new RuntimeException('Catalog API authorization failed.', 401);
    $payload = json_decode((string)file_get_contents('php://input'), true);
    if (!is_array($payload)) $payload = [];
    $action = (string)($_GET['action'] ?? $payload['action'] ?? '');

    if ($action === 'publish-character') {
        $publicationId = (string)($payload['publicationId'] ?? '');
        $archiveFile = (string)($payload['archiveFile'] ?? '');
        $result = webMugenPublishCharacter($config, $publicationId, $archiveFile, isset($payload['stageId']) ? (string)$payload['stageId'] : null);
        echo json_encode([
            'success' => true,
            'characterId' => $result['entry']['id'],
            'characterPath' => $result['entry']['path'],
            'playUrl' => $result['playUrl'],
        ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
    } elseif ($action === 'rebuild') {
        $result = webMugenRebuildCatalog($config);
        echo json_encode(['success' => true, 'registered' => count($result['entries']), 'excluded' => $result['excluded']], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
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
        'error' => ['code' => webMugenErrorCode($error, $status), 'message' => $error->getMessage()],
    ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
}

function webMugenErrorCode(Throwable $error, int $status): string
{
    if ($status === 401) return 'auth.failed';
    if ($status === 404) return 'not_found';
    if ($status === 422) return 'character.invalid';
    if ($status === 405) return 'method.invalid';
    return 'catalog.failed';
}
