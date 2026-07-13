/** Logotipo prototipo — marca + wordmark en paleta expediente. */
export default function LogoInterino({ height = 32, C }) {
  const w = height * (168 / 36);
  return (
    <svg
      width={w}
      height={height}
      viewBox="0 0 168 36"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Interino"
    >
      <defs>
        <linearGradient id="logoGold" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={C.goldSoft} />
          <stop offset="100%" stopColor={C.gold} />
        </linearGradient>
      </defs>

      {/* Marca: expediente con posición # */}
      <rect x="0" y="2" width="30" height="32" rx="6" fill={C.navy} />
      <rect x="3" y="5" width="24" height="26" rx="4" fill={C.navyDeep} stroke={C.gold} strokeWidth="0.75" opacity="0.9" />
      <line x1="7" y1="11" x2="23" y2="11" stroke={C.goldSoft} strokeWidth="1.2" strokeLinecap="round" opacity="0.85" />
      <line x1="7" y1="16" x2="19" y2="16" stroke={C.goldSoft} strokeWidth="1.2" strokeLinecap="round" opacity="0.6" />
      <line x1="7" y1="21" x2="21" y2="21" stroke={C.goldSoft} strokeWidth="1.2" strokeLinecap="round" opacity="0.45" />
      <text
        x="15"
        y="29"
        textAnchor="middle"
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 7,
          fontWeight: 700,
          fill: "url(#logoGold)",
        }}
      >
        #
      </text>

      {/* Wordmark */}
      <text
        x="38"
        y="25"
        style={{
          fontFamily: "'Fraunces', serif",
          fontSize: 22,
          fontWeight: 600,
          fill: C.navy,
          letterSpacing: "-0.02em",
        }}
      >
        Interino
      </text>

      {/* Subrayado dorado sutil */}
      <path
        d="M38 30.5 Q52 33 78 30 Q95 28 118 31"
        fill="none"
        stroke={C.gold}
        strokeWidth="1.25"
        strokeLinecap="round"
        opacity="0.55"
      />
    </svg>
  );
}
