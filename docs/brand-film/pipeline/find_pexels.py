"""Find a landscape HD file URL for each Pexels video id (HEAD requests only)."""
import sys, urllib.request, concurrent.futures as cf

SIZES = ["hd_1920_1080", "uhd_2560_1440", "uhd_3840_2160", "uhd_4096_2160", "hd_1280_720"]
FPS = ["25", "24", "30", "50", "60", "29", "23"]

def head(url):
    try:
        req = urllib.request.Request(url, method="HEAD", headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=15) as r:
            return r.status == 200 and r.headers.get("Content-Type", "").startswith("video/"), int(r.headers.get("Content-Length", 0))
    except Exception:
        return False, 0

def find(vid):
    for size in SIZES:
        urls = [f"https://videos.pexels.com/video-files/{vid}/{vid}-{size}_{fps}fps.mp4" for fps in FPS]
        with cf.ThreadPoolExecutor(5) as ex:
            for url, (ok, n) in zip(urls, ex.map(head, urls)):
                if ok:
                    return vid, url, n
    return vid, None, 0

ids = sys.argv[1:]
with cf.ThreadPoolExecutor(6) as ex:
    for vid, url, n in ex.map(find, ids):
        print(vid, url or "NOT-FOUND", f"{n/1e6:.1f}MB" if n else "")
