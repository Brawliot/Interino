import { LineChart, Line, ResponsiveContainer, YAxis, XAxis, Tooltip, CartesianGrid } from "recharts";

/** Eje Y invertido: #1 arriba (mejor puesto). */
export default function GraficoEvolucionPosicion({ serie, colors: C }) {
  if (!serie?.length) return null;

  return (
    <div style={{ width: "100%", height: 160, marginTop: 8 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={serie} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={C.line} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: C.inkSoft, fontSize: 10 }}
            tickLine={false}
            axisLine={{ stroke: C.line }}
            interval="preserveStartEnd"
          />
          <YAxis
            reversed
            allowDecimals={false}
            width={36}
            tick={{ fill: C.inkSoft, fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `#${v}`}
            domain={["dataMin - 2", "dataMax + 2"]}
          />
          <Tooltip
            contentStyle={{
              background: C.card,
              border: `1px solid ${C.line}`,
              borderRadius: 8,
              fontSize: 12,
            }}
            formatter={(value, name) => {
              if (name === "posicion") return [`#${value}`, "Posición"];
              if (name === "puntos") return [Number(value).toFixed(1), "Puntos"];
              return [value, name];
            }}
            labelFormatter={(label) => label}
          />
          <Line
            type="monotone"
            dataKey="posicion"
            stroke={C.navy}
            strokeWidth={2.5}
            dot={{ r: 3.5, fill: C.gold, stroke: C.navy, strokeWidth: 1 }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
