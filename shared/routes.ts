import { z } from 'zod';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

export const api = {
  products: {
    list: {
      method: 'GET' as const,
      path: '/api/products' as const,
    },
  },
  wallet: {
    balance: {
      method: 'GET' as const,
      path: '/api/wallet/balance' as const,
    },
    topup: {
      method: 'POST' as const,
      path: '/api/wallet/topup' as const,
      input: z.object({
        amount: z.coerce.number().min(1).max(10000),
      }),
    },
    transactions: {
      method: 'GET' as const,
      path: '/api/wallet/transactions' as const,
    },
  },
  purchases: {
    buy: {
      method: 'POST' as const,
      path: '/api/purchases/buy' as const,
      input: z.object({
        tierId: z.coerce.number(),
      }),
    },
    list: {
      method: 'GET' as const,
      path: '/api/purchases' as const,
    },
  },
  dashboard: {
    stats: {
      method: 'GET' as const,
      path: '/api/dashboard/stats' as const,
    },
  },
  referrals: {
    info: {
      method: 'GET' as const,
      path: '/api/referrals' as const,
    },
  },
  payments: {
    create: {
      method: 'POST' as const,
      path: '/api/payments/create' as const,
      input: z.object({
        amount: z.coerce.number().min(1).max(50000),
      }),
    },
    confirm: {
      method: 'POST' as const,
      path: '/api/payments/confirm' as const,
      input: z.object({
        sessionId: z.coerce.number(),
      }),
    },
    status: {
      method: 'GET' as const,
      path: '/api/payments/:id' as const,
    },
    upiInfo: {
      method: 'GET' as const,
      path: '/api/payments/upi-info' as const,
    },
  },
  profile: {
    get: {
      method: 'GET' as const,
      path: '/api/profile' as const,
    },
    update: {
      method: 'POST' as const,
      path: '/api/profile' as const,
      input: z.object({
        firstName: z.string().min(1).max(50).optional(),
        lastName: z.string().max(50).optional(),
      }),
    },
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
