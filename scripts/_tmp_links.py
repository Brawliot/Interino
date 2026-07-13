import re
import requests
from urllib.parse import unquote, urljoin

BASE = "https://educacion.castillalamancha.es"
pages = [
    f"{BASE}/profesorado/bolsas-de-trabajo/procedimiento-de-renovacion-de-aspirantes-interinidades-y-solicitud-de-destinos-para-el-curso-1",
    f"{BASE}/profesorado/bolsas-de-trabajo/bolsas-interinos-071224",
    f"{BASE}/profesorado/bolsas-de-trabajo",
]

for url in pages:
    h = requests.get(url, headers={"User-Agent": "x"}, timeout=30).text
    print("\n===", url.split("/")[-1], "===")
    # Drupal file links: href may be relative
    for m in re.finditer(r'href="([^"]+\.pdf[^"]*)"', h, re.I):
        href = m.group(1)
        full = urljoin(BASE, href)
        name = unquote(full.split("/")[-1])
        if any(k in name.lower() for k in ("admitid", "ordinaria", "0590", "0597", "bolsa")):
            print(name)
            print(" ", full)
