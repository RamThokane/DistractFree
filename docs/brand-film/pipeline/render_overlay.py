"""Render overlay.html to a transparent PNG sequence (25 fps)."""
import sys, os, shutil, pathlib
from playwright.sync_api import sync_playwright
HTML, OUT, DUR = sys.argv[1], sys.argv[2], float(sys.argv[3])
FPS = 25
os.makedirs(OUT, exist_ok=True)
with sync_playwright() as p:
    b = p.chromium.launch(channel='msedge')
    pg = b.new_page(viewport={'width': 1920, 'height': 1080})
    pg.goto(pathlib.Path(HTML).resolve().as_uri())
    pg.evaluate('document.fonts.ready')
    pg.wait_for_timeout(500)
    empty = None
    n = int(round(DUR * FPS))
    for i in range(n):
        t = i / FPS
        visible = pg.evaluate(f'window.render({t})')
        path = f'{OUT}/f{i:05d}.png'
        if not visible:
            if empty is None:
                pg.screenshot(path=path, omit_background=True); empty = path
            else:
                shutil.copyfile(empty, path)
        else:
            pg.screenshot(path=path, omit_background=True)
        if i % 250 == 0: print('frame', i, '/', n, flush=True)
    b.close()
