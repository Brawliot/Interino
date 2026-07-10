import { LineChart, Line, ResponsiveContainer, YAxis } from "recharts";

export default function GraficoHistoricoCorte({ historial, colors: C }) {
  return (
    <div style={{ height: 52, marginTop: 14 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={historial}>
          <YAxis hide domain={["dataMin - 0.5", "dataMax + 0.5"]} />
          <Line type="monotone" dataKey="puntos" stroke={C.gold} strokeWidth={2.5} dot={{ r: 2.5, fill: C.navy }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
