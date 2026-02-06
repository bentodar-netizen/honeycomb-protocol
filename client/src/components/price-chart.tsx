import { useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { formatEther } from "viem";
import { format } from "date-fns";
import type { LaunchTrade } from "@shared/schema";

interface PriceChartProps {
  trades: LaunchTrade[];
  symbol: string;
  totalRaisedNative: string;
}

export function PriceChart({ trades, symbol, totalRaisedNative }: PriceChartProps) {
  const chartData = useMemo(() => {
    if (trades.length === 0) {
      const virtualReserveNative = BigInt("1000000000000000000");
      const virtualReserveToken = BigInt("800000000000000000000000000");
      const initialPrice = Number(virtualReserveNative) / Number(virtualReserveToken);
      
      const now = Date.now();
      return [
        { time: now - 3600000, price: initialPrice, label: "1h ago" },
        { time: now, price: initialPrice, label: "Now" },
      ];
    }

    const sortedTrades = [...trades].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    let cumulativeNative = BigInt("1000000000000000000");
    let cumulativeToken = BigInt("800000000000000000000000000");

    const dataPoints = sortedTrades.map((trade) => {
      const nativeAmount = BigInt(trade.nativeAmount);
      const tokenAmount = BigInt(trade.tokenAmount);

      if (trade.isBuy) {
        cumulativeNative += nativeAmount;
        cumulativeToken -= tokenAmount;
      } else {
        cumulativeNative -= nativeAmount;
        cumulativeToken += tokenAmount;
      }

      const price = cumulativeToken > BigInt(0) 
        ? Number(cumulativeNative) / Number(cumulativeToken)
        : 0;

      return {
        time: new Date(trade.createdAt).getTime(),
        price,
        label: format(new Date(trade.createdAt), "HH:mm"),
      };
    });

    return dataPoints;
  }, [trades]);

  const currentPrice = chartData.length > 0 ? chartData[chartData.length - 1].price : 0;
  const priceChange = chartData.length >= 2 
    ? ((chartData[chartData.length - 1].price - chartData[0].price) / chartData[0].price) * 100
    : 0;
  const isPositive = priceChange >= 0;

  const formatPrice = (price: number) => {
    if (price === 0) return "0";
    if (price < 0.000001) return price.toExponential(4);
    if (price < 0.001) return price.toFixed(9);
    if (price < 1) return price.toFixed(6);
    return price.toFixed(4);
  };

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-sm text-muted-foreground">Price</p>
          <p className="text-xl font-bold font-mono">
            {formatPrice(currentPrice)} BNB
          </p>
        </div>
        <div className={`text-right ${isPositive ? "text-green-500" : "text-red-500"}`}>
          <p className="text-sm text-muted-foreground">24h Change</p>
          <p className="font-medium">
            {isPositive ? "+" : ""}{priceChange.toFixed(2)}%
          </p>
        </div>
      </div>

      <div className="h-[200px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={isPositive ? "#22c55e" : "#ef4444"} stopOpacity={0.3} />
                <stop offset="95%" stopColor={isPositive ? "#22c55e" : "#ef4444"} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis 
              dataKey="label" 
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              minTickGap={30}
            />
            <YAxis 
              hide
              domain={['auto', 'auto']}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
                fontSize: "12px",
              }}
              labelStyle={{ color: "hsl(var(--foreground))" }}
              formatter={(value: number) => [formatPrice(value) + " BNB", "Price"]}
            />
            <Area
              type="monotone"
              dataKey="price"
              stroke={isPositive ? "#22c55e" : "#ef4444"}
              strokeWidth={2}
              fill="url(#priceGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-3 gap-4 mt-4 text-center">
        <div>
          <p className="text-xs text-muted-foreground">Market Cap</p>
          <p className="font-medium text-sm font-mono">
            {formatEther(BigInt(totalRaisedNative || "0"))} BNB
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Total Trades</p>
          <p className="font-medium text-sm">{trades.length}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Symbol</p>
          <p className="font-medium text-sm">${symbol}</p>
        </div>
      </div>
    </div>
  );
}
