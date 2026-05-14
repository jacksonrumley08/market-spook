import { Line, LineChart, ResponsiveContainer, YAxis } from 'recharts';

export function Sparkline({
  data,
  width = 80,
  height = 20,
  color,
}: {
  data: { v: number }[] | number[];
  width?: number;
  height?: number;
  color?: string;
}) {
  const series = (data as any[]).map((p, i) =>
    typeof p === 'number' ? { v: p, i } : { v: p.v, i },
  );
  if (series.length < 2) return <div style={{ width, height }} />;
  const first = series[0].v;
  const last = series[series.length - 1].v;
  const stroke =
    color ?? (last > first ? 'var(--positive)' : last < first ? 'var(--negative)' : 'var(--text-secondary)');
  return (
    <div style={{ width, height }} className="inline-block">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={series} margin={{ top: 1, right: 1, left: 1, bottom: 1 }}>
          <YAxis hide domain={['dataMin', 'dataMax']} />
          <Line
            type="monotone"
            dataKey="v"
            stroke={stroke}
            strokeWidth={1.25}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
