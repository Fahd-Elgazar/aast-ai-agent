# discover_seeds_improved.py
# Run: python discover_seeds_improved.py
import requests, json, time, re, logging
from urllib.parse import urljoin, urlparse, urlunparse, parse_qsl, urlencode
from bs4 import BeautifulSoup
from urllib import robotparser
from requests.adapters import HTTPAdapter, Retry
from pathlib import Path
import tldextract

import json

SEEDS_FILE = r"C:\Users\mh978\Downloads\aast_scrape_final\adv_scraping\discovery_seed_links.json"

with open(SEEDS_FILE, "r", encoding="utf8") as f:
    data = json.load(f)

SEEDS = []

# extract links from nested pages list
for page in data.get("pages", []):
    if "links" in page:
        SEEDS.extend(page["links"])

SEEDS = list(set(SEEDS))  # dedupe

print("Number of raw seeds extracted:", len(SEEDS))

with open("all_seeds_extracted.json", "w", encoding="utf8") as f:
    json.dump(SEEDS, f, indent=2, ensure_ascii=False)

ROOT_DOMAIN = "aast.edu"
OUT_FILE = "adv_discovery_seed_links.json"

RAW_INDEX = "raw_index.csv"
HEADERS = {"User-Agent":"Mozilla/5.0 (X11; Linux x86_64) AASTScraper/1.0 (+your_email_or_contact)"}
RATE_SEC = 0.6            # polite rate
TIMEOUT = 15
MAX_REDIRECTS = 5
MAX_PAGES = None          # None or int -> limit pages processed
EXTRACT_INLINE_URLS = True

# Setup logging
logging.basicConfig(format="%(asctime)s %(levelname)s %(message)s", level=logging.INFO)

# Session with retries
session = requests.Session()
retries = Retry(total=3, backoff_factor=0.8, status_forcelist=[429,500,502,503,504])
adapter = HTTPAdapter(max_retries=retries)
session.mount("https://", adapter)
session.mount("http://", adapter)
session.headers.update(HEADERS)

# robots parser for domain
rp = robotparser.RobotFileParser()
rp.set_url(urljoin(f"https://{ROOT_DOMAIN}", "/robots.txt"))
try:
    rp.read()
    logging.info("Loaded robots.txt")
except Exception as e:
    logging.warning("Could not read robots.txt: %s", e)

def allowed(url):
    try:
        return rp.can_fetch(HEADERS["User-Agent"], url)
    except Exception:
        return True

def normalize_url(u):
    """Normalize: force https if possible, remove fragments, drop tracking query params, sort queries."""
    if not u:
        return u
    parsed = urlparse(u)
    # skip non-http(s)
    if parsed.scheme not in ("http","https",""):
        return u
    scheme = parsed.scheme or "https"
    # normalize host lowercase
    netloc = parsed.netloc.lower()
    # drop fragments
    fragment = ""
    # normalize query: remove common trackers
    q = dict(parse_qsl(parsed.query, keep_blank_values=True))
    for k in list(q.keys()):
        if k.lower().startswith("utm_") or k.lower() in ("fbclid","gclid","ref","referrer"):
            q.pop(k, None)
    # sort params for canonicalization
    query = urlencode(sorted(q.items()))
    new = urlunparse((scheme, netloc, parsed.path or "/", parsed.params, query, fragment))
    # remove trailing slash duplicates: keep slash for root only
    if new.endswith("/") and new.count("/")>2 and not new.endswith("/index.php"):
        new = new.rstrip("/")
    return new

def is_internal(u):
    try:
        host = urlparse(u).netloc
        return host.endswith(ROOT_DOMAIN)
    except:
        return False

def extract_links(html, base_url):
    soup = BeautifulSoup(html, "lxml")
    links = set()
    # standard <a href>
    for a in soup.find_all("a", href=True):
        href = a["href"].strip()
        if href.startswith("javascript:") or href == "#":
            continue
        full = urljoin(base_url, href)
        if is_internal(full):
            links.add(full.split("#")[0])
    # try to catch URLs in inline onclick/data-* attributes
    for tag in soup.find_all(True):
        for attr in ("onclick","data-href","data-url","data-link","href"):
            if tag.has_attr(attr):
                v = tag.get(attr)
                if v:
                    full = urljoin(base_url, v)
                    if is_internal(full):
                        links.add(full.split("#")[0])
    # optional: extract urls from inline JS/text (basic regex)
    if EXTRACT_INLINE_URLS:
        text = soup.get_text(separator=" ")
        for m in re.findall(r"https?://[^\s'\"<>]+", text):
            if is_internal(m):
                links.add(m.split("#")[0])
    return {normalize_url(u) for u in links}

def crawl_seeds(seeds):
    discovered = set()
    pages = {}
    count = 0
    for s in seeds:
        if MAX_PAGES and count>=MAX_PAGES:
            break
        s_norm = normalize_url(s)
        pages[s_norm] = {"status": None, "links": [], "error": None}
        if not allowed(s_norm):
            pages[s_norm]["error"] = "disallowed_by_robots"
            logging.info("DISALLOWED by robots: %s", s_norm)
            continue
        try:
            r = session.get(s_norm, timeout=TIMEOUT, allow_redirects=True)
            pages[s_norm]["status"] = r.status_code
            ctype = r.headers.get("Content-Type","")
            if r.status_code==200 and "text/html" in ctype:
                links = extract_links(r.text, s_norm)
                pages[s_norm]["links"] = sorted(list(links))
                discovered.update(links)
            else:
                pages[s_norm]["links"] = []
            count += 1
        except Exception as e:
            pages[s_norm]["error"] = str(e)
            logging.warning("Error fetching %s : %s", s_norm, e)
        time.sleep(RATE_SEC)
    return discovered, pages

def main():
    seeds_unique = [normalize_url(s) for s in sorted(set(SEEDS))]
    logging.info("Seeds unique: %d", len(seeds_unique))
    discovered, pages = crawl_seeds(seeds_unique)
    out = {"seeds_count": len(seeds_unique),
           "discovered_count": len(discovered),
           "seeds": seeds_unique,
           "pages": pages,
           "discovered": sorted(list(discovered))}
    Path(OUT_FILE).write_text(json.dumps(out, indent=2, ensure_ascii=False), encoding="utf8")
    logging.info("Saved %s  -- discovered %d", OUT_FILE, len(discovered))
    # optional: write raw_index.csv
    try:
        import csv
        with open(RAW_INDEX,"w",newline="",encoding="utf8") as f:
            w = csv.writer(f)
            w.writerow(["source_type","file_or_url","status_or_error"])
            for url, info in pages.items():
                status = info.get("status") or info.get("error")
                w.writerow(["seed", url, status])
    except Exception:
        pass

if __name__ == "__main__":
    main()
