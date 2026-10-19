<?php
/**
 * DeliveryNextGen V2 — demo request handler.
 *
 * Layers of protection (in order):
 *  1. POST only, body size limit
 *  2. Same-origin check (Origin / Referer + Sec-Fetch-Site)
 *  3. CSRF token bound to the session (hash_equals)
 *  4. Honeypot field + minimum fill time (silent drop for bots)
 *  5. Per-session cooldown and per-IP rate limit (salted hash, no raw IPs stored)
 *  6. Strict server-side validation and whitelists
 *  7. Header-injection-safe mail composition (no user data in headers except a validated email)
 */
declare(strict_types=1);

require __DIR__ . '/includes/bootstrap.php';

$lang = (($_POST['lang'] ?? '') === 'pl') ? 'pl' : 'en';
$M = [
    'en' => [
        'method'   => 'Method not allowed.',
        'forbidden'=> 'Request blocked. Please submit the form from our website.',
        'csrf'     => 'Your session has expired. Please submit the form again.',
        'cooldown' => 'Please wait %d seconds before sending another message.',
        'rate'     => 'Too many requests from your network. Please try again later or email us directly.',
        'invalid'  => 'Please correct the highlighted fields.',
        'required' => 'This field is required.',
        'name'     => 'Please use letters only (max. 50 characters).',
        'email'    => 'Enter a valid email address.',
        'phone'    => 'Enter a valid phone number.',
        'company'  => 'Max. 120 characters.',
        'choice'   => 'Please choose an option from the list.',
        'message'  => 'Please write between 20 and 3000 characters.',
        'b2b'      => 'Our services are available to business customers only.',
        'privacy'  => 'Please confirm you have read the privacy notice.',
        'mail'     => 'We could not send your message right now. Please email us directly.',
        'ok'       => 'Thank you. We will reply within one business day.',
        'too_big'  => 'The request is too large.',
    ],
    'pl' => [
        'method'   => 'Niedozwolona metoda.',
        'forbidden'=> 'Żądanie zablokowane. Wyślij formularz z naszej strony.',
        'csrf'     => 'Sesja wygasła. Wyślij formularz ponownie.',
        'cooldown' => 'Odczekaj %d s przed wysłaniem kolejnej wiadomości.',
        'rate'     => 'Zbyt wiele zgłoszeń z Twojej sieci. Spróbuj później lub napisz do nas e-mail.',
        'invalid'  => 'Popraw zaznaczone pola.',
        'required' => 'To pole jest wymagane.',
        'name'     => 'Użyj wyłącznie liter (maks. 50 znaków).',
        'email'    => 'Podaj poprawny adres e-mail.',
        'phone'    => 'Podaj poprawny numer telefonu.',
        'company'  => 'Maks. 120 znaków.',
        'choice'   => 'Wybierz opcję z listy.',
        'message'  => 'Napisz od 20 do 3000 znaków.',
        'b2b'      => 'Nasze usługi są dostępne wyłącznie dla przedsiębiorców.',
        'privacy'  => 'Potwierdź zapoznanie się z informacją o przetwarzaniu danych.',
        'mail'     => 'Nie udało się teraz wysłać wiadomości. Napisz do nas bezpośrednio e-mail.',
        'ok'       => 'Dziękujemy. Odpowiemy w ciągu jednego dnia roboczego.',
        'too_big'  => 'Żądanie jest zbyt duże.',
    ],
][$lang];

// 1. Method & size ----------------------------------------------------------
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Allow: POST');
    dng_json(405, ['status' => 'error', 'message' => $M['method']]);
}
if ((int) ($_SERVER['CONTENT_LENGTH'] ?? 0) > $DNG['max_body_bytes']) {
    dng_json(413, ['status' => 'error', 'message' => $M['too_big']]);
}

// 2. Same origin -------------------------------------------------------------
if (!dng_same_origin($DNG['allowed_hosts'])) {
    dng_json(403, ['status' => 'error', 'message' => $M['forbidden']]);
}

// 3. CSRF --------------------------------------------------------------------
dng_session($DNG['token_ttl']);
$token   = (string) ($_POST['csrf'] ?? '');
$issued  = (int) ($_SESSION['csrf_t'] ?? 0);
$expected = (string) ($_SESSION['csrf'] ?? '');
if ($expected === '' || $token === '' || !hash_equals($expected, $token) || (time() - $issued) > $DNG['token_ttl']) {
    dng_json(403, ['status' => 'error', 'code' => 'csrf', 'message' => $M['csrf']]);
}

// 4. Honeypot & timing (pretend success so bots learn nothing) ----------------
if (!empty($_POST['website']) || (time() - $issued) < $DNG['min_fill_seconds']) {
    dng_json(200, ['status' => 'success', 'message' => $M['ok']]);
}

// 5. Cooldown & rate limit ---------------------------------------------------
$last = (int) ($_SESSION['last_submit'] ?? 0);
if ($last && (time() - $last) < $DNG['session_cooldown']) {
    header('Retry-After: ' . ($DNG['session_cooldown'] - (time() - $last)));
    dng_json(429, ['status' => 'error', 'message' => sprintf($M['cooldown'], $DNG['session_cooldown'] - (time() - $last))]);
}
if (dng_rate_limited($DNG)) {
    header('Retry-After: ' . $DNG['ip_window']);
    dng_json(429, ['status' => 'error', 'message' => $M['rate']]);
}

// 6. Validation --------------------------------------------------------------
$types = [
    'restaurant' => 'Restaurant / food business',
    'ecommerce'  => 'E-commerce / retail',
    'logistics'  => 'Logistics company',
    'campus'     => 'Campus / estate / site operator',
    'other'      => 'Other business',
];
$plans = ['unsure' => 'Not sure yet', 'starter' => 'Starter', 'growth' => 'Growth', 'enterprise' => 'Enterprise'];

$in = [
    'firstname' => dng_clean((string) ($_POST['firstname'] ?? '')),
    'lastname'  => dng_clean((string) ($_POST['lastname'] ?? '')),
    'email'     => dng_clean((string) ($_POST['email'] ?? '')),
    'company'   => dng_clean((string) ($_POST['company'] ?? '')),
    'phone'     => dng_clean((string) ($_POST['phone'] ?? '')),
    'user_type' => (string) ($_POST['user_type'] ?? ''),
    'plan'      => (string) ($_POST['plan'] ?? 'unsure'),
    'message'   => dng_clean((string) ($_POST['message'] ?? ''), true),
];
$errors = [];

foreach (['firstname', 'lastname'] as $f) {
    if ($in[$f] === '') {
        $errors[$f] = $M['required'];
    } elseif (mb_strlen($in[$f]) > 50 || !preg_match("/^[\\p{L}\\p{M}][\\p{L}\\p{M}' .\\-]*$/u", $in[$f])) {
        $errors[$f] = $M['name'];
    }
}
if ($in['email'] === '') {
    $errors['email'] = $M['required'];
} elseif (strlen($in['email']) > 254 || filter_var($in['email'], FILTER_VALIDATE_EMAIL) === false) {
    $errors['email'] = $M['email'];
}
if ($in['company'] === '') {
    $errors['company'] = $M['required'];
} elseif (mb_strlen($in['company']) > 120) {
    $errors['company'] = $M['company'];
}
if ($in['phone'] !== '' && !preg_match('/^[+\d][\d\s()\-]{5,24}$/', $in['phone'])) {
    $errors['phone'] = $M['phone'];
}
if (!isset($types[$in['user_type']])) {
    $errors['user_type'] = $M['choice'];
}
if (!isset($plans[$in['plan']])) {
    $errors['plan'] = $M['choice'];
}
$len = mb_strlen($in['message']);
if ($len < 20 || $len > 3000) {
    $errors['message'] = $len === 0 ? $M['required'] : $M['message'];
}
if (($_POST['b2b'] ?? '') !== '1') {
    $errors['b2b'] = $M['b2b'];
}
if (($_POST['privacy'] ?? '') !== '1') {
    $errors['privacy'] = $M['privacy'];
}
if ($errors) {
    dng_json(422, ['status' => 'error', 'message' => $M['invalid'], 'errors' => $errors]);
}

// 7. Compose & send ----------------------------------------------------------
$fullName = $in['firstname'] . ' ' . $in['lastname'];
$subject  = mb_encode_mimeheader('DeliveryNextGen: demo request from ' . $fullName, 'UTF-8', 'B', "\r\n");
$stamp    = gmdate('Y-m-d H:i:s') . ' UTC';

$body  = "New demo request from the website\n";
$body .= str_repeat('-', 50) . "\n";
$body .= "Name:         {$fullName}\n";
$body .= "Email:        {$in['email']}\n";
$body .= "Company:      {$in['company']}\n";
$body .= 'Phone:        ' . ($in['phone'] !== '' ? $in['phone'] : '-') . "\n";
$body .= "Business:     {$types[$in['user_type']]}\n";
$body .= "Plan:         {$plans[$in['plan']]}\n";
$body .= 'Language:     ' . strtoupper($lang) . "\n";
$body .= str_repeat('-', 50) . "\n\n";
$body .= "Message:\n{$in['message']}\n\n";
$body .= str_repeat('-', 50) . "\n";
$body .= "Declarations (ticked by the sender at {$stamp}):\n";
$body .= " - acts on behalf of a business (B2B)\n";
$body .= " - has read the privacy policy / GDPR information notice\n";
$body .= "Retention: delete this enquiry 12 months after the last contact unless a contract is signed.\n";

$from = filter_var($DNG['from_address'], FILTER_VALIDATE_EMAIL);
if ($from === false) {
    error_log('DNG: invalid from_address in config');
    dng_json(500, ['status' => 'error', 'message' => $M['mail']]);
}
$headers = [
    'From: ' . mb_encode_mimeheader($DNG['from_name'], 'UTF-8', 'B') . ' <' . $from . '>',
    'Reply-To: ' . $in['email'],               // validated address only — no free text in headers
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    'Auto-Submitted: auto-generated',
];
$params = $DNG['envelope_sender'] ? '-f' . $from : '';

$sent = $params !== ''
    ? @mail($DNG['recipient'], $subject, $body, implode("\r\n", $headers), $params)
    : @mail($DNG['recipient'], $subject, $body, implode("\r\n", $headers));

if (!$sent) {
    error_log('DNG: mail() returned false');
    dng_json(500, ['status' => 'error', 'message' => $M['mail']]);
}

dng_rate_limited($DNG, true);
$_SESSION['last_submit'] = time();
unset($_SESSION['csrf'], $_SESSION['csrf_t']); // one token per submission

dng_json(200, ['status' => 'success', 'message' => $M['ok']]);
