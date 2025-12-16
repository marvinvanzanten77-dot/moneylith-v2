import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type DebtOverTimeDatum = {
  maand: string;
  doel: number;
  betaald: number;
};

type Props = {
  data: DebtOverTimeDatum[];
};

const colors = {
  doel: { stroke: "#0ea5e9", fill: "#0ea5e933" },
  betaald: { stroke: "#22c55e", fill: "#22c55e33" },
};

export function DebtOverTimeChart({ data }: Props) {
  return (
    <div className="h-64 w-full rounded-2xl bg-white/70 p-4 shadow-md ring-1 ring-white/50">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="gradDoel" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={colors.doel.stroke} stopOpacity={0.35} />
              <stop offset="95%" stopColor={colors.doel.stroke} stopOpacity={0.05} />
            </linearGradient>
            <linearGradient id="gradBetaald" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={colors.betaald.stroke} stopOpacity={0.35} />
              <stop offset="95%" stopColor={colors.betaald.stroke} stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="maand" tick={{ fill: "#475569", fontSize: 12 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: "#475569", fontSize: 12 }} axisLine={false} tickLine={false} width={60} />
          <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0" }} />
          <Legend verticalAlign="top" height={24} />
          <Area
            type="monotone"
            dataKey="doel"
            stroke={colors.doel.stroke}
            fill="url(#gradDoel)"
            strokeWidth={2}
          />
          <Area
            type="monotone"
            dataKey="betaald"
            stroke={colors.betaald.stroke}
            fill="url(#gradBetaald)"
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
