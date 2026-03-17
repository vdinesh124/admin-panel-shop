import PaytmChecksum from "paytmchecksum";

const MID = process.env.PAYTM_MERCHANT_ID || "";
const MKEY = process.env.PAYTM_MERCHANT_KEY || "";
const IS_STAGING = MID.includes("TEST") || MID.includes("test");
const BASE_URL = IS_STAGING ? "https://securegw-stage.paytm.in" : "https://securegw.paytm.in";
const INITIATE_URL = `${BASE_URL}/theia/api/v1/initiateTransaction`;
const STATUS_URL = `${BASE_URL}/v3/order/status`;
const PROCESS_URL = `${BASE_URL}/theia/api/v1/processTransaction`;
const QR_URL = `${BASE_URL}/paymentservices/qr/create`;

export interface PaytmStatusResponse {
  body: {
    resultInfo: {
      resultStatus: string;
      resultCode: string;
      resultMsg: string;
    };
    txnId?: string;
    orderId?: string;
    txnAmount?: string;
    txnDate?: string;
    gatewayName?: string;
    bankTxnId?: string;
    bankName?: string;
  };
  head: {
    signature: string;
  };
}

export async function initiatePaytmTransaction(
  orderId: string,
  amount: number,
  customerId: string,
  mobile: string,
  callbackUrl: string
): Promise<{ txnToken: string; orderId: string; mid: string } | null> {
  if (!MID || !MKEY) return null;

  try {
    const paytmParams = {
      body: {
        requestType: "Payment",
        mid: MID,
        websiteName: IS_STAGING ? "WEBSTAGING" : "DEFAULT",
        orderId,
        callbackUrl,
        txnAmount: {
          value: amount.toFixed(2),
          currency: "INR",
        },
        userInfo: {
          custId: customerId,
          mobile,
        },
      },
    };

    const checksum = await PaytmChecksum.generateSignature(
      JSON.stringify(paytmParams.body),
      MKEY
    );

    const requestBody = {
      ...paytmParams,
      head: { signature: checksum },
    };

    const response = await fetch(`${INITIATE_URL}?mid=${MID}&orderId=${orderId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    const data = await response.json() as any;
    if (data?.body?.txnToken) {
      return { txnToken: data.body.txnToken, orderId, mid: MID };
    }
    console.error("Paytm initiate error:", JSON.stringify(data));
    return null;
  } catch (err) {
    console.error("Paytm initiate error:", err);
    return null;
  }
}

export async function createPaytmUpiQr(
  orderId: string,
  amount: number,
  txnToken: string
): Promise<string | null> {
  if (!MID || !MKEY) return null;
  try {
    const body = {
      mid: MID,
      orderId,
      amount: amount.toFixed(2),
    };
    const checksum = await PaytmChecksum.generateSignature(JSON.stringify(body), MKEY);

    const response = await fetch(QR_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body, head: { signature: checksum, txnToken } }),
    });
    const data = await response.json() as any;
    if (data?.body?.qrData) return data.body.qrData;
    return null;
  } catch {
    return null;
  }
}

export async function checkPaytmTransactionStatus(orderId: string): Promise<PaytmStatusResponse | null> {
  if (!MID || !MKEY) {
    console.error("Paytm credentials not configured");
    return null;
  }

  try {
    const paytmParams: Record<string, string> = {
      mid: MID,
      orderId: orderId,
    };

    const checksum = await PaytmChecksum.generateSignature(
      JSON.stringify(paytmParams),
      MKEY
    );

    const requestBody = {
      body: paytmParams,
      head: {
        signature: checksum,
      },
    };

    const response = await fetch(STATUS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      console.error("Paytm API error:", response.status);
      return null;
    }

    const data = (await response.json()) as PaytmStatusResponse;
    return data;
  } catch (err) {
    console.error("Paytm status check error:", err);
    return null;
  }
}

export function isPaymentSuccess(response: PaytmStatusResponse): boolean {
  return response?.body?.resultInfo?.resultStatus === "TXN_SUCCESS";
}

export function isPaymentPending(response: PaytmStatusResponse): boolean {
  const status = response?.body?.resultInfo?.resultStatus;
  return status === "PENDING" || status === "TXN_PENDING";
}

export function getPaytmMid(): string {
  return MID;
}

export function isPaytmConfigured(): boolean {
  return !!(MID && MKEY);
}

export function getPaytmBaseUrl(): string {
  return BASE_URL;
}
