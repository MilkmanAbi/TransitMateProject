# Builds the rail graph used by the journey planner from an OpenStreetMap Overpass extract
# (scripts/osm-stations-raw.json, © OpenStreetMap contributors, ODbL).
# DECISION: operating status is not in OSM or PCD (PCD lists never-opened CC18/TE22A), so
# known-unopened stations are excluded by hand below.
import json, re, math, collections
raw = json.load(open("scripts/osm-stations-raw.json", encoding="utf-8"))
EXCLUDE = {"CC18", "TE10", "TE21", "TE22A", "NS3A"}
EXCLUDE_PREFIX = ("JE", "JS", "JW", "CR", "CP")
PREFIX_LINE = {"NS": "NSL", "EW": "EWL", "CG": "EWL", "NE": "NEL", "CC": "CCL", "CE": "CCL", "DT": "DTL",
               "TE": "TEL", "BP": "BPL", "SE": "SKLRT", "SW": "SKLRT", "ST": "SKLRT", "PE": "PGLRT", "PW": "PGLRT", "PT": "PGLRT"}
st = {}
for e in raw["elements"]:
    t = e.get("tags", {}); ref = t.get("ref")
    if not ref: continue
    lat = e.get("lat") or e.get("center", {}).get("lat"); lon = e.get("lon") or e.get("center", {}).get("lon")
    name = (t.get("name:en") or t.get("name") or "").strip()
    for c in re.split(r"[;, ]+", ref):
        if not re.match(r"^[A-Z]{2}\d+[A-Z]?$", c) or c in EXCLUDE or c.startswith(EXCLUDE_PREFIX) or c in st: continue
        if c[:2] not in PREFIX_LINE: continue
        st[c] = {"code": c, "name": name, "lat": round(lat, 6), "lng": round(lon, 6), "line": PREFIX_LINE[c[:2]]}
# LRT hubs share the MRT station
st["STC"] = {**st["NE16"], "code": "STC", "line": "SKLRT"}
st["PTC"] = {**st["NE17"], "code": "PTC", "line": "PGLRT"}
num = lambda c: int(re.sub(r"\D", "", c) or 0)
def seq(prefix): return sorted([c for c in st if c.startswith(prefix) and c not in ("STC", "PTC")], key=num)
edges = set()
def chain(codes):
    for a, b in zip(codes, codes[1:]): edges.add(tuple(sorted((a, b))))
for p in ["NS", "EW", "NE", "CC", "DT", "TE"]: chain(seq(p))
chain(["EW4"] + seq("CG"))
chain(["CC4", "CC34"])
chain(seq("BP")); chain(["BP13", "BP6"])
for hub, loops in (("STC", ["SE", "SW"]), ("PTC", ["PE", "PW"])):
    for lp in loops: chain([hub] + seq(lp) + [hub])
def hav(a, b):
    R = 6371; p1, p2 = math.radians(a["lat"]), math.radians(b["lat"]); dp = p2 - p1; dl = math.radians(b["lng"] - a["lng"])
    h = math.sin(dp/2)**2 + math.cos(p1)*math.cos(p2)*math.sin(dl/2)**2
    return 2*R*math.asin(math.sqrt(h))
LRT = {"BPL", "SKLRT", "PGLRT"}
E = []
for a, b in sorted(edges):
    d = hav(st[a], st[b]); lrt = st[a]["line"] in LRT
    mins = d * 1.15 / (25 if lrt else 45) * 60 + (0.4 if lrt else 0.5)
    E.append({"a": a, "b": b, "line": st[a]["line"] if st[a]["line"] == st[b]["line"] else st[b]["line"], "km": round(d, 3), "min": round(max(mins, 1.2), 2)})
norm = lambda s: re.sub(r"[^a-z0-9]", "", s.lower())
groups = collections.defaultdict(list)
for c, s in st.items(): groups[norm(s["name"])].append(c)
transfers = [sorted(g) for g in groups.values() if len({st[c]["line"] for c in g}) > 1 or len(g) > 1]
json.dump({"source": "OpenStreetMap contributors (ODbL), Overpass extract 2026-09-19", "stations": sorted(st.values(), key=lambda s: (s["line"], num(s["code"]))), "edges": E, "interchanges": transfers},
          open("server/src/data/mrt.json", "w", encoding="utf-8"), ensure_ascii=False, indent=0)
print(len(st), "stations", len(E), "edges", len(transfers), "interchange groups")
print([g for g in transfers][:40])
