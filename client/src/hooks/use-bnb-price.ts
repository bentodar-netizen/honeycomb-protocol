import { useQuery } from "@tanstack/react-query";

interface PriceResponse {
  symbol: string;
  price: number;
  priceScaled: string;
  timestamp: number;
  cached?: boolean;
}

export function useBnbPrice() {
  return useQuery<PriceResponse>({
    queryKey: ["/api/duels/binance/ticker/BNB"],
    refetchInterval: 30000,
    staleTime: 15000,
  });
}

export function formatUsd(amount: number): string {
  if (amount >= 1000000) {
    return `$${(amount / 1000000).toFixed(2)}M`;
  }
  if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(1)}k`;
  }
  return `$${amount.toFixed(2)}`;
}

export function bnbToUsd(bnbAmount: number, bnbPrice: number): number {
  return bnbAmount * bnbPrice;
}

export const GRADUATION_USD_TARGET = 50000;
