import re
import requests
from urllib.parse import unquote

url = "https://educacion.castillalamancha.es/profesorado/bolsas-de-trabajo/procedimiento-de-renovacion-de-aspirantes-interinidades-y-solicitud-de-destinos-para-el-curso-1"
h = requests.get(url, headers={"User-Agent": "x"}, timeout=30).text

# Buscar bloques con "Admitidos ordinaria"
for m in re.finditer(r"Admitidos[^<]{0,80}", h, re.I):
    start = max(0, m.start() - 400)
    end = min(len(h), m.end() + 400)
    chunk = h[start:end]
    if "0590" in chunk or "0597" in chunk:
        print("--- chunk ---")
        print(chunk.replace("><", ">\n<")[:1200])
        print()

# Cualquier href con files/
print("=== href con files/ ===")
for m in re.finditer(r'href="([^"]*files/[^"]+)"', h, re.I):
    print(unquote(m.group(1))[:150])
