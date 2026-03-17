<?php
date_default_timezone_set("Asia/Kolkata");

define('ROOT_DIR', realpath(dirname(__FILE__)) . '/../');
include ROOT_DIR . 'pages/dbFunctions.php';
include ROOT_DIR . 'pages/dbInfo.php';

$link_token = sanitizeInput($_GET["token"]);
$sql_fetch_order_id = "SELECT order_id, created_at FROM payment_links WHERE link_token = '$link_token'";
$result = getXbyY($sql_fetch_order_id);

if (count($result) === 0) {
    echo "Token not found or expired";
    exit;
}

$order_id   = $result[0]['order_id'];
$created_at = strtotime($result[0]['created_at']);
$current_time = time();

if (($current_time - $created_at) > (5 * 60)) {
    echo "Token has expired";
    exit;
}

$slq_p = "SELECT * FROM orders WHERE order_id='$order_id'";
$res_p = getXbyY($slq_p);
$amount = $res_p[0]['amount'];
$user_token = $res_p[0]['user_token'];
$redirect_url = $res_p[0]['redirect_url'];
$payzerokalwaremark = $res_p[0]['byteTransactionId'];
$payzerobytectxnref = $res_p[0]['paytm_txn_ref'];

if ($redirect_url == '') {
    $redirect_url = 'https://' . $_SERVER["SERVER_NAME"] . '/';
}

$slq_p = "SELECT * FROM paytm_tokens WHERE user_token='$user_token'";
$res_p = getXbyY($slq_p);
$upi_id = $res_p[0]['Upiid'];

$slq_p = "SELECT * FROM users WHERE user_token='$user_token'";
$res_p = getXbyY($slq_p);
$unitId = $res_p[0]['name'];

$asdasd23 = "TXN" . rand(111, 999) . time() . rand(1, 100);
$orders = "upi://pay?pa=$upi_id&am=$amount&pn=$unitId&tn=$asdasd23&tr=$payzerobytectxnref";

$paytmintent = "paytmmp://cash_wallet?pa=$upi_id&pn=$unitId&am=$amount&cu=INR&tn=$payzerobytectxnref&tr=$payzerobytectxnref";
$phonepeIntent = "phonepe://pay?pa=$upi_id&pn=" . urlencode($unitId) . "&am=$amount&cu=INR&tn=$payzerobytectxnref&tr=$payzerobytectxnref";
$gpayIntent = "tez://upi/pay?pa=$upi_id&pn=" . urlencode($unitId) . "&am=$amount&cu=INR&tn=$payzerobytectxnref&tr=$payzerobytectxnref";

$url = 'https://' . $_SERVER["SERVER_NAME"] . '/payment/sys/';
$data = ['data' => $orders, 'ecc' => 'M', 'size' => 8];
$jsonData = json_encode($data);

$ch = curl_init($url);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
curl_setopt($ch, CURLOPT_POSTFIELDS, $jsonData);

$response = curl_exec($ch);
if (!curl_errno($ch)) {
    $result = json_decode($response, true);
    if (!isset($result['error'])) {
        $qrCodeBase64 = $result['qr_code'];
    }
}
curl_close($ch);
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Payment - <?php echo htmlspecialchars($unitId); ?></title>
  <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
  <script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body {
      font-family:'Inter',sans-serif;
      background: linear-gradient(180deg, #0c1024 0%, #1a1040 50%, #0c1024 100%);
      min-height:100vh;
      display:flex;
      align-items:flex-start;
      justify-content:center;
      padding:20px 16px;
    }
    .card {
      width:100%;
      max-width:380px;
      background: linear-gradient(180deg, #151a35 0%, #1c1445 100%);
      border-radius:20px;
      border:1px solid rgba(139,92,246,0.2);
      box-shadow:0 8px 40px rgba(0,0,0,0.5);
      padding:28px 24px 24px;
      text-align:center;
    }
    .badge {
      display:inline-flex;
      align-items:center;
      gap:6px;
      padding:6px 16px;
      border-radius:50px;
      background:rgba(34,197,94,0.12);
      border:1px solid rgba(34,197,94,0.25);
      color:#22c55e;
      font-size:12px;
      font-weight:700;
      margin-bottom:16px;
    }
    .badge svg { width:14px; height:14px; }
    .merchant-name {
      font-size:22px;
      font-weight:800;
      color:#fff;
      margin-bottom:18px;
      letter-spacing:0.5px;
    }
    .amount-box {
      background:rgba(139,92,246,0.08);
      border:1px solid rgba(139,92,246,0.2);
      border-radius:14px;
      padding:14px 20px 8px;
      margin-bottom:4px;
    }
    .amount-value {
      font-size:36px;
      font-weight:900;
      color:#fff;
    }
    .order-id {
      font-size:10px;
      color:#6b7280;
      font-weight:600;
      letter-spacing:1px;
      margin-bottom:20px;
    }
    .qr-wrapper {
      position:relative;
      width:220px;
      height:220px;
      margin:0 auto 18px;
    }
    .qr-border {
      position:absolute;
      inset:0;
      border-radius:18px;
      border:2px solid rgba(139,92,246,0.3);
    }
    .corner {
      position:absolute;
      width:24px;
      height:24px;
    }
    .corner-tl { top:-1px; left:-1px; border-top:3px solid #8b5cf6; border-left:3px solid #8b5cf6; border-radius:10px 0 0 0; }
    .corner-tr { top:-1px; right:-1px; border-top:3px solid #8b5cf6; border-right:3px solid #8b5cf6; border-radius:0 10px 0 0; }
    .corner-bl { bottom:-1px; left:-1px; border-bottom:3px solid #8b5cf6; border-left:3px solid #8b5cf6; border-radius:0 0 0 10px; }
    .corner-br { bottom:-1px; right:-1px; border-bottom:3px solid #8b5cf6; border-right:3px solid #8b5cf6; border-radius:0 0 10px 0; }
    .qr-inner {
      position:absolute;
      inset:10px;
      background:#fff;
      border-radius:12px;
      display:flex;
      align-items:center;
      justify-content:center;
      overflow:hidden;
    }
    .qr-inner img { width:100%; height:100%; object-fit:contain; }
    .scan-line {
      position:absolute;
      left:10px;
      right:10px;
      height:2px;
      background:linear-gradient(90deg, transparent, rgba(139,92,246,0.5), transparent);
      animation: scanMove 2.5s ease-in-out infinite;
    }
    @keyframes scanMove {
      0%,100% { top:30%; }
      50% { top:70%; }
    }
    .download-btn {
      width:100%;
      padding:12px;
      border-radius:12px;
      background:rgba(139,92,246,0.08);
      border:1px solid rgba(139,92,246,0.25);
      color:#a78bfa;
      font-size:14px;
      font-weight:700;
      cursor:pointer;
      display:flex;
      align-items:center;
      justify-content:center;
      gap:8px;
      margin-bottom:18px;
      transition:background 0.2s;
    }
    .download-btn:hover { background:rgba(139,92,246,0.15); }
    .download-btn svg { width:18px; height:18px; }
    .timer {
      display:flex;
      align-items:center;
      justify-content:center;
      gap:6px;
      margin-bottom:16px;
    }
    .timer-icon { font-size:20px; }
    .timer-value {
      font-size:22px;
      font-weight:800;
      color:#ef4444;
    }
    .status-bar {
      width:100%;
      padding:12px;
      border-radius:12px;
      background:rgba(34,197,94,0.08);
      border:1px solid rgba(34,197,94,0.2);
      display:flex;
      align-items:center;
      justify-content:center;
      gap:8px;
      margin-bottom:12px;
    }
    .status-dot {
      width:10px;
      height:10px;
      border-radius:50%;
      background:#22c55e;
      animation: pulse 1.5s ease-in-out infinite;
    }
    @keyframes pulse {
      0%,100% { opacity:1; transform:scale(1); }
      50% { opacity:0.5; transform:scale(0.8); }
    }
    .status-text {
      font-size:14px;
      font-weight:700;
      color:#22c55e;
    }
    .warning-text {
      font-size:11px;
      color:#6b7280;
      margin-bottom:18px;
    }
    .upi-apps {
      display:grid;
      grid-template-columns:1fr 1fr;
      gap:8px;
      margin-bottom:14px;
    }
    .upi-btn {
      padding:10px;
      border-radius:10px;
      background:rgba(255,255,255,0.04);
      border:1px solid rgba(255,255,255,0.08);
      color:#d1d5db;
      font-size:12px;
      font-weight:600;
      cursor:pointer;
      display:flex;
      align-items:center;
      justify-content:center;
      gap:6px;
      transition:background 0.2s;
    }
    .upi-btn:hover { background:rgba(255,255,255,0.08); }
    .upi-btn img { width:20px; height:20px; object-fit:contain; }
    .footer-text {
      font-size:10px;
      color:#4b5563;
      padding-top:12px;
      border-top:1px solid rgba(255,255,255,0.05);
    }

    .swal2-popup {
      background:#1c1445 !important;
      color:#fff !important;
      border:1px solid rgba(139,92,246,0.3) !important;
      border-radius:16px !important;
    }
    .swal2-title { color:#fff !important; }
    .swal2-html-container { color:#9ca3af !important; }
    .swal2-confirm { background:#22c55e !important; border-radius:10px !important; font-weight:700 !important; }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
      Verified Merchant
    </div>

    <div class="merchant-name"><?php echo htmlspecialchars($unitId); ?></div>

    <div class="amount-box">
      <div class="amount-value">₹<?php echo number_format((float)$amount, 2); ?></div>
    </div>
    <div class="order-id">ORDER ID: <?php echo htmlspecialchars($order_id); ?></div>

    <div class="qr-wrapper">
      <div class="qr-border"></div>
      <div class="corner corner-tl"></div>
      <div class="corner corner-tr"></div>
      <div class="corner corner-bl"></div>
      <div class="corner corner-br"></div>
      <div class="qr-inner">
        <img id="qr-image" src="<?php echo $qrCodeBase64; ?>" alt="QR Code">
      </div>
      <div class="scan-line"></div>
    </div>

    <button class="download-btn" onclick="saveQR()">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
      Download QR Code
    </button>

    <div class="timer">
      <span class="timer-icon">⏱</span>
      <span class="timer-value" id="timeout">05:00</span>
    </div>

    <div class="status-bar">
      <div class="status-dot"></div>
      <div class="status-text">Auto-verifying payment...</div>
    </div>

    <div class="warning-text">Please do not close this window after payment.</div>

    <div class="upi-apps">
      <button class="upi-btn" onclick="window.location.href='<?php echo $orders; ?>'">
        <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/e/e1/UPI-Logo-vector.svg/1200px-UPI-Logo-vector.svg.png" alt="UPI">
        Any UPI App
      </button>
      <button class="upi-btn" onclick="window.location.href='<?php echo $paytmintent; ?>'">
        <img src="https://upload.wikimedia.org/wikipedia/commons/2/24/Paytm_Logo_%28standalone%29.svg" alt="Paytm">
        Paytm
      </button>
      <button class="upi-btn" onclick="window.location.href='<?php echo $phonepeIntent; ?>'">
        <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/2/2f/PhonePe-Logo.wine.svg/800px-PhonePe-Logo.wine.svg.png" alt="PhonePe">
        PhonePe
      </button>
      <button class="upi-btn" onclick="shareImage()">
        <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/f/f2/Google_Pay_Logo.svg/512px-Google_Pay_Logo.svg.png" alt="GPay">
        Google Pay
      </button>
    </div>

    <div class="footer-text">Secured Payment Gateway</div>
  </div>

<script>
function saveQR() {
  const link = document.createElement('a');
  link.href = document.getElementById('qr-image').src;
  link.download = "qr-code.png";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

async function shareImage() {
  const imgElement = document.getElementById('qr-image');
  try {
    const response = await fetch(imgElement.src);
    const blob = await response.blob();
    const file = new File([blob], "qr.png", { type: blob.type });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ title: "Pay via GPay", text: "Scan this QR code to pay.", files: [file] });
    } else {
      window.location.href = '<?php echo $gpayIntent; ?>';
    }
  } catch(e) {
    window.location.href = '<?php echo $gpayIntent; ?>';
  }
}

function upiCountdown(elm, minute, second) {
  function pad(n) { return n < 10 ? '0' + n : n; }
  document.getElementById(elm).innerHTML = pad(minute) + ":" + pad(second);
  function startTimer() {
    var presentTime = document.getElementById(elm).innerHTML;
    var timeArray = presentTime.split(/[:]+/);
    var m = parseInt(timeArray[0]);
    var s = parseInt(timeArray[1]) - 1;
    if (s < 0) { s = 59; m = m - 1; }
    if (m < 0) {
      Swal.fire({ title: 'Session Expired', text: 'Payment session has timed out.', icon: 'error', confirmButtonText: 'OK' })
        .then(() => { window.location.href = "/"; });
      return;
    }
    document.getElementById(elm).innerHTML = pad(m) + ":" + pad(s);
    setTimeout(startTimer, 1000);
  }
  startTimer();
}
upiCountdown("timeout", 5, 0);

var paymentProcessed = false;
function checkPaymentStatus() {
  $.post("https://<?php echo $_SERVER["SERVER_NAME"] ?>/order3/payment-status",
    { byte_order_status: "<?php echo $payzerokalwaremark; ?>" },
    function(data) {
      if (!paymentProcessed) {
        if (data == 'success') {
          paymentProcessed = true;
          Swal.fire({ title: '', text: 'Payment Received', icon: 'success', confirmButtonText: 'Continue' })
            .then(() => { window.location.href = "<?php echo $redirect_url; ?>"; });
        } else if (data == 'FAILURE') {
          paymentProcessed = true;
          Swal.fire({ title: '', text: 'Payment Failed', icon: 'error', confirmButtonText: 'Retry' })
            .then(() => { window.location.href = "<?php echo $redirect_url; ?>"; });
        }
      }
    });
}
setInterval(checkPaymentStatus, 5000);
</script>
</body>
</html>
