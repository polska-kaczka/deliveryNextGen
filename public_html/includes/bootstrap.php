<?php
/**
 * Shared helpers for the public endpoints (csrf.php, send_lead.php).
 * Compatible with PHP 7.4+.
 */
declare(strict_types=1);

define('DNG_APP', true);

ini_set('display_errors', '0');
ini_set('log_errors', '1');
error_reporting(E_ALL);
header_remove('X-Powered-By');

$DNG = require __DIR__ . '/config.php';

/** Send a JSON response and stop. */
function dng_json(int $code, array $data): void
{
    if (!headers_sent()) {
        http_response_code($code);
        header('Content-Type: application/json; charset=utf-8');
        header('Cache-Control: no-store, max-age=0');
        header('X-Content-Type-Options: nosniff');
        header('X-Robots-Tag: noindex, nofollow');
    }
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function dng_is_https(): bool
{
    return (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (($_SERVER['SERVER_PORT'] ?? '') === '443')
        || (strtolower($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
}

/** Start a hardened session (cookie only created when an endpoint is called). */
function dng_session(int $ttl): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }
    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_only_cookies', '1');
    ini_set('session.use_trans_sid', '0');
    ini_set('session.gc_maxlifetime', (string) $ttl);
    session_name('DNGSESSID');
    session_set_cookie_params([
        'lifetime' => 0,
        'path'     => '/',
        'secure'   => dng_is_https(),
        'httponly' => true,
        'samesite' => 'Strict',
    ]);
    session_start();
}

/** Request must come from one of our own pages. */
function dng_same_origin(array $allowedHosts): bool
{
    $self = strtolower((string) preg_replace('/:\d+$/', '', (string) ($_SERVER['HTTP_HOST'] ?? '')));
    if ($self === '' || !in_array($self, $allowedHosts, true)) {
        return false;
    }
    // Modern browsers send Sec-Fetch-Site; it cannot be set by page scripts.
    $fetchSite = (string) ($_SERVER['HTTP_SEC_FETCH_SITE'] ?? '');
    if ($fetchSite !== '') {
        return $fetchSite === 'same-origin';
    }
    // Older browsers: fall back to Origin, then Referer.
    $source = (string) ($_SERVER['HTTP_ORIGIN'] ?? ($_SERVER['HTTP_REFERER'] ?? ''));
    if ($source === '' || $source === 'null') {
        return false;
    }
    return strtolower((string) parse_url($source, PHP_URL_HOST)) === $self;
}

/** Remove control characters; keep newlines/tabs only when $multiline. */
function dng_clean(string $value, bool $multiline = false): string
{
    $value = str_replace("\0", '', $value);
    if (!mb_check_encoding($value, 'UTF-8')) {
        $value = mb_convert_encoding($value, 'UTF-8', 'UTF-8');
    }
    $value = $multiline
        ? preg_replace('/[^\P{C}\n\t]/u', '', str_replace("\r\n", "\n", $value))
        : preg_replace('/\p{C}/u', '', $value);
    return trim((string) $value);
}

/** Simple file-based rate limiter keyed by a salted IP hash. */
function dng_rate_limited(array $cfg, bool $record = false): bool
{
    $dir = $cfg['storage_dir'];
    if (!is_dir($dir) && !@mkdir($dir, 0700, true)) {
        $dir = rtrim(sys_get_temp_dir(), '/\\') . '/dng-data';
        if (!is_dir($dir)) {
            @mkdir($dir, 0700, true);
        }
    }
    $ip   = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
    $key  = hash_hmac('sha256', $ip, $cfg['ip_salt']);
    $file = $dir . '/rl_' . $key . '.json';
    $now  = time();

    $fh = @fopen($file, 'c+');
    if ($fh === false) {
        return false; // fail open: never block real users because of a storage problem
    }
    flock($fh, LOCK_EX);
    $raw  = stream_get_contents($fh);
    $hits = array_values(array_filter(
        json_decode($raw ?: '[]', true) ?: [],
        static function ($t) use ($now, $cfg) { return is_int($t) && $t > $now - $cfg['ip_window']; }
    ));
    $limited = count($hits) >= $cfg['ip_max'];
    if ($record && !$limited) {
        $hits[] = $now;
    }
    ftruncate($fh, 0);
    rewind($fh);
    fwrite($fh, (string) json_encode($hits));
    fflush($fh);
    flock($fh, LOCK_UN);
    fclose($fh);

    // Occasional clean-up of expired files (data minimisation).
    if (random_int(1, 50) === 1) {
        foreach (glob($dir . '/rl_*.json') ?: [] as $f) {
            if (@filemtime($f) < $now - $cfg['ip_window']) {
                @unlink($f);
            }
        }
    }
    return $limited;
}
