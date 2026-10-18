#!/usr/bin/env python3
"""Translate the catalog with Google's public gtx endpoint, resumable via a cache.

Usage: python tools/i18n/translate.py [--limit N] [--workers 6]
Writes research/i18n/cache.json  {source_vi: english}
"""
import json, os, sys, time, urllib.parse, urllib.request, urllib.error
from concurrent.futures import ThreadPoolExecutor, as_completed

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CAT = os.path.join(ROOT, "research", "i18n", "catalog.json")
CACHE = os.path.join(ROOT, "research", "i18n", "cache.json")
SEP = "\n@@@\n"  # survives translation and keeps batch alignment (verified vs ⟪§⟫ which drops)
MAX_CHARS = 1200
MAX_ITEMS = 12
WORKERS = int(next((a.split("=")[1] for a in sys.argv if a.startswith("--workers=")), 6))
LIMIT = int(next((a.split("=")[1] for a in sys.argv if a.startswith("--limit=")), 0))

def load(path, default):
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        return default

def gt(texts):
    q = SEP.join(texts)
    url = ("https://translate.googleapis.com/translate_a/single?client=gtx&sl=vi&tl=en&dt=t&q="
           + urllib.parse.quote(q))
    for attempt in range(5):
        try:
            with urllib.request.urlopen(url, timeout=45) as r:
                data = json.load(r)
            out = "".join(seg[0] for seg in data[0] if seg and seg[0])
            return out
        except Exception as e:
            if attempt == 4:
                raise
            time.sleep(1.5 * (attempt + 1))
    return ""

def translate_batch(items):
    """Returns dict source->english for one batch; falls back to per-item on misalignment."""
    try:
        out = gt(items)
        parts = [p.strip() for p in out.split("@@@")]
        if len(parts) == len(items):
            return {s: p for s, p in zip(items, parts)}
    except Exception:
        pass
    # fallback: one request per string
    res = {}
    for s in items:
        for attempt in range(3):
            try:
                res[s] = gt([s]).strip()
                break
            except Exception:
                time.sleep(1 + attempt)
    return res

def main():
    catalog = load(CAT, None)
    if not catalog:
        sys.exit("run tools/i18n/catalog.mjs first")
    cache = load(CACHE, {})
    todo = [u["text"] for u in catalog["unique"] if u["text"] not in cache]
    if LIMIT:
        todo = todo[:LIMIT]
    print(f"unique={len(catalog['unique'])} cached={len(cache)} todo={len(todo)}", flush=True)

    batches, cur, size = [], [], 0
    for t in todo:
        if cur and (size + len(t) > MAX_CHARS or len(cur) >= MAX_ITEMS):
            batches.append(cur); cur, size = [], 0
        cur.append(t); size += len(t) + 6
    if cur:
        batches.append(cur)
    print(f"batches={len(batches)}", flush=True)

    done = 0
    t0 = time.time()
    with ThreadPoolExecutor(max_workers=WORKERS) as ex:
        futs = {ex.submit(translate_batch, b): b for b in batches}
        for fut in as_completed(futs):
            try:
                res = fut.result()
            except Exception as e:
                print("batch failed:", e, flush=True)
                res = {}
            cache.update(res)
            done += len(futs[fut])
            if done % 200 < 20 or done >= len(todo):
                with open(CACHE, "w", encoding="utf-8") as f:
                    json.dump(cache, f, ensure_ascii=False, indent=0)
                print(f"  {done}/{len(todo)}  {time.time()-t0:.0f}s", flush=True)

    with open(CACHE, "w", encoding="utf-8") as f:
        json.dump(cache, f, ensure_ascii=False, indent=0)
    missing = [t for t in (u["text"] for u in catalog["unique"]) if t not in cache]
    print(f"done. cache={len(cache)} missing={len(missing)}")
    for m in missing[:5]:
        print("MISSING:", m[:100])

if __name__ == "__main__":
    main()
