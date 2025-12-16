import { Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

export type CategoryDonutDatum = {
  naam: string;
  bedrag: number;
};

type Props = {
  data: CategoryDonutDatum[];
};

const palette = ["#7c3aed", "#0ea5e9", "#14b8a6", "#f97316", "#6366f1", "#22c55e", "#f59e0b"];

export function CategoryPotsDonut({ data }: Props) {
  const chartData = data.map((item, idx) => ({ ...item, fill: palette[idx % palette.length] }));

  return (
    <div className="h-64 w-full rounded-2xl bg-white/70 p-4 shadow-md ring-1 ring-white/50">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            dataKey="bedrag"
            nameKey="naam"
            innerRadius={55}
            outerRadius={85}
            paddingAngle={2}
          />
          <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0" }} />
          <Legend verticalAlign="bottom" height={32} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
