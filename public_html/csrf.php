<?php
/**
 * Issues a CSRF token for the contact form.
 * Called by the browser only once the visitor starts filling in the form,
 * so the (strictly necessary) session cookie is never set on page load.
 */
declare(strict_types=1);

require __DIR__ . '/includes/bootstrap.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {
    header('Allow: GET');
    dng_json(405, ['status' => 'error', 'message' => 'Method not allowed.']);
}
if (!dng_same_origin($DNG['allowed_hosts'])) {
    dng_json(403, ['status' => 'error', 'message' => 'Forbidden.']);
}

dng_session($DNG['token_ttl']);

$now = time();
if (empty($_SESSION['csrf']) || ($now - (int) ($_SESSION['csrf_t'] ?? 0)) > $DNG['token_ttl']) {
    session_regenerate_id(true);
    $_SESSION['csrf']   = bin2hex(random_bytes(32));
    $_SESSION['csrf_t'] = $now;
}

dng_json(200, ['token' => $_SESSION['csrf']]);
