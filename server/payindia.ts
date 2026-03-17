const API_KEY = process.env.PAYINDIA_API_KEY || "";
const BASE_URL = "https://payment.powercrker.fun/api";

export interface PayIndiaOrderResponse {
  status: boolean;
  message: string;
  result?: {
    orderId: string;
    payment_url: string;
  };
}

export interface PayIndiaStatusResult {
  txnStatus: string;
  resultInfo: string;
  orderId: string;
  status: string;
  amount: number | string;
  date: string;
}

export interface PayIndiaStatusResponse {
  status: string;
  message: string;
  result?: PayIndiaStatusResult;
}

export function isPayIndiaConfigured(): boolean {
  return !!API_KEY;
}

export async function createPayIndiaOrder(
  orderId: string,
  amount: number,
  customerMobile: string,
  redirectUrl: string,
  remark1?: string,
  remark2?: string
): Promise<PayIndiaOrderResponse | null> {
  if (!API_KEY) return null;

  try {
    const params = new URLSearchParams();
    params.append("user_token", API_KEY);
    params.append("order_id", orderId);
    params.append("amount", String(amount));
    params.append("customer_mobile", customerMobile || "9999999999");
    params.append("redirect_url", redirectUrl);
    if (remark1) params.append("remark1", remark1);
    if (remark2) params.append("remark2", remark2);

    const response = await fetch(`${BASE_URL}/create-order`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    const text = await response.text();
    if (!text || text.length === 0) {
      console.error("PayIndia create order: empty response");
      return null;
    }

    const data = JSON.parse(text) as PayIndiaOrderResponse;
    if (data.status && data.result?.payment_url) {
      return data;
    }
    console.error("PayIndia create order error:", data.message);
    return null;
  } catch (err) {
    console.error("PayIndia create order error:", err);
    return null;
  }
}

export async function checkPayIndiaStatus(
  orderId: string
): Promise<PayIndiaStatusResult | null> {
  if (!API_KEY) return null;

  try {
    const params = new URLSearchParams();
    params.append("user_token", API_KEY);
    params.append("order_id", orderId);

    const response = await fetch(`${BASE_URL}/check-order-status`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    const text = await response.text();
    if (!text || text.length === 0) return null;

    const data = JSON.parse(text) as PayIndiaStatusResponse;
    if (data.result && typeof data.result === "object") {
      return data.result;
    }
    return null;
  } catch (err) {
    console.error("PayIndia status check error:", err);
    return null;
  }
}
