<?php
header('Content-Type: application/json');

// Configuration
$storageDir = 'cards/';
$retentionDays = 30;
$gcProbability = 0.05; // 5% chance to run cleanup

/* --- 1. GARBAGE COLLECTION --- */
// Randomly trigger cleanup to delete files older than $retentionDays
if ((mt_rand() / mt_getrandmax()) < $gcProbability) {
    if (is_dir($storageDir)) {
        $files = glob($storageDir . '*.json');
        $now = time();
        foreach ($files as $file) {
            if (is_file($file)) {
                $fileAge = $now - filemtime($file);
                if ($fileAge > ($retentionDays * 86400)) {
                    @unlink($file); // Suppress errors
                }
            }
        }
    }
}

/* --- 2. INPUT VALIDATION --- */
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method Not Allowed']);
    exit;
}

$input = file_get_contents('php://input');
$data = json_decode($input, true);

if (!$data || !isset($data['message']) || !isset($data['style'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid data']);
    exit;
}

// Sanitize purely for storage safety (HTML escaping handled on client read)
// We just store the JSON as is, but ensure directory exists
if (!is_dir($storageDir)) {
    if (!mkdir($storageDir, 0755, true)) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to create storage directory']);
        exit;
    }
}

/* --- 3. GENERATE ID & SAVE --- */
// Generate a short random ID (6 chars)
$id = substr(bin2hex(random_bytes(4)), 0, 6);
$filename = $storageDir . $id . '.json';

// Minimal data to save space
$payload = [
    'to' => substr(htmlspecialchars($data['to'] ?? ''), 0, 100),
    's'  => substr(htmlspecialchars($data['sender'] ?? ''), 0, 100),
    'm'  => substr(htmlspecialchars($data['message'] ?? ''), 0, 500),
    'st' => preg_replace('/[^a-z0-9-]/', '', $data['style']), // strict alphanumeric for style
    'ts' => time()
];

if (file_put_contents($filename, json_encode($payload))) {
    echo json_encode(['success' => true, 'id' => $id]);
} else {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to save file']);
}
?>
