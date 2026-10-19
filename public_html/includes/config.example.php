<?php
/**
 * DeliveryNextGen V2 — server configuration.
 * TEMPLATE: copy to config.php and fill in real values. config.php is git-ignored —
 * never commit real addresses or secrets.
 * This file is never served directly (blocked by .htaccess and the guard below).
 */
defined('DNG_APP') || exit;

return [
    // Where demo requests are delivered.
    'recipient'       => 'leads@example.com',          // <- set your inbox

    // Sender mailbox. MUST be an address on your own domain (configured with SPF/DKIM
    // at the hosting provider), otherwise messages land in spam or are rejected.
    'from_address'    => 'noreply@deliverynextgen.threecode.eu',
    'from_name'       => 'DeliveryNextGen website',
    'envelope_sender' => true,   // pass -f<from_address> to sendmail (improves SPF alignment)

    // Hosts allowed to submit the form (Origin / Referer check).
    'allowed_hosts'   => [
        'deliverynextgen.threecode.eu',
        'www.deliverynextgen.threecode.eu',
    ],

    // Abuse protection
    'session_cooldown'  => 60,    // seconds between two submissions in one browser session
    'ip_window'         => 3600,  // seconds
    'ip_max'            => 5,     // max successful submissions per IP within the window
    'min_fill_seconds'  => 3,     // faster submissions are treated as bots
    'token_ttl'         => 1800,  // CSRF token lifetime (seconds)
    'max_body_bytes'    => 20000,

    // Secret used to hash IP addresses for rate limiting (GDPR: raw IPs are never stored).
    // Replace with a long random string, e.g. output of: php -r "echo bin2hex(random_bytes(32));"
    'ip_salt'           => 'CHANGE-ME-replace-with-64-random-hex-characters',

    // Directory for rate-limit data. Prefer a folder OUTSIDE public_html.
    'storage_dir'       => dirname(__DIR__, 2) . '/dng-data',
];
