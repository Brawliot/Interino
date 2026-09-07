export const C = {
  paper: "#F3F0E6",
  paperDeep: "#E8E2D2",
  ink: "#20281F",
  inkSoft: "#5B6355",
  navy: "#233D30",
  navyDeep: "#152A20",
  gold: "#B07A3B",
  goldSoft: "#E6CE9F",
  clay: "#B5562F",
  card: "#FBF9F3",
  line: "#D9D0BA",
  ok: "#3C6B4A",
  okBg: "#E3EADB",
};

// textura de grano de papel, reutilizable como fondo
export const GRAIN =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='140' height='140'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.05'/></svg>`
  );

export const FONT_DISPLAY = "'Fraunces', serif";
export const FONT_BODY = "'Inter', system-ui, sans-serif";
export const FONT_MONO = "'JetBrains Mono', 'Courier New', monospace";
