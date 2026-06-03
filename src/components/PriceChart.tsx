import React, { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { HistoryBar } from '../types';

interface PriceChartProps {
  data: HistoryBar[];
  symbol: string;
}

export function PriceChart({ data, symbol }: PriceChartProps) {
  // Take last 252 data points (approx 1 trading year)
  const chartData = useMemo(() => {
    if (!data) return [];
    return data.slice(-252).map(bar => ({
      ...bar,
      formattedDate: new Date(bar.date).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric'
      }),
      price: bar.close
    }));
  }, [data]);

  // Determine price bounds to focus Y Axis
  const bounds = useMemo(() => {
    if (chartData.length === 0) return { min: 'auto', max: 'auto' };
    const prices = chartData.map(d => d.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const padding = (max - min) * 0.05;
    return {
      min: Math.max(0, parseFloat((min - padding).toFixed(2))),
      max: parseFloat((max + padding).toFixed(2))
    };
  }, [chartData]);

  if (chartData.length === 0) {
    return (
      <div className="h-full flex items-center justify-center font-mono text-sm text-slate-500 italic bg-slate-900/40 rounded-xl border border-slate-800">
        No price data to render.
      </div>
    );
  }

  const isUp = chartData[chartData.length - 1].price >= chartData[0].price;
  const strokeColor = isUp ? '#34d399' : '#f87171'; // emerald-400 vs rose-400
  const gradId = `priceGrad-${symbol.replace(/[^a-zA-Z]/g, '')}`;

  return (
    <div id="price-chart" className="w-full h-full bg-slate-900/20 rounded-2xl border border-slate-800 p-5 relative overflow-hidden">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h4 className="font-bold text-white text-base tracking-tight">{symbol.split('.')[0]} Performance</h4>
          <p className="text-[10px] text-slate-500 font-mono font-bold uppercase tracking-widest mt-0.5">Asset Closing Price (Daily)</p>
        </div>
        <div className="flex gap-2">
          <span className="text-[10px] px-2 py-0.5 bg-slate-800 text-slate-400 border border-slate-700/60 rounded font-bold uppercase tracking-widest">
            {chartData.length} Trading Days
          </span>
        </div>
      </div>
      <div className="h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={strokeColor} stopOpacity={0.15} />
                <stop offset="95%" stopColor={strokeColor} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.1} vertical={false} />
            <XAxis 
              dataKey="formattedDate" 
              tickLine={false}
              axisLine={false}
              stroke="#64748b"
              fontSize={10}
              tickMargin={8}
            />
            <YAxis 
              domain={[bounds.min, bounds.max]}
              tickLine={false}
              axisLine={false}
              stroke="#64748b"
              fontSize={10}
              tickMargin={8}
              tickFormatter={(v) => `₹${v.toLocaleString()}`}
            />
            <Tooltip
              contentStyle={{ 
                backgroundColor: '#0f172a', 
                border: '1px solid #334155', 
                borderRadius: '8px',
                fontFamily: 'monospace',
                fontSize: '11px',
                color: '#f8fafc'
              }}
              labelStyle={{ color: '#94a3b8', fontWeight: 'bold' }}
              formatter={(v: any) => [`₹${v.toLocaleString()}`, 'Close']}
            />
            <Area 
              type="monotone" 
              dataKey="price" 
              stroke={strokeColor} 
              fillOpacity={1} 
              fill={`url(#${gradId})`}
              strokeWidth={1.8} 
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
