# discover_seeds.py
# Run: python discover_seeds.py
import requests
from urllib.parse import urljoin, urlparse
from bs4 import BeautifulSoup
import tldextract
import json
import time

SEEDS = [
    "https://aast.edu/en/",
    "https://aast.edu/en/idc_apps/reg_paths.php",
    "https://aast.edu/en/colleges/",
    "https://aast.edu/en/colleges/coe/alex/",
    "https://aast.edu/en/colleges/coe/heliopolis/",
    "https://aast.edu/en/colleges/coe/elalamein/",
    
    "https://aast.edu/",
    "https://aast.edu/en/",
    "https://aast.edu/ar/",
    "https://aast.edu/en/colleges/",
    "https://aast.edu/ar/colleges/",
    "https://aast.edu/en/about/",
    "https://aast.edu/en/admission/",
    "https://aast.edu/en/news/",
    "https://aast.edu/en/events/",
    "https://aast.edu/en/campuses/",
    "https://aast.edu/en/contacts/",
    "https://aast.edu/en/programs-courses/results.php?area_study_id=0&search=",

    # Colleges Roots
    "https://aast.edu/en/colleges/comt/",
    "https://aast.edu/en/colleges/coe/",
    "https://aast.edu/en/colleges/cmt/",
    "https://aast.edu/en/colleges/citl/",
    "https://aast.edu/en/colleges/ccit/",
    "https://aast.edu/en/colleges/cfat/",
    "https://aast.edu/en/colleges/pharmacy/",
    "https://aast.edu/en/colleges/law/",
    "https://aast.edu/en/colleges/clc/",
    "https://aast.edu/en/colleges/medicine/",
    "https://aast.edu/en/colleges/archaeology/",
    "https://aast.edu/en/colleges/CAI/",
    "https://aast.edu/en/colleges/dentistry/",
    "https://aast.edu/en/colleges/gsb/",
    "https://aast.edu/en/colleges/art/",
    "https://aast.edu/en/colleges/physical-therapy/",
    "https://aast.edu/en/colleges/maritime/",
    "https://aast.edu/en/colleges/practical-training/",

    # Arabic versions
    "https://aast.edu/ar/colleges/comt/",
    "https://aast.edu/ar/colleges/coe/",

    # COE Branches
    "https://aast.edu/en/colleges/coe/heliopolis/",
    "https://aast.edu/en/colleges/coe/smartvillage/",
    "https://aast.edu/en/colleges/coe/port-saeid/",
    "https://aast.edu/en/colleges/coe/elalamein/",
    "https://aast.edu/en/colleges/coe/southValley/",
    "https://aast.edu/en/colleges/coe/latakia/",

    # CMT Branches
    "https://aast.edu/en/colleges/cmt/heliopolis/",
    "https://aast.edu/en/colleges/cmt/smartvillage/",
    "https://aast.edu/en/colleges/cmt/dokki/index.php",
    "https://aast.edu/en/colleges/cmt/elalamein/",
    "https://aast.edu/en/colleges/cmt/southvalley/",
    "https://aast.edu/en/colleges/cmt/latakia/index.php",

    # Content Pages (Examples)
    "https://aast.edu/en/about/contenttemp.php?page_id=1000100031",
    "https://aast.edu/en/about/contenttemp.php?page_id=1000100020",
    "https://aast.edu/en/about/contenttemp.php?page_id=1000100025",

    # CAI Content Pages
    "https://aast.edu/en/colleges/CAI/contenttemp.php?page_id=65500001",
    "https://aast.edu/en/colleges/CAI/contenttemp.php?page_id=65500004",
    "https://aast.edu/en/colleges/CAI/contenttemp.php?page_id=65500005",
    "https://aast.edu/en/colleges/CAI/contenttemp.php?page_id=65500006",
    "https://aast.edu/en/colleges/CAI/contenttemp.php?page_id=65500007",
    "https://aast.edu/en/colleges/CAI/contenttemp.php?page_id=65500008",
    "https://aast.edu/en/colleges/CAI/contenttemp.php?page_id=65500009",
    "https://aast.edu/en/colleges/CAI/contenttemp.php?page_id=65500010",
    "https://aast.edu/en/colleges/CAI/contenttemp.php?page_id=65500011",
    "https://aast.edu/en/colleges/CAI/contenttemp.php?page_id=65500014",
    "https://aast.edu/en/colleges/CAI/contenttemp.php?page_id=65500015",
    "https://aast.edu/en/colleges/CAI/contenttemp.php?page_id=65500016",
    "https://aast.edu/en/colleges/CAI/contenttemp.php?page_id=65500017",
    "https://aast.edu/en/colleges/CAI/contenttemp.php?page_id=65500021",
    "https://aast.edu/en/colleges/CAI/contenttemp.php?page_id=65500022",
    "https://aast.edu/en/colleges/CAI/contenttemp.php?page_id=65500024",
    "https://aast.edu/en/colleges/CAI/contenttemp.php?page_id=65500025",
    "https://aast.edu/en/colleges/CAI/contenttemp.php?page_id=65500026",

    # CAI Program Pages
    "https://aast.edu/en/colleges/CAI/programtemp.php?program_id=277&unit_id=655",
    "https://aast.edu/en/colleges/CAI/programtemp.php?program_id=283&unit_id=655",

    # CAI Staff Pages
    "https://aast.edu/en/colleges/CAI/stafftemp.php?admin=1&unit_id=655",
    "https://aast.edu/en/colleges/CAI/stafftemp.php?admin=2&unit_id=655",
    "https://aast.edu/en/colleges/CAI/stafftemp.php?admin=3&unit_id=655",
    "https://aast.edu/en/colleges/CAI/stafftemp.php?admin=4&unit_id=655",
    "https://aast.edu/en/colleges/CAI/stafftemp.php?admin=5&unit_id=655",

    # CV Pages (Sample)
    "https://aast.edu/cv.php?ser=161025",
    "https://aast.edu/cv.php?ser=161026",
    "https://aast.edu/cv.php?ser=161027",
    "https://aast.edu/cv.php?ser=161028",
    "https://aast.edu/cv.php?ser=161029",
    "https://aast.edu/cv.php?ser=161030",
    "https://aast.edu/cv.php?ser=161031",
    "https://aast.edu/cv.php?ser=161032",
    "https://aast.edu/cv.php?ser=161033",
    "https://aast.edu/cv.php?ser=161034",
    "https://aast.edu/cv.php?ser=161035",
    "https://aast.edu/cv.php?ser=161036",
    "https://aast.edu/cv.php?ser=161037",
    "https://aast.edu/cv.php?ser=161038",
    "https://aast.edu/cv.php?ser=161039",
    "https://aast.edu/cv.php?ser=161040",
    "https://aast.edu/cv.php?ser=161041",
    "https://aast.edu/cv.php?ser=161042",
    "https://aast.edu/cv.php?ser=161043",
    "https://aast.edu/cv.php?ser=161044",
    "https://aast.edu/cv.php?ser=161045",
    "https://aast.edu/cv.php?ser=161046",
    "https://aast.edu/cv.php?ser=161047",
    "https://aast.edu/cv.php?ser=161048",
    "https://aast.edu/cv.php?ser=161049",
    "https://aast.edu/cv.php?ser=161050",
    "https://aast.edu/cv.php?ser=161051",
    "https://aast.edu/cv.php?ser=161052",
    "https://aast.edu/cv.php?ser=161053",
    "https://aast.edu/cv.php?ser=161054",
    "https://aast.edu/cv.php?ser=161055",
    "https://aast.edu/cv.php?ser=161056",
    "https://aast.edu/cv.php?ser=161057",
    "https://aast.edu/cv.php?ser=161058",
    "https://aast.edu/cv.php?ser=161059",
    "https://aast.edu/cv.php?ser=161060",

    # News Samples
    "https://aast.edu/en/news/news-details.php?language=1&view=1&unit_id=1&news_id=486105540&event_type_id=1",
    "https://aast.edu/en/news/news-details.php?language=1&view=1&unit_id=1&news_id=486105541&event_type_id=1",
    "https://aast.edu/en/news/news-details.php?language=1&view=1&unit_id=1&news_id=486105542&event_type_id=1",

    # Events Samples
    "https://aast.edu/en/events/event-details.php?event_id=100&unit_id=482",
    "https://aast.edu/en/events/event-details.php?event_id=101&unit_id=482",

    # Files / PDF / Media
    "https://aast.edu/en/about/pdf/AASTMT-Strategic-Plan-2021-2026.pdf",
    "https://aast.edu/en/new-applicants/media/AAST-International-Degrees-2021-Final.pdf",

    # Presidency + Centers
    "https://aast.edu/en/presidency/",
    "https://aast.edu/en/vice/edu-affairs/",
    "https://aast.edu/en/research/",
    "https://aast.edu/en/training-courses/",
    "https://aast.edu/en/gallery/index.php",

    # Sitemap
    "https://aast.edu/en/sitemap/sitemap.php?unit_id=1&lang_id=1"
]

HEADERS = {"User-Agent":"Mozilla/5.0 (X11; Linux x86_64) AASTScraper/1.0"}

def check_robots(base):
    try:
        r = requests.get(urljoin(base, "/robots.txt"), headers=HEADERS, timeout=10)
        return r.status_code, r.text[:2000]
    except Exception as e:
        return None, str(e)

def extract_links(html, base_url):
    soup = BeautifulSoup(html, "lxml")
    links = set()
    for a in soup.find_all("a", href=True):
        href = a["href"].strip()
        if href.startswith("javascript:") or href == "#":
            continue
        full = urljoin(base_url, href)
        if urlparse(full).netloc.endswith("aast.edu"):
            links.add(full.split("#")[0])
    return links

def main():
    discovered = set()
    data = {"seeds": SEEDS, "robots": {}, "pages": {}}
    base = "https://aast.edu"
    status, robots_text = check_robots(base)
    data["robots"]["status"] = status
    data["robots"]["content"] = robots_text
    for s in SEEDS:
        try:
            r = requests.get(s, headers=HEADERS, timeout=15)
            data["pages"][s] = {"status": r.status_code, "links": []}
            if r.status_code == 200 and "text/html" in r.headers.get("Content-Type",""):
                links = extract_links(r.text, s)
                data["pages"][s]["links"] = list(links)
                discovered.update(links)
            time.sleep(1.0)
        except Exception as e:
            data["pages"][s] = {"error": str(e)}
    # Save
    with open("discovery_seed_links.json", "w", encoding="utf8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print("Saved discovery_seed_links.json - found", len(discovered), "unique internal links")

if __name__ == "__main__":
    main()
