import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type MonthlySpendingChartDatum = {
  maand: string;
  potjes: number;
  schuld: number;
  totaal: number;
};

type Props = {
  data: MonthlySpendingChartDatum[];
};

const colors = {
  potjes: {
    stroke: "#7c3aed",
    fill: "#7c3aed33",
  },
  schuld: {
    stroke: "#0ea5e9",
    fill: "#0ea5e933",
  },
};

export function MonthlySpendingStackedChart({ data }: Props) {
  return (
    <div className="h-64 w-full rounded-2xl bg-white/70 p-4 shadow-md ring-1 ring-white/50">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 20, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="gradPotjes" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={colors.potjes.stroke} stopOpacity={0.35} />
              <stop offset="95%" stopColor={colors.potjes.stroke} stopOpacity={0.05} />
            </linearGradient>
            <linearGradient id="gradSchuld" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={colors.schuld.stroke} stopOpacity={0.35} />
              <stop offset="95%" stopColor={colors.schuld.stroke} stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="maand" tick={{ fill: "#475569", fontSize: 12 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: "#475569", fontSize: 12 }} axisLine={false} tickLine={false} width={60} />
          <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0" }} />
          <Legend verticalAlign="top" height={24} />
          <Area
            type="monotone"
            dataKey="potjes"
            stackId="1"
            stroke={colors.potjes.stroke}
            fill="url(#gradPotjes)"
            strokeWidth={2}
          />
          <Area
            type="monotone"
            dataKey="schuld"
            stackId="1"
            stroke={colors.schuld.stroke}
            fill="url(#gradSchuld)"
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
