"""Associa as questões do ENEM (data/resolucoes) aos itens dos microdados do INEP (ITENS_PROVA_<ano>.csv).

Para cada ano e área, escolhe o caderno (CO_PROVA) cujo gabarito mais concorda com o nosso e grava
habilidade da Matriz (H1–H30) e parâmetros TRI (a, b, c) em data/inep/enem-<ano>.json.

uso: python3 scripts/inep-itens.py <pasta-com-ITENS_PROVA_csv>
"""
import csv, json, sys, os, collections

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AREA_BY_NUM = lambda n: "LC" if n <= 45 else "CH" if n <= 90 else "CN" if n <= 135 else "MT"
LANG = {"0": "ingles", "1": "espanhol"}


def num(x):
    try:
        return float(x.replace(",", "."))
    except ValueError:
        return None


def main(folder):
    for year in range(2019, 2025):
        res = json.load(open(f"{ROOT}/data/resolucoes/enem-{year}.json"))["items"]
        ours = {}
        for it in res:
            if it.get("annulled") or not it.get("correct"):
                continue
            ours[(it["number"], it.get("language") or "")] = it["correct"]
        provas = collections.defaultdict(dict)
        with open(f"{folder}/ITENS_PROVA_{year}.csv", encoding="latin1") as fh:
            for r in csv.DictReader(fh, delimiter=";"):
                pos = int(r["CO_POSICAO"])
                lang = LANG.get(r["TP_LINGUA"], "") if pos <= 5 else ""
                provas[(r["SG_AREA"], r["CO_PROVA"])][(pos, lang)] = r
        out, report = [], []
        for area in ("LC", "CH", "CN", "MT"):
            keys = [k for k in ours if AREA_BY_NUM(k[0]) == area]
            def score(p):
                its = provas[p]
                first = next(iter(its.values()))
                hits = sum(1 for k in keys if k in its and its[k]["TX_GABARITO"] == ours[k])
                with_irt = sum(1 for r in its.values() if r["NU_PARAM_B"])
                # empate: prefere caderno não adaptado, com parâmetros TRI, e o azul
                return (hits, first["IN_ITEM_ADAPTADO"] != "1", with_irt, first["TX_COR"].upper() == "AZUL")
            best = max((p for p in provas if p[0] == area), key=score)
            items = provas[best]
            hits = sum(1 for k in keys if k in items and items[k]["TX_GABARITO"] == ours[k])
            report.append(f"{area}: prova {best[1]} ({next(iter(items.values()))['TX_COR']}) {hits}/{len(keys)}")
            for (pos, lang), r in sorted(items.items()):
                a, b, c = num(r["NU_PARAM_A"]), num(r["NU_PARAM_B"]), num(r["NU_PARAM_C"])
                row = {"number": pos, "area": area, "skill": int(r["CO_HABILIDADE"]) if r["CO_HABILIDADE"] else None,
                       "item": int(r["CO_ITEM"]), "gabarito": r["TX_GABARITO"],
                       "irt": {"a": a, "b": b, "c": c} if None not in (a, b, c) else None,
                       "abandoned": r["IN_ITEM_ABAN"] == "1"}
                if lang:
                    row["language"] = lang
                if (pos, lang) in ours and ours[(pos, lang)] != r["TX_GABARITO"]:
                    row["gabarito_diverge"] = ours[(pos, lang)]
                out.append(row)
        json.dump({"board": "ENEM", "year": year, "source": f"INEP, microdados ENEM {year} (ITENS_PROVA)", "items": out},
                  open(f"{ROOT}/data/inep/enem-{year}.json", "w"), ensure_ascii=False, indent=1)
        print(year, " | ".join(report))


if __name__ == "__main__":
    main(sys.argv[1])
