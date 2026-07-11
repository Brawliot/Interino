import politicaMd from "../../politica-privacidad.md?raw";
import { renderMarkdownSimple } from "../utils/renderMarkdownSimple.jsx";

const FONT_BODY = "'Inter', system-ui, sans-serif";

export default function PantallaPoliticaPrivacidad({ C, Barra, atras }) {
  const contenido = renderMarkdownSimple(politicaMd, { FONT_BODY, linkColor: C.navy });

  return (
    <div>
      <Barra titulo="Política de privacidad" atras={atras} />
      <article
        className="px-5 pb-8"
        style={{
          fontFamily: FONT_BODY,
          color: C.ink,
          maxWidth: "100%",
        }}
      >
        {contenido}
      </article>
    </div>
  );
}
