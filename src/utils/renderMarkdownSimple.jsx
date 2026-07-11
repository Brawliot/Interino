/** Renderizado mínimo de markdown para textos legales (sin dependencias). */
export function renderInline(text, linkColor) {
  const parts = [];
  const re = /(\*\*[^*]+\*\*|https?:\/\/[^\s)]+|[^\s]+@[^\s]+\.[^\s]+)/g;
  let last = 0;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const token = m[0];
    if (token.startsWith("**") && token.endsWith("**")) {
      parts.push(<strong key={m.index}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("http")) {
      parts.push(
        <a key={m.index} href={token} target="_blank" rel="noopener noreferrer" style={{ color: linkColor }}>
          {token}
        </a>
      );
    } else if (token.includes("@")) {
      parts.push(
        <a key={m.index} href={`mailto:${token}`} style={{ color: linkColor }}>
          {token}
        </a>
      );
    } else {
      parts.push(token);
    }
    last = m.index + token.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts.length ? parts : text;
}

export function renderMarkdownSimple(md, { FONT_BODY, linkColor }) {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const blocks = [];
  let listItems = null;

  const flushList = () => {
    if (!listItems?.length) return;
    blocks.push(
      <ul key={`ul-${blocks.length}`} style={{ margin: "0 0 14px", paddingLeft: 20, lineHeight: 1.5 }}>
        {listItems.map((item, i) => (
          <li key={i} style={{ marginBottom: 6, fontFamily: FONT_BODY, fontSize: 13.5, color: "inherit" }}>
            {renderInline(item, linkColor)}
          </li>
        ))}
      </ul>
    );
    listItems = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) {
      flushList();
      continue;
    }
    if (line.startsWith("# ")) {
      flushList();
      blocks.push(
        <h1 key={`h1-${i}`} style={{ fontFamily: FONT_BODY, fontSize: 22, fontWeight: 700, color: "inherit", margin: "0 0 12px" }}>
          {line.slice(2)}
        </h1>
      );
      continue;
    }
    if (line.startsWith("## ")) {
      flushList();
      blocks.push(
        <h2 key={`h2-${i}`} style={{ fontFamily: FONT_BODY, fontSize: 15, fontWeight: 700, color: "inherit", margin: "20px 0 8px" }}>
          {line.slice(3)}
        </h2>
      );
      continue;
    }
    if (line.startsWith("- ")) {
      if (!listItems) listItems = [];
      listItems.push(line.slice(2));
      continue;
    }
    flushList();
    blocks.push(
      <p key={`p-${i}`} style={{ fontFamily: FONT_BODY, fontSize: 13.5, lineHeight: 1.55, margin: "0 0 12px", color: "inherit" }}>
        {renderInline(line, linkColor)}
      </p>
    );
  }
  flushList();
  return blocks;
}
