import zlib, struct

W, H = 1200, 630
BG = (11, 27, 33)        # near-black teal
TEAL = (0, 179, 166)     # brand
WHITE = (245, 250, 249)
GREY = (138, 158, 156)

# 5x7 block glyphs. Enough for the wordmark and the strapline; anything a
# proper font would do better is not worth a 4MB dependency for one image.
GLYPHS = {
    "P": ["1111 ", "1   1", "1   1", "1111 ", "1    ", "1    ", "1    "],
    "D": ["1111 ", "1   1", "1   1", "1   1", "1   1", "1   1", "1111 "],
    "F": ["11111", "1    ", "1    ", "1111 ", "1    ", "1    ", "1    "],
    # UPPERCASE ONLY, deliberately.
    #
    # Two attempts at lowercase failed on a 5x7 grid: it has no descender rows,
    # so "PDFly" rendered first as "PDF1Y" and then as "PDFI4". A wordmark that
    # misreads the brand name is worse than one that is merely set in caps.
    # Real lowercase needs a real font, which needs a rasteriser, which is a
    # multi-megabyte dependency for one static image.
    "L": ["1    ", "1    ", "1    ", "1    ", "1    ", "1    ", "11111"],
    "Y": ["1   1", "1   1", " 1 1 ", "  1  ", "  1  ", "  1  ", "  1  "],
    "B": ["1111 ", "1   1", "1   1", "1111 ", "1   1", "1   1", "1111 "],
    "3": ["1111 ", "    1", "    1", " 111 ", "    1", "    1", "1111 "],
    "I": ["11111", "  1  ", "  1  ", "  1  ", "  1  ", "  1  ", "11111"],
    "D": ["1111 ", "1   1", "1   1", "1   1", "1   1", "1   1", "1111 "],
    "H": ["1   1", "1   1", "1   1", "11111", "1   1", "1   1", "1   1"],
    "M": ["1   1", "11 11", "1 1 1", "1   1", "1   1", "1   1", "1   1"],
    "N": ["1   1", "11  1", "1 1 1", "1  11", "1   1", "1   1", "1   1"],
    "S": [" 1111", "1    ", "1    ", " 111 ", "    1", "    1", "1111 "],
    "O": [" 111 ", "1   1", "1   1", "1   1", "1   1", "1   1", " 111 "],
    "U": ["1   1", "1   1", "1   1", "1   1", "1   1", "1   1", " 111 "],
    "R": ["1111 ", "1   1", "1   1", "1111 ", "1 1  ", "1  1 ", "1   1"],
    "E": ["11111", "1    ", "1    ", "1111 ", "1    ", "1    ", "11111"],
    "V": ["1   1", "1   1", "1   1", "1   1", "1   1", " 1 1 ", "  1  "],
    "T": ["11111", "  1  ", "  1  ", "  1  ", "  1  ", "  1  ", "  1  "],
    "W": ["1   1", "1   1", "1   1", "1 1 1", "1 1 1", "11 11", "1   1"],
    "A": [" 111 ", "1   1", "1   1", "11111", "1   1", "1   1", "1   1"],
    "C": [" 1111", "1    ", "1    ", "1    ", "1    ", "1    ", " 1111"],
    "G": [" 1111", "1    ", "1    ", "1  11", "1   1", "1   1", " 111 "],
    ".": ["     ", "     ", "     ", "     ", "     ", "     ", " 1   "],
    " ": ["     ", "     ", "     ", "     ", "     ", "     ", "     "],
}

canvas = [[BG for _ in range(W)] for _ in range(H)]

def disc(cx, cy, r, colour):
    r2 = r * r
    for y in range(max(0, cy - r), min(H, cy + r)):
        dy2 = (y - cy) ** 2
        for x in range(max(0, cx - r), min(W, cx + r)):
            if (x - cx) ** 2 + dy2 < r2:
                canvas[y][x] = colour

def text(s, x0, y0, scale, colour):
    cx = x0
    for ch in s:
        g = GLYPHS.get(ch, GLYPHS[" "])
        for gy, row in enumerate(g):
            for gx, on in enumerate(row):
                if on == "1":
                    for py in range(scale):
                        for px in range(scale):
                            X, Y = cx + gx * scale + px, y0 + gy * scale + py
                            if 0 <= X < W and 0 <= Y < H:
                                canvas[Y][X] = colour
        cx += 6 * scale
    return cx

def rect(x, y, w, h, colour):
    for Y in range(max(0, y), min(H, y + h)):
        for X in range(max(0, x), min(W, x + w)):
            canvas[Y][X] = colour

disc(W - 120, 130, 250, (14, 43, 47))   # soft corner accent, barely lighter
rect(0, H - 10, W, 10, TEAL)            # brand bar along the bottom

# Descenders on y and p need the extra row the 7-row grid does not have, so
# the wordmark sits high enough that they clear the strapline below it.
text("PDFLY", 90, 175, 15, WHITE)
text("BY 3IDHMINDS", 94, 330, 5, TEAL)
text("FREE PDF TOOLS.", 94, 425, 5, GREY)
text("YOUR FILES NEVER LEAVE YOUR BROWSER.", 94, 485, 5, GREY)

raw = bytearray()
for row in canvas:
    raw.append(0)
    for px in row:
        raw += bytes(px)

def chunk(t, d):
    c = t + d
    return struct.pack(">I", len(d)) + c + struct.pack(">I", zlib.crc32(c) & 0xffffffff)

png = (
    b"\x89PNG\r\n\x1a\n"
    + chunk(b"IHDR", struct.pack(">IIBBBBB", W, H, 8, 2, 0, 0, 0))
    + chunk(b"IDAT", zlib.compress(bytes(raw), 9))
    + chunk(b"IEND", b"")
)
open("public/og-image.png", "wb").write(png)

d = open("public/og-image.png", "rb").read()
w, h = struct.unpack(">II", d[16:24])
print("written {}x{}, {:,} bytes, PNG magic ok: {}".format(w, h, len(d), d[:8] == b"\x89PNG\r\n\x1a\n"))
