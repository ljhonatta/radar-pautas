"""Coletor do Radar de Pautas: roda no GitHub Actions, sem o Claude.

Lê feeds RSS e buscas do Google Notícias, pede à OpenAI para escolher e
escrever as pautas (só com fatos da fonte) e grava docs/data/pautas.json e
docs/data/meta.json, que o painel no GitHub Pages lê.
"""
import json, os, re, sys, time, unicodedata
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from urllib.parse import quote_plus, urlparse

import feedparser
import requests
from bs4 import BeautifulSoup

BRT = timezone(timedelta(hours=-3))
RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ARQ_PAUTAS = os.path.join(RAIZ, "docs", "data", "pautas.json")
ARQ_META = os.path.join(RAIZ, "docs", "data", "meta.json")
ARQ_FONTES = os.path.join(RAIZ, "coletor", "fontes.json")

API_KEY = os.environ.get("OPENAI_API_KEY", "").strip()
MODELO = os.environ.get("OPENAI_MODEL", "").strip() or "gpt-4o-mini"
MANUAL = os.environ.get("MANUAL", "false").lower() == "true"
UA = {"User-Agent": "Mozilla/5.0 (RadarDePautas; +https://github.com)"}

MAX_POR_SEG = 12
MAX_POT5 = 4
MAX_CANDIDATOS = 140  # por segmento, para a triagem

CATEGORIAS = {
    "trader": ["Trabalho", "Impostos", "Custo de vida", "Leis", "Juros e crédito", "Emprego e renda", "Previdência", "Negócios"],
    "vpr": ["Leis e economia", "Consumo", "Varejo", "Redes sociais", "Anúncios", "Inteligência artificial", "Concorrência", "Atendimento"],
}
PUBLICOS = {
    "trader": ["Empresários", "CLT", "Profissionais liberais", "Autônomos", "Aposentados", "Jovens"],
    "vpr": ["Empresários", "Comércio local", "Prestadores de serviço", "Profissionais liberais", "Indústria", "Restaurantes"],
}
CENAS = ["queda", "alta", "calendario", "congresso", "loja", "imposto", "celular", "funil"]
FORMATOS = ["Carrossel", "Reels", "Stories"]

SEGMENTOS = {
    "trader": (
        "Trader School Wendell Guimarães (mentoria de mercado financeiro / day trade na B3). Pautas: governo, leis, "
        "impostos, economia, emprego, custo de vida e negócios que apertam o bolso ou a margem de empresários, CLT, "
        "profissionais liberais, autônomos e aposentados. Ângulo: depender só de salário, escala, horário ou funcionário "
        "ficou arriscado; aprender o mercado financeiro é uma habilidade que gera renda sem essas amarras. Exemplo "
        "perfeito: fim da escala 6x1. NÃO servem notícias de cotação, bolsa, dólar ou ativos em si, nem resultados de empresas listadas."
    ),
    "vpr": (
        "Agência de marketing VPR Vision Prime. Pautas que mostram a empresa precisando de marketing: leis e economia que "
        "afetam vendas e equipes, comportamento do consumidor, varejo, e-commerce, novidades de Instagram, WhatsApp, Meta, "
        "Google, TikTok, anúncios e IA nos negócios. Ângulo: mostrar ao empresário a necessidade de site, gestão de redes, "
        "tráfego pago, planejamento, assessoria e automação com IA."
    ),
}

REGRAS = (
    "REGRAS DE OURO: nunca invente notícias, números, declarações, datas ou fontes. Use SOMENTE o que está no texto "
    "da fonte fornecido, com suas palavras (não copie trechos). Política: trate só o efeito no bolso e nos negócios, "
    "sem tomar partido; ignore notícias de campanha eleitoral, debates e pesquisas de voto. Escreva em português do Brasil."
)


def agora():
    return datetime.now(BRT).replace(microsecond=0)


def iso(dt):
    return dt.astimezone(BRT).replace(microsecond=0).isoformat()


def norm(t):
    t = unicodedata.normalize("NFKD", t or "").encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9 ]", " ", re.sub(r"\s+", " ", t)).strip()


def ler_json(caminho, padrao):
    try:
        with open(caminho, encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return padrao


def gravar_json(caminho, obj):
    with open(caminho, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=1)


# ---------------- coleta ----------------
def data_item(e):
    for k in ("published_parsed", "updated_parsed"):
        v = e.get(k)
        if v:
            return datetime.fromtimestamp(time.mktime(v), tz=timezone.utc)
    for k in ("published", "updated"):
        v = e.get(k)
        if v:
            try:
                return parsedate_to_datetime(v)
            except Exception:
                pass
    return None


def limpar_html(s, n=400):
    return re.sub(r"\s+", " ", BeautifulSoup(s or "", "html.parser").get_text(" ")).strip()[:n]


def ler_feed(url):
    for tentativa in range(2):
        try:
            r = requests.get(url, headers=UA, timeout=25)
            r.raise_for_status()
            break
        except (requests.ConnectionError, requests.Timeout):
            if tentativa:
                raise
            time.sleep(3)
    f = feedparser.parse(r.content)
    if f.bozo and not f.entries:
        raise RuntimeError("feed inválido")
    return f.entries


def conteudo_feed(e):
    """Texto completo que alguns feeds (WordPress) já trazem no próprio RSS."""
    blocos = [c.get("value", "") for c in (e.get("content") or [])]
    return limpar_html(max(blocos, key=len), 9000) if blocos else ""


def coletar(seg, cfg, inicio, falhas):
    itens = []
    for fonte in cfg["feeds"]:
        try:
            for e in ler_feed(fonte["url"]):
                dt = data_item(e)
                if not dt or dt < inicio:
                    continue
                itens.append({"titulo": limpar_html(e.get("title"), 200), "url": e.get("link", ""),
                              "fonte": fonte["nome"], "resumo": limpar_html(e.get("summary") or e.get("description")),
                              "conteudo": conteudo_feed(e), "publicado": dt, "direto": True})
        except Exception as ex:
            falhas.append(f"{fonte['nome']} ({type(ex).__name__})")
    for q in cfg["buscas"]:
        url = f"https://news.google.com/rss/search?q={quote_plus(q + ' when:1d')}&hl=pt-BR&gl=BR&ceid=BR:pt-419"
        try:
            for e in ler_feed(url)[:15]:
                dt = data_item(e)
                if not dt or dt < inicio:
                    continue
                titulo = limpar_html(e.get("title"), 220)
                veiculo = (e.get("source") or {}).get("title", "")
                if veiculo and titulo.endswith(" - " + veiculo):
                    titulo = titulo[: -len(veiculo) - 3]
                itens.append({"titulo": titulo, "url": "", "gnews": e.get("link", ""), "fonte": veiculo or "Google Notícias",
                              "resumo": "", "conteudo": "", "publicado": dt, "direto": False})
        except Exception as ex:
            falhas.append(f"Google Notícias '{q}' ({type(ex).__name__})")
    # sem duplicatas
    vistos, unicos = set(), []
    for it in sorted(itens, key=lambda i: (not i["direto"], -i["publicado"].timestamp())):
        k = norm(it["titulo"])[:80]
        if not k or k in vistos or (it["url"] and it["url"] in vistos):
            continue
        vistos.add(k)
        if it["url"]:
            vistos.add(it["url"])
        unicos.append(it)
    # garante espaço para as buscas do Google Notícias mesmo com muitos feeds
    diretos = [i for i in unicos if i["direto"]]
    buscas = [i for i in unicos if not i["direto"]]
    n_buscas = min(len(buscas), MAX_CANDIDATOS // 3)
    return diretos[:MAX_CANDIDATOS - n_buscas] + buscas[:n_buscas]


def link_real(gnews):
    """Troca o link do Google Notícias pelo link da matéria no site do veículo."""
    try:
        aid = urlparse(gnews).path.rstrip("/").split("/")[-1]
        h = requests.get(f"https://news.google.com/rss/articles/{aid}", headers=UA, timeout=20).text
        sg = re.search(r'data-n-a-sg="([^"]+)"', h).group(1)
        ts = re.search(r'data-n-a-ts="([^"]+)"', h).group(1)
        req = json.dumps(["garturlreq", [["X", "X", ["X", "X"], None, None, 1, 1, "US:en", None, 1, None, None, None,
                                          None, None, 0, 1], "X", "X", 1, [1, 1, 1], 1, 1, None, 0, 0, None, 0],
                          aid, int(ts), sg])
        r = requests.post("https://news.google.com/_/DotsSplashUi/data/batchexecute", headers=UA, timeout=20,
                          data={"f.req": json.dumps([[["Fbv4je", req, None, "generic"]]])})
        url = json.loads(json.loads(r.text.split("\n\n")[1])[0][2])[1]
        return url if url.startswith("http") else ""
    except Exception:
        return ""


def _paragrafos(no):
    ps = [p.get_text(" ", strip=True) for p in no.find_all("p")]
    return re.sub(r"\s+", " ", " ".join(p for p in ps if len(p) > 40))


def texto_materia(url):
    """Pega o texto da matéria: corpo do JSON-LD, a tag <article> ou os parágrafos da página (o mais completo)."""
    try:
        r = requests.get(url, headers=UA, timeout=25)
        r.raise_for_status()
        sopa = BeautifulSoup(r.text, "html.parser")
        opcoes = []
        for s in sopa.find_all("script", type="application/ld+json"):
            try:
                dados = json.loads(s.string or "")
            except Exception:
                continue
            fila = [dados]
            while fila:
                d = fila.pop()
                if isinstance(d, dict):
                    if isinstance(d.get("articleBody"), str):
                        opcoes.append(limpar_html(d["articleBody"], 9000))
                    fila += [v for v in d.values() if isinstance(v, (dict, list))]
                elif isinstance(d, list):
                    fila += d
        for t in sopa(["script", "style", "nav", "footer", "header", "aside", "form"]):
            t.decompose()
        art = sopa.find("article")
        if art:
            opcoes.append(_paragrafos(art))
        opcoes.append(_paragrafos(sopa))
        if max(map(len, opcoes)) < 800:
            # sites que não usam <p>: bloco de conteúdo com mais texto
            blocos = sopa.find_all(["div", "section"], class_=re.compile(r"texto|conteudo|content|materia|article|post|entry|body", re.I))
            opcoes += [re.sub(r"\s+", " ", b.get_text(" ", strip=True)) for b in blocos]
        return max(opcoes, key=len)[:9000]
    except Exception:
        return ""


# ---------------- IA ----------------
def ia(sistema, usuario):
    for tentativa in range(3):
        r = requests.post(
            "https://api.openai.com/v1/chat/completions",
            headers={"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"},
            json={"model": MODELO, "response_format": {"type": "json_object"},
                  "messages": [{"role": "system", "content": sistema}, {"role": "user", "content": usuario}]},
            timeout=120,
        )
        if r.status_code == 429 or r.status_code >= 500:
            time.sleep(10 * (tentativa + 1))
            continue
        if r.status_code != 200:
            raise RuntimeError(f"OpenAI {r.status_code}: {r.text[:300]}")
        return json.loads(r.json()["choices"][0]["message"]["content"])
    raise RuntimeError("OpenAI sem resposta depois de 3 tentativas")


def triagem(seg, candidatos, recentes):
    lista = "\n".join(f"[{i}] {c['fonte']} | {c['titulo']} | {c['resumo'][:220]}" for i, c in enumerate(candidatos))
    ja = "\n".join(f"{d['id']} | {d['titulo']}" for d in recentes) or "(nenhuma)"
    sistema = (f"Você é editor do 'Radar de Pautas'. Segmento: {SEGMENTOS[seg]}\n{REGRAS}\n"
               "Dê potencial de captação de 1 a 5: 5 = mexe direto no bolso de muita gente e rende antes/depois, números e "
               "'quem sente primeiro' (como a 6x1); 1 = curiosidade fraca. Responda em JSON.")
    usuario = (f"Notícias candidatas:\n{lista}\n\nPautas já gravadas nos últimos dias (não repita a mesma história):\n{ja}\n\n"
               'Devolva {"escolhidas":[{"i":<número>,"potencial":<3-5>,"atualiza":"<id da pauta existente se for a MESMA '
               'história com FATO NOVO, senão null>"}]}. Só potencial 3 ou mais. Se for a mesma história sem fato novo, não '
               f"inclua. No máximo {MAX_POR_SEG} itens e no máximo {MAX_POT5} com potencial 5. Lista vazia se nada servir.")
    r = ia(sistema, usuario)
    saida = []
    for e in r.get("escolhidas", []):
        try:
            i, p = int(e["i"]), int(e["potencial"])
        except Exception:
            continue
        if 0 <= i < len(candidatos) and 3 <= p <= 5:
            saida.append({"c": candidatos[i], "potencial": p, "atualiza": e.get("atualiza") or None})
    saida.sort(key=lambda x: -x["potencial"])
    p5 = 0
    final = []
    for s in saida:
        if s["potencial"] == 5:
            p5 += 1
            if p5 > MAX_POT5:
                s["potencial"] = 4
        final.append(s)
    return final[:MAX_POR_SEG]


MODELO_DOC = {
    "titulo": "até 14 palavras", "resumo": "1 a 2 frases, até 35 palavras",
    "fatos": ["5 a 8 frases curtas com os fatos concretos da fonte: números, valores, datas, quem decidiu, quem é afetado, prazos"],
    "explicacao": ["3 a 5 frases explicando o contexto: por que aconteceu, como funciona na prática e o que muda para a pessoa, só com o que está na fonte"],
    "numeros": [{"valor": "só números da fonte, ex: 75 a 1", "rotulo": "ex: votos no Senado"}],
    "categoria": "uma da lista", "publico": ["da lista"], "dor": "até 14 palavras: o que essa pessoa perde ou teme",
    "angulo": "até 40 palavras: como a notícia vira conteúdo que leva a pessoa a querer conhecer o serviço, sem prometer ganhos",
    "gancho": "título de capa até 9 palavras com 1 trecho entre *asteriscos*", "ideias": ["3 títulos curtos de posts"],
    "formatos": ["entre Carrossel, Reels, Stories"], "cena": "uma de: " + ", ".join(CENAS),
    "fonte": "nome do veículo", "data_publicacao": "AAAA-MM-DD se o texto informar, senão null",
    "suficiente": "true se o texto da fonte tem fatos suficientes; false se não dá para escrever sem inventar",
}


def escrever(seg, esc, texto):
    c = esc["c"]
    sistema = (f"Você escreve pautas para Instagram. Segmento: {SEGMENTOS[seg]}\n{REGRAS}\n"
               f"Categorias permitidas: {', '.join(CATEGORIAS[seg])}. Públicos permitidos: {', '.join(PUBLICOS[seg])}. "
               "Responda em JSON exatamente com estas chaves: " + json.dumps(MODELO_DOC, ensure_ascii=False))
    usuario = (f"Veículo: {c['fonte']}\nTítulo: {c['titulo']}\nResumo do feed: {c['resumo']}\n"
               f"Texto da matéria: {texto or '(indisponível: use só o título e o resumo, com no máximo 3 fatos e sem números que não estejam neles)'}")
    return ia(sistema, usuario)


def atualizar(seg, doc, c, texto):
    sistema = (f"Você atualiza uma pauta existente com um fato novo. {REGRAS} Responda em JSON com as chaves "
               '"resumo" (até 35 palavras), "fatos" (3 a 6 frases, mantendo os antigos que seguem válidos e incluindo o novo), '
               '"novo" (true se há de fato um fato novo, senão false).')
    usuario = (f"Pauta atual: {json.dumps({k: doc.get(k) for k in ('titulo', 'resumo', 'fatos')}, ensure_ascii=False)}\n\n"
               f"Nova matéria ({c['fonte']}): {c['titulo']}\n{texto or c['resumo']}")
    return ia(sistema, usuario)


def corta(s, n):
    p = str(s or "").split()
    return " ".join(p[:n])


def validar(seg, d, c, pot, coleta):
    if not d or d.get("suficiente") is False:
        return None
    fatos = [str(f) for f in (d.get("fatos") or []) if str(f).strip()][:8]
    if len(fatos) < 2:
        return None
    cat = d.get("categoria") if d.get("categoria") in CATEGORIAS[seg] else CATEGORIAS[seg][-1 if seg == "trader" else 0]
    pub = [p for p in (d.get("publico") or []) if p in PUBLICOS[seg]] or ["Empresários"]
    fmt = [f for f in (d.get("formatos") or []) if f in FORMATOS] or ["Carrossel"]
    cena = d.get("cena") if d.get("cena") in CENAS else "funil"
    fonte = c["fonte"] if c["direto"] else (c["fonte"] or d.get("fonte") or "")
    doc = {
        "segmento": seg, "titulo": corta(d.get("titulo") or c["titulo"], 14), "resumo": corta(d.get("resumo"), 35),
        "fatos": fatos,
        "explicacao": [str(f) for f in (d.get("explicacao") or []) if str(f).strip()][:5],
        "materia": re.sub(r"\s+", " ", c.get("texto") or "").strip()[:4000],
        "numeros": [{"valor": str(n.get("valor", "")), "rotulo": str(n.get("rotulo", ""))}
                    for n in (d.get("numeros") or []) if isinstance(n, dict) and n.get("valor")][:6],
        "fonte": fonte, "categoria": cat, "publico": pub, "dor": corta(d.get("dor"), 14),
        "angulo": corta(d.get("angulo"), 40), "gancho": corta(d.get("gancho"), 9),
        "ideias": [str(i) for i in (d.get("ideias") or [])][:3], "formatos": fmt, "cena": cena,
        "potencial": pot, "status": "nova", "coletadoEm": iso(coleta),
    }
    if c["url"]:
        doc["url"] = c["url"]
    else:
        doc["url"] = "https://www.google.com/search?q=" + quote_plus(f"{c['titulo']} {fonte}")
        doc["urlBusca"] = True
    pub_dt = c["publicado"].astimezone(BRT)
    doc["publicadoEm"] = iso(pub_dt)
    doc["data"] = pub_dt.strftime("%Y-%m-%d")
    return doc


# ---------------- principal ----------------
def main():
    coleta = agora()
    hoje = coleta.strftime("%Y-%m-%d")
    pautas = ler_json(ARQ_PAUTAS, [])
    meta = ler_json(ARQ_META, {})
    fontes = ler_json(ARQ_FONTES, {})
    erro_geral = None if API_KEY else "Falta o segredo OPENAI_API_KEY no repositório."

    for seg in ("trader", "vpr"):
        m = meta.get(seg, {})
        falhas, novas, atualizadas, status, msg = [], 0, 0, "ok", ""
        try:
            if erro_geral:
                raise RuntimeError(erro_geral)
            ultima = m.get("ultimaColeta")
            inicio = coleta - timedelta(hours=24)
            if ultima:
                try:
                    inicio = min(inicio, datetime.fromisoformat(ultima))
                except Exception:
                    pass
            inicio = max(inicio, coleta - timedelta(days=4))
            do_seg = [p for p in pautas if p.get("segmento") == seg]
            urls = {p.get("url") for p in do_seg}
            titulos = {norm(p.get("titulo", ""))[:60] for p in do_seg}
            cand = [c for c in coletar(seg, fontes[seg], inicio, falhas)
                    if c["url"] not in urls and norm(c["titulo"])[:60] not in titulos]
            recentes = sorted(do_seg, key=lambda p: p["id"], reverse=True)[:40]
            print(f"[{seg}] {len(cand)} candidatas desde {iso(inicio)}")
            escolhidas = triagem(seg, cand, recentes) if cand else []
            ids = {p["id"]: p for p in do_seg}
            n = max([int(p["id"].rsplit("-", 1)[1]) for p in do_seg if p["id"].startswith(f"{hoje}-{seg}-")] or [0])
            destaques = []
            for esc in escolhidas:
                c = esc["c"]
                if not c["direto"] and c.get("gnews"):
                    real = link_real(c["gnews"])
                    if real and real in urls:
                        continue  # a mesma matéria já virou pauta
                    c["url"] = real
                texto = texto_materia(c["url"]) if c["url"] else ""
                if len(c.get("conteudo") or "") > len(texto):
                    texto = c["conteudo"]
                c["texto"] = texto
                try:
                    alvo = ids.get(esc["atualiza"]) if esc["atualiza"] else None
                    if alvo:
                        u = atualizar(seg, alvo, c, texto)
                        if u.get("novo") and u.get("fatos"):
                            alvo["fatos"] = [str(f) for f in u["fatos"]][:6]
                            alvo["resumo"] = corta(u.get("resumo") or alvo.get("resumo"), 35)
                            alvo["atualizadoEm"] = iso(coleta)
                            alvo["status"] = "atualizada"
                            atualizadas += 1
                        continue
                    doc = validar(seg, escrever(seg, esc, texto), c, esc["potencial"], coleta)
                    if not doc:
                        continue
                    n += 1
                    doc["id"] = f"{hoje}-{seg}-{n:02d}"
                    pautas.append(doc)
                    ids[doc["id"]] = doc
                    novas += 1
                    destaques.append(doc["titulo"])
                except Exception as ex:
                    print(f"[{seg}] falhou ao escrever '{c['titulo']}': {ex}")
            if novas or atualizadas:
                msg = f"{novas} pauta(s) nova(s)" + (f" e {atualizadas} atualizada(s)" if atualizadas else "")
                if destaques:
                    msg += ": " + "; ".join(destaques[:3]) + "."
            else:
                status = "sem_novas"
                ant = m.get("ultimaColeta")
                quando = datetime.fromisoformat(ant).strftime("%d/%m às %H:%M") if ant else "a última coleta"
                msg = f"Nenhuma pauta nova relevante desde {quando}."
        except Exception as ex:
            status, msg = "erro", str(ex)[:300]
            print(f"[{seg}] ERRO: {ex}")
        hist = [iso(coleta)] + [h for h in m.get("historico", []) if h != iso(coleta)]
        meta[seg] = {"ultimaColeta": iso(coleta), "novas": novas, "atualizadas": atualizadas, "status": status,
                     "mensagem": msg, "falhas": falhas[:15], "manual": MANUAL, "historico": hist[:12]}
        print(f"[{seg}] {status}: {msg}")

    limite = (coleta - timedelta(days=10)).strftime("%Y-%m-%d")
    pautas = [p for p in pautas if str(p.get("data", hoje)) >= limite]
    pautas.sort(key=lambda p: p["id"], reverse=True)
    gravar_json(ARQ_PAUTAS, pautas)
    gravar_json(ARQ_META, meta)
    if erro_geral:
        sys.exit(1)


if __name__ == "__main__":
    main()
