import { C } from "../theme.js";

// trazo subrayado, imperfecto, tipo rotulador
export default function Subrayado({ width = 168, color, style }) {
  return (
    <svg width={width} height="14" viewBox={`0 0 ${width} 14`} style={{ display: "block", marginTop: -6, ...style }} aria-hidden="true">
      <path
        d={`M3,9.5 C ${width * 0.28},4 ${width * 0.42},12 ${width * 0.6},7 S ${width * 0.86},3 ${width - 4},8.5`}
        fill="none"
        stroke={color || C.clay}
        strokeWidth="4.5"
        strokeLinecap="round"
        opacity="0.55"
      />
    </svg>
  );
}
