import { potColors } from "../../data/potColors";
﻿import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

export type CategoryDonutDatum = {
  naam: string;
  bedrag: number;
  color?: string;
};

type Props = {
  data: CategoryDonutDatum[];
  showLegend?: boolean;
};



export function CategoryPotsDonut({ data, showLegend = true }: Props) {
  const chartData = data.map((item, idx) => ({ ...item, fill: item.color ?? potColors[idx % potColors.length] }));

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
            isAnimationActive={false}
          >
            {chartData.map(item => <Cell key={item.naam} fill={item.fill} />)}
          </Pie>
          <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0" }} />
          {showLegend && <Legend verticalAlign="bottom" height={32} />}
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
