# static_crawler.py
import requests, time, json, os
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse

HEADERS = {"User-Agent":"Mozilla/5.0 (X11; Linux x86_64) AASTStaticBot/1.0"}
OUT = "static_pages"
os.makedirs(OUT, exist_ok=True)

START = ["https://aast.edu/en/", "https://aast.edu/en/colleges/"]

def is_internal(u):
    p = urlparse(u)
    return p.netloc.endswith("aast.edu")

def extract_links(html, base):
    soup = BeautifulSoup(html, "lxml")
    links = set()
    for a in soup.find_all("a", href=True):
        href = a["href"].strip()
        if href.startswith("javascript:") or href=="#": continue
        full = urljoin(base, href)
        if is_internal(full):
            links.add(full.split("#")[0])
    return links

def save_page(url, text):
    fname = os.path.join(OUT, url.replace("https://","").replace("/","__")[:240] + ".html")
    with open(fname, "w", encoding="utf8") as f:
        f.write(text)
    return fname

def main():
    q = list(START)
    seen = set(q)
    index = []
    while q and len(seen) < 1200:   # limit to avoid huge crawl; increase as needed
        u = q.pop(0)
        try:
            r = requests.get(u, headers=HEADERS, timeout=15)
            rec = {"url": u, "status": r.status_code}
            if r.status_code == 200 and "text/html" in r.headers.get("Content-Type",""):
                rec["file"] = save_page(u, r.text)
                links = extract_links(r.text, u)
                rec["links_count"] = len(links)
                for l in links:
                    if l not in seen:
                        seen.add(l); q.append(l)
            index.append(rec)
            time.sleep(0.8)
        except Exception as e:
            index.append({"url":u,"error":str(e)})
    with open("static_index.json", "w", encoding="utf8") as f:
        json.dump(index, f, indent=2, ensure_ascii=False)
    print("Crawl finished. pages:", len(index))

if __name__ == "__main__":
    main()
