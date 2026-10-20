"""Small 2D geometry helpers for the village layout (map metres, plain tuples)."""
import math


def seg_dist(p, a, b):
    ax, ay = a
    bx, by = b
    dx, dy = bx - ax, by - ay
    L2 = dx * dx + dy * dy
    t = 0.0 if L2 == 0 else max(0.0, min(1.0, ((p[0] - ax) * dx + (p[1] - ay) * dy) / L2))
    qx, qy = ax + t * dx, ay + t * dy
    return math.hypot(p[0] - qx, p[1] - qy)


def poly_dist(p, pts):
    return min(seg_dist(p, a, b) for a, b in zip(pts, pts[1:]))


def rect_poly_dist(rect, pts, samples=4):
    """Approximate min distance from a rectangle to a polyline (sample the rectangle)."""
    x0, y0, x1, y1 = rect
    best = 1e9
    for i in range(samples + 1):
        for j in range(samples + 1):
            p = (x0 + (x1 - x0) * i / samples, y0 + (y1 - y0) * j / samples)
            best = min(best, poly_dist(p, pts))
    # a polyline vertex inside the rectangle means overlap
    for q in pts:
        if x0 <= q[0] <= x1 and y0 <= q[1] <= y1:
            return 0.0
    # segment crossing the rectangle
    for a, b in zip(pts, pts[1:]):
        for k in range(21):
            t = k / 20
            q = (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)
            if x0 <= q[0] <= x1 and y0 <= q[1] <= y1:
                return 0.0
    return best


def rects_overlap(a, b, margin=0.0):
    return not (a[2] + margin <= b[0] or b[2] + margin <= a[0] or a[3] + margin <= b[1] or b[3] + margin <= a[1])


def point_in_poly(p, pts):
    x, y = p
    inside = False
    n = len(pts)
    for i in range(n):
        x1, y1 = pts[i]
        x2, y2 = pts[(i + 1) % n]
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1 + 1e-12) + x1:
            inside = not inside
    return inside


def rect_poly_overlap(rect, poly, margin=0.0):
    x0, y0, x1, y1 = rect
    for i in range(5):
        for j in range(5):
            if point_in_poly((x0 + (x1 - x0) * i / 4, y0 + (y1 - y0) * j / 4), poly):
                return True
    for q in poly:
        if x0 - margin <= q[0] <= x1 + margin and y0 - margin <= q[1] <= y1 + margin:
            return True
    ring = list(poly) + [poly[0]]
    return rect_poly_dist(rect, ring) < margin


def offset_poly(pts, d):
    """Offset a closed polygon outward by d (vertex-normal approximation; fine for gentle shapes)."""
    n = len(pts)
    # orientation: positive area = counter-clockwise in a y-up frame
    area = sum(pts[i][0] * pts[(i + 1) % n][1] - pts[(i + 1) % n][0] * pts[i][1] for i in range(n)) / 2
    sgn = 1 if area > 0 else -1
    out = []
    for i in range(n):
        p0, p1, p2 = pts[i - 1], pts[i], pts[(i + 1) % n]
        normals = []
        for a, b in ((p0, p1), (p1, p2)):
            ex, ey = b[0] - a[0], b[1] - a[1]
            L = math.hypot(ex, ey) or 1
            normals.append((sgn * ey / L, -sgn * ex / L))
        nx, ny = normals[0][0] + normals[1][0], normals[0][1] + normals[1][1]
        L = math.hypot(nx, ny) or 1
        out.append((p1[0] + nx / L * d, p1[1] + ny / L * d))
    return out


def polyline_length(pts):
    return sum(math.hypot(b[0] - a[0], b[1] - a[1]) for a, b in zip(pts, pts[1:]))


def walk(pts, step, offset=0.0, start=0.0):
    """Points every `step` along a polyline (from distance `start`), shifted sideways by `offset`
    (to the left of travel in a y-up frame). Yields (x, y, angle_of_travel)."""
    segs = []
    total = 0.0
    for a, b in zip(pts, pts[1:]):
        L = math.hypot(b[0] - a[0], b[1] - a[1])
        if L > 0:
            segs.append((a, b, total, L))
            total += L
    d = start
    i = 0
    while d <= total and segs:
        while i < len(segs) - 1 and d > segs[i][2] + segs[i][3]:
            i += 1
        a, b, s0, L = segs[i]
        t = (d - s0) / L
        ux, uy = (b[0] - a[0]) / L, (b[1] - a[1]) / L
        yield (a[0] + ux * L * t - uy * offset, a[1] + uy * L * t + ux * offset, math.atan2(uy, ux))
        d += step
