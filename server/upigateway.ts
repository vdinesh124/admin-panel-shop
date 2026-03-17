const API_KEY = process.env.UPIGATEWAY_API_KEY || "";
const BASE_URL = "https://merchant.upigateway.com/api";

export interface UpiGatewayOrderResponse {
  status: boolean;
  msg: string;
  data: {
    order_id: number;
    payment_url: string;
    upi_intent?: {
      bhim_link?: string;
      phonepe_link?: string;
      paytm_link?: string;
      gpay_link?: string;
    };
  };
}

export interface UpiGatewayStatusResponse {
  status: boolean;
  msg: string;
  data: {
    id: number;
    customer_vpa: string;
    amount: number;
    client_txn_id: string;
    customer_name: string;
    customer_email: string;
    customer_mobile: string;
    p_info: string;
    upi_txn_id: string;
    status: "created" | "scanning" | "success" | "failure";
    remark: string;
    udf1: string;
    udf2: string;
    udf3: string;
    redirect_url: string;
    txnAt: string;
    createdAt: string;
  };
}

export function isUpiGatewayConfigured(): boolean {
  return !!API_KEY;
}

export async function createUpiGatewayOrder(
  clientTxnId: string,
  amount: number,
  customerName: string,
  customerEmail: string,
  customerMobile: string,
  redirectUrl: string
): Promise<UpiGatewayOrderResponse | null> {
  if (!API_KEY) return null;

  try {
    const response = await fetch(`${BASE_URL}/create_order`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key: API_KEY,
        client_txn_id: clientTxnId,
        amount: amount.toFixed(2),
        p_info: "Nexa Panel Wallet Deposit",
        customer_name: customerName || "Customer",
        customer_email: customerEmail || "customer@nexapanel.com",
        customer_mobile: customerMobile || "9999999999",
        redirect_url: redirectUrl,
      }),
    });

    const data = (await response.json()) as UpiGatewayOrderResponse;
    if (data.status) {
      return data;
    }
    console.error("UPIGateway create order error:", data.msg);
    return null;
  } catch (err) {
    console.error("UPIGateway create order error:", err);
    return null;
  }
}

export async function checkUpiGatewayStatus(
  clientTxnId: string,
  txnDate: string
): Promise<UpiGatewayStatusResponse | null> {
  if (!API_KEY) return null;

  try {
    const response = await fetch(`${BASE_URL}/check_order_status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key: API_KEY,
        client_txn_id: clientTxnId,
        txn_date: txnDate,
      }),
    });

    const data = (await response.json()) as UpiGatewayStatusResponse;
    return data;
  } catch (err) {
    console.error("UPIGateway status check error:", err);
    return null;
  }
}
