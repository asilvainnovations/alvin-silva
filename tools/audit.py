#!/usr/bin/env python3
"""Structural + navigation audit for cognitioplus/alvin-silva."""
import os, re, sys, json
from collections import Counter, defaultdict
from html.parser import HTMLParser

ROOT = sys.argv[1] if len(sys.argv) > 1 else "."
VOID = {"area","base","br","col","embed","hr","img","input","link","meta",
        "param","source","track","wbr","path","circle","rect","line","polygon",
        "polyline","ellipse","use","stop","feGaussianBlur","feOffset","feMerge",
        "feMergeNode","animate","animateTransform"}

class Auditor(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.stack=[]; self.unclosed=[]; self.stray=[]
        self.ids=Counter(); self.id_lines=defaultdict(list)
        self.links=[]; self.imgs=[]; self.scripts=[]; self.uses=[]
        self.symbols=set(); self.imgs_no_alt=[]; self.a_no_text=0
        self._in_a=False; self._a_txt=""; self._a_line=0; self._a_attrs={}
    def handle_starttag(self,tag,attrs):
        a=dict(attrs); ln=self.getpos()[0]
        if "id" in a: self.ids[a["id"]]+=1; self.id_lines[a["id"]].append(ln)
        if tag=="a" and "href" in a:
            self.links.append((a["href"],ln)); self._in_a=True; self._a_txt=""; self._a_line=ln; self._a_attrs=a
        if tag=="img":
            self.imgs.append((a.get("src",""),ln))
            if not a.get("alt","").strip() and a.get("alt") is None: self.imgs_no_alt.append((a.get("src",""),ln))
        if tag=="script" and "src" in a: self.scripts.append((a["src"],ln))
        if tag=="link" and a.get("rel") in ("stylesheet","icon","apple-touch-icon","manifest"): self.scripts.append((a.get("href",""),ln))
        if tag=="use":
            h=a.get("href") or a.get("xlink:href") or ""
            if h.startswith("#"): self.uses.append((h[1:],ln))
        if tag=="symbol" and "id" in a: self.symbols.add(a["id"])
        if tag not in VOID: self.stack.append((tag,ln))
    def handle_endtag(self,tag):
        if tag in VOID: return
        if tag=="a" and self._in_a:
            self._in_a=False
            has_label=self._a_attrs.get("aria-label") or self._a_attrs.get("title")
            if not self._a_txt.strip() and not has_label: self.a_no_text+=1
        for i in range(len(self.stack)-1,-1,-1):
            if self.stack[i][0]==tag:
                for t,l in self.stack[i+1:]: self.unclosed.append((t,l))
                self.stack=self.stack[:i]; return
        self.stray.append((tag,self.getpos()[0]))
    def handle_data(self,d):
        if self._in_a: self._a_txt+=d

def css_brace_balance(txt):
    txt=re.sub(r"/\*.*?\*/","",txt,flags=re.S)
    return txt.count("{")-txt.count("}")

def audit(path):
    txt=open(path,encoding="utf-8",errors="replace").read()
    p=Auditor()
    try: p.feed(txt)
    except Exception as e: return {"file":path,"parse_error":str(e)}
    # inline css
    css_delta=0
    for m in re.findall(r"<style[^>]*>(.*?)</style>",txt,flags=re.S):
        css_delta+=css_brace_balance(m)
    dupes={k:p.id_lines[k] for k,v in p.ids.items() if v>1}
    missing_sym=sorted({s for s,_ in p.uses if s not in p.symbols})
    return {"file":path,"bytes":len(txt),
            "unclosed":p.unclosed,"stray":p.stray,
            "dupe_ids":dupes,"css_brace_delta":css_delta,
            "links":p.links,"imgs":p.imgs,"assets":p.scripts,
            "missing_symbols":missing_sym,"use_refs":len(p.uses),
            "symbols_defined":len(p.symbols),
            "a_no_accessible_name":p.a_no_text}

html_files=[]
for dp,dn,fn in os.walk(ROOT):
    if ".git" in dp: continue
    for f in fn:
        if f.endswith(".html"): html_files.append(os.path.join(dp,f))
html_files.sort()

all_files={os.path.relpath(os.path.join(dp,f),ROOT).replace("\\","/")
           for dp,dn,fn in os.walk(ROOT) if ".git" not in dp for f in fn}
lower_map={f.lower():f for f in all_files}

results=[audit(f) for f in html_files]

print("="*78)
print("STRUCTURAL AUDIT")
print("="*78)
print(f"{'file':<46}{'unclosed':>9}{'stray':>7}{'dupID':>7}{'css∆':>6}")
print("-"*78)
for r in results:
    rel=os.path.relpath(r["file"],ROOT)
    if "parse_error" in r: print(f"{rel:<46}  PARSE ERROR: {r['parse_error']}"); continue
    print(f"{rel:<46}{len(r['unclosed']):>9}{len(r['stray']):>7}{len(r['dupe_ids']):>7}{r['css_brace_delta']:>6}")

print()
print("="*78)
print("DETAIL: structural defects")
print("="*78)
clean=True
for r in results:
    rel=os.path.relpath(r["file"],ROOT)
    issues=[]
    if r.get("unclosed"): issues.append(f"  unclosed tags: {r['unclosed'][:12]}")
    if r.get("stray"): issues.append(f"  stray close tags: {r['stray'][:12]}")
    if r.get("dupe_ids"):
        for k,v in list(r["dupe_ids"].items())[:15]: issues.append(f"  duplicate id '{k}' at lines {v}")
    if r.get("css_brace_delta"): issues.append(f"  inline CSS brace imbalance: {r['css_brace_delta']:+d}")
    if r.get("missing_symbols"): issues.append(f"  <use> -> undefined symbol: {r['missing_symbols']}")
    if issues:
        clean=False
        print(f"\n### {rel}")
        for i in issues: print(i)
if clean: print("  (none)")

print()
print("="*78)
print("BROKEN INTERNAL LINKS / ASSETS")
print("="*78)
bad=defaultdict(list)
for r in results:
    if "parse_error" in r: continue
    rel=os.path.relpath(r["file"],ROOT)
    base=os.path.dirname(rel)
    for kind,items in (("link",r["links"]),("img",r["imgs"]),("asset",r["assets"])):
        for href,ln in items:
            if not href: continue
            h=href.split("#")[0].split("?")[0]
            if not h: continue
            if re.match(r"^(https?:|mailto:|tel:|data:|javascript:|//)",h): continue
            tgt=os.path.normpath(os.path.join(base,h.lstrip("/"))).replace("\\","/")
            if tgt in all_files: continue
            if tgt+".html" in all_files: continue
            if (tgt+"/index.html") in all_files: continue
            hint=""
            if tgt.lower() in lower_map: hint=f"  [CASE MISMATCH -> {lower_map[tgt.lower()]}]"
            bad[rel].append(f"  L{ln:<6} {kind:<6} {href}{hint}")
if bad:
    for f,v in sorted(bad.items()):
        print(f"\n### {f}")
        for x in v[:40]: print(x)
        if len(v)>40: print(f"  ... +{len(v)-40} more")
else: print("  (none)")

print()
print("="*78)
print("SVG SPRITE / ICON REFERENCES")
print("="*78)
for r in results:
    if "parse_error" in r: continue
    if r["use_refs"]:
        rel=os.path.relpath(r["file"],ROOT)
        print(f"{rel:<46} refs={r['use_refs']:<4} symbols={r['symbols_defined']:<4} missing={r['missing_symbols'] or '-'}")
