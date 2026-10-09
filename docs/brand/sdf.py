"""Mini-kit de formas orgânicas: campos de distância (SDF) com união suave, convertidos em <path> vetorial.

Cada forma é uma função f(x, y) -> distância (negativa por dentro). As uniões suaves (smin) dão o "fluxo"
de massa contínua do mascote; o contorno sai por marching squares e vira curvas de Bézier (Catmull-Rom).
"""
import math
import numpy as np
from skimage import measure


# ---------- primitivas (coordenadas locais) ----------
def circle(cx, cy, r):
    return lambda x, y: np.hypot(x - cx, y - cy) - r


def ellipse(cx, cy, rx, ry, rot=0):
    c, s = math.cos(math.radians(rot)), math.sin(math.radians(rot))

    def f(x, y):
        dx, dy = x - cx, y - cy
        u, v = c * dx + s * dy, -s * dx + c * dy
        k0 = np.hypot(u / rx, v / ry)
        k1 = np.hypot(u / rx**2, v / ry**2)
        return k0 * (k0 - 1.0) / np.maximum(k1, 1e-9)
    return f


def cone(ax, ay, bx, by, r1, r2):
    """Cápsula afunilada do ponto a (raio r1) ao ponto b (raio r2)."""
    vx, vy = bx - ax, by - ay
    L2 = vx * vx + vy * vy

    def f(x, y):
        t = np.clip(((x - ax) * vx + (y - ay) * vy) / L2, 0, 1)
        return np.hypot(x - ax - vx * t, y - ay - vy * t) - (r1 + (r2 - r1) * t)
    return f


def bezier_pts(p0, p1, p2, p3, n=24):
    t = np.linspace(0, 1, n)[:, None]
    P = [np.array(p, float) for p in (p0, p1, p2, p3)]
    return (1 - t) ** 3 * P[0] + 3 * (1 - t) ** 2 * t * P[1] + 3 * (1 - t) * t**2 * P[2] + t**3 * P[3]


def tube(points, r1, r2):
    """Tubo afunilado ao longo de uma polilinha (cauda, braços curvos)."""
    pts = np.asarray(points, float)
    n = len(pts) - 1
    parts = [cone(*pts[i], *pts[i + 1], r1 + (r2 - r1) * i / n, r1 + (r2 - r1) * (i + 1) / n) for i in range(n)]
    return lambda x, y: np.minimum.reduce([p(x, y) for p in parts])


def curve(p0, p1, p2, p3, r1, r2, n=24):
    return tube(bezier_pts(p0, p1, p2, p3, n), r1, r2)


def poly(points, r=0):
    """Polígono (convexo ou não) com cantos arredondados por r."""
    P = np.asarray(points, float)

    def f(x, y):
        d = np.full(x.shape, np.inf)
        sgn = np.ones(x.shape)
        for i in range(len(P)):
            a, b = P[i - 1], P[i]
            ex, ey = a[0] - b[0], a[1] - b[1]
            wx, wy = x - b[0], y - b[1]
            t = np.clip((wx * ex + wy * ey) / (ex * ex + ey * ey), 0, 1)
            d = np.minimum(d, (wx - ex * t) ** 2 + (wy - ey * t) ** 2)
            c1 = y >= b[1]
            c2 = y < a[1]
            c3 = ex * wy > ey * wx
            flip = (c1 & c2 & c3) | (~c1 & ~c2 & ~c3)
            sgn = np.where(flip, -sgn, sgn)
        return sgn * np.sqrt(d) - r
    return f


# ---------- combinações ----------
def smin(a, b, k):
    h = np.clip(0.5 + 0.5 * (b - a) / k, 0, 1)
    return b * (1 - h) + a * h - k * h * (1 - h)


def union(*fs, k=10):
    def f(x, y):
        d = fs[0](x, y)
        for g in fs[1:]:
            d = smin(d, g(x, y), k)
        return d
    return f


def hard(*fs):
    return lambda x, y: np.minimum.reduce([g(x, y) for g in fs])


def cut(a, b, k=4):
    """a menos b, com borda suave."""
    return lambda x, y: -smin(-a(x, y), b(x, y), k)


def place(f, cx=0, cy=0, s=1, rot=0, flip=False):
    """Posiciona uma forma local na cena (translação, escala, rotação em graus, espelho)."""
    c, sn = math.cos(math.radians(rot)), math.sin(math.radians(rot))

    def g(x, y):
        dx, dy = (x - cx) / s, (y - cy) / s
        u, v = c * dx + sn * dy, -sn * dx + c * dy
        if flip:
            u = -u
        return f(u, v) * s
    return g


# ---------- campo -> path ----------
def to_path(f, w, h, res=4, step=5.0, x0=0, y0=0):
    xs = x0 + (np.arange(int(w * res)) + 0.5) / res
    ys = y0 + (np.arange(int(h * res)) + 0.5) / res
    X, Y = np.meshgrid(xs, ys)
    F = np.pad(f(X, Y), 1, constant_values=1e3)
    out = []
    for c in measure.find_contours(F, 0.0):
        pts = np.column_stack([x0 + (c[:, 1] - 1 + 0.5) / res, y0 + (c[:, 0] - 1 + 0.5) / res])
        if len(pts) < 8:
            continue
        pts = resample(pts, step)
        if len(pts) >= 3:
            out.append(catmull(pts))
    return " ".join(out)


def resample(pts, step):
    """Pontos igualmente espaçados ao longo do contorno (Catmull-Rom não "estufa" entre trechos desiguais)."""
    seg = np.hypot(*np.diff(pts, axis=0).T)
    s = np.concatenate([[0], np.cumsum(seg)])
    n = max(int(s[-1] / step), 8)
    t = np.linspace(0, s[-1], n, endpoint=False)
    return np.column_stack([np.interp(t, s, pts[:, 0]), np.interp(t, s, pts[:, 1])])


def catmull(P, tension=1 / 6):
    n = len(P)
    f = lambda v: f"{v:.1f}".rstrip("0").rstrip(".")
    d = [f"M{f(P[0][0])} {f(P[0][1])}"]
    for i in range(n):
        p0, p1, p2, p3 = P[i - 1], P[i], P[(i + 1) % n], P[(i + 2) % n]
        c1 = p1 + (p2 - p0) * tension
        c2 = p2 - (p3 - p1) * tension
        d.append(f"C{f(c1[0])} {f(c1[1])} {f(c2[0])} {f(c2[1])} {f(p2[0])} {f(p2[1])}")
    return "".join(d) + "Z"


def array_path(F, scale=1.0, step=3.0, x0=0, y0=0):
    """Contorno de nível 0 de um campo já amostrado (pixels -> unidades: /scale)."""
    F = np.pad(F, 1, constant_values=1e3)
    out = []
    for c in measure.find_contours(F, 0.0):
        pts = np.column_stack([x0 + (c[:, 1] - 0.5) / scale, y0 + (c[:, 0] - 0.5) / scale])
        if len(pts) < 8:
            continue
        pts = resample(pts, step)
        if len(pts) >= 3:
            out.append(catmull(pts))
    return " ".join(out)
