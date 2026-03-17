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
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Page</title>
  <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
  <script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
  <style>
    body { background:#f5f5f7; font-family:Inter,Arial,sans-serif; margin:0; }
    .container { width:360px; margin:20px auto; background:#fff; border-radius:14px; box-shadow:0 4px 12px rgba(0,0,0,.1); overflow:hidden; }
    .header { background:#2da940; color:#fff; padding:14px 18px; display:flex; justify-content:space-between; align-items:center; }
    .merchant-box { display:flex; align-items:center; gap:10px; }
    .merchant-logo { font-size:28px; } /* 🏬 emoji */
    .merchant-name { font-weight:600; font-size:1.05em; display:flex; align-items:center; gap:6px; }
    .merchant-name .verified { font-size:.85em; font-weight:500; color:#eafee9; display:flex; align-items:center; gap:4px; }
    .verified-logo { width:16px; height:16px; vertical-align:middle; }
    .amount { font-size:1.2em; font-weight:700; }
    .qr-block { text-align:center; padding:20px; }
    .qr-block img { width:180px; height:180px; border:1px solid #e5e5e5; border-radius:8px; background:#fff; }
    .scan-text { margin-top:10px; font-size:.95em; }
    .save-btn { margin-top:16px; padding:10px 24px; background:#20b544; color:#fff; border:none; border-radius:8px; cursor:pointer; font-weight:600; }
    .save-btn:hover { background:#189a38; }
    .instructions { background:#e7f7eb; margin:18px; padding:12px; border-radius:8px; font-size:.9em; color:#333; line-height:1.5; }
    .buttons { text-align:center; padding:0 0 20px; }
    .payment-btn { width:85%; margin:8px auto; display:flex; align-items:center; justify-content:center; gap:8px;
      padding:10px; border:1px solid #ddd; border-radius:8px; background:#fff; cursor:pointer; font-weight:600; }
    .payment-btn img { width:22px; height:auto; }
    .footer { text-align:center; font-size:.85em; padding:12px; color:#555; border-top:1px solid #eee; }
    #timeout { font-weight:600; font-size:.9em; }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <div class="header">
      <div class="merchant-box">
        <div class="merchant-logo">🏬</div>
        <div class="merchant-name">
          <?php echo htmlspecialchars($unitId); ?>
          <span class="verified">
            <img src="https://cdn-icons-png.flaticon.com/512/10703/10703030.png" class="verified-logo" alt="Verified"> Verified
          </span>
        </div>
      </div>
      <div class="amount">₹<?php echo $amount; ?></div>
    </div>

    <!-- QR Block -->
    <div class="qr-block">
      <img id="qr-image" src="<?php echo $qrCodeBase64; ?>" alt="QR Code">
      <div class="scan-text">Scan with any UPI app</div>
      <button class="save-btn" onclick="saveQR()">Save QR Code</button>
    </div>

    <!-- Instructions -->
    <div class="instructions">
      ✅ Stay on this page after completing your payment.<br>
      ✅ Do not press back or refresh while paying.<br>
      ✅ Payment will be detected automatically.
    </div>

    <!-- Payment Buttons -->
    <div class="buttons">
      <button class="payment-btn" onclick="window.location.href='<?php echo $paytmintent; ?>'">
        <img src="https://upload.wikimedia.org/wikipedia/commons/1/15/Paytm_logo.png" alt="Paytm"> Pay via Paytm
      </button>
      <button class="payment-btn" onclick="shareImage()">
        <img src="https://upload.wikimedia.org/wikipedia/commons/5/5a/Google_Pay_Logo.svg" alt="Google Pay"> Pay via Google Pay
      </button>
    </div>

    <!-- Footer -->
    <div class="footer">
      <span id="timeout"></span> • This payment is secured by chuimei-pe.
    </div>
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
  const response = await fetch(imgElement.src);
  const blob = await response.blob();
  const file = new File([blob], "qr.png", { type: blob.type });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    await navigator.share({ title: "Pay via GPay", text: "Scan this QR code to pay.", files: [file] });
  } else { alert("Sharing not supported, try downloading the QR."); }
}

function upiCountdown(elm, minute, second) {
  document.getElementById(elm).innerHTML = minute+":"+second;
  function startTimer() {
    var presentTime=document.getElementById(elm).innerHTML;
    var timeArray=presentTime.split(/[:]+/);
    var m=timeArray[0];
    var s=checkSecond((timeArray[1]-1));
    if(s==59){m=m-1;}
    if(m<0){Swal.fire({title:'Oops',text:'Transaction Timeout!',icon:'error'});window.location.href="/";}
    document.getElementById(elm).innerHTML=m+":"+s;
    setTimeout(startTimer,1000);
  }
  function checkSecond(sec){ if(sec<10&&sec>=0){sec="0"+sec;} if(sec<0){sec="59";} return sec;}
  startTimer();
}
upiCountdown("timeout",5,0);

var paymentProcessed=false;
function checkPaymentStatus(){
  $.post("https://<?php echo $_SERVER["SERVER_NAME"] ?>/order3/payment-status",
    {byte_order_status:"<?php echo $payzerokalwaremark; ?>"},
    function(data){
      if(!paymentProcessed){
        if(data=='success'){paymentProcessed=true;Swal.fire("","Payment Received","success");
          window.location.href="<?php echo $redirect_url; ?>";}
        else if(data=='FAILURE'){paymentProcessed=true;Swal.fire("","Payment Failed","error");
          window.location.href="<?php echo $redirect_url; ?>";}
      }
    });
}
setInterval(checkPaymentStatus,5000);
</script>
</body>
</html>