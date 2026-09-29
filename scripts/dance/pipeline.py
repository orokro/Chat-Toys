"""
pipeline.py
-----------
Shared steps that turn 3D stick-figure joints (CMU mocap or our hand-keyed
dances) into the small 2D loops Emoji Fountain plays.

Space used throughout: y up, the dancer faces +z (the viewer), their left
side is +x, the floor is y = 0 and the base of the head of a standing
dancer is at y = 86 (so a dancer with its head is ~100 tall).

Output of one dance (see pack()):
    frames of 18 joints (x, y) + 6 depth values, as integers in tenths of a
    unit, at FPS frames per second, looping seamlessly (the frame after the
    last one is the first one).
"""

import numpy as np

from cmu import JOINT_NAMES

J = {n: i for i, n in enumerate(JOINT_NAMES)}

FPS = 15
HEAD_Y = 86.0

# depth values stored per frame, in this order (the runtime sorts the parts
# it draws by these, back to front)
DEPTH_PARTS = ['lArm', 'rArm', 'lLeg', 'rLeg', 'torso', 'head']


def smooth(a, sigma):
    """Gaussian smoothing along axis 0 (edges padded by reflection)."""
    if sigma <= 0:
        return a.copy()
    r = int(np.ceil(sigma * 3))
    k = np.exp(-0.5 * (np.arange(-r, r + 1) / sigma) ** 2)
    k /= k.sum()
    pad = np.concatenate([a[r:0:-1], a, a[-2:-r - 2:-1]], axis=0)
    out = np.zeros_like(a, dtype=float)
    for i, w in enumerate(k):
        out += w * pad[i:i + len(a)]
    return out


def smooth_cyclic(a, sigma):
    """Gaussian smoothing along axis 0 of a loop (wraps around)."""
    if sigma <= 0:
        return a.copy()
    r = int(np.ceil(sigma * 3))
    k = np.exp(-0.5 * (np.arange(-r, r + 1) / sigma) ** 2)
    k /= k.sum()
    out = np.zeros_like(a, dtype=float)
    for i, w in enumerate(k):
        out += w * np.roll(a, r - i, axis=0)
    return out


def rot_y(theta):
    c, s = np.cos(theta), np.sin(theta)
    return np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]])


def facing_angles(P):
    """Per-frame yaw (radians, unwrapped) of the dancer's facing direction."""
    across = (P[:, J['lHip']] - P[:, J['rHip']]) + (P[:, J['lShoulder']] - P[:, J['rShoulder']])
    # facing = across x up  (left = +x, facing = +z)
    fx, fz = -across[:, 2], across[:, 0]
    return np.unwrap(np.arctan2(fx, fz))


def face_camera(P, fps, window_s=0.6, keep_sway=1.0):
    """
    Turn a (frames, joints, 3) clip so the dancer always faces +z and dances
    on the spot: the facing is smoothed over `window_s` seconds (so quick
    twists survive but turns and drift are removed) and the pelvis keeps
    only its short-term sway around a smoothed path.
    """
    yaw = smooth(facing_angles(P), window_s * fps / 2)
    pel = P[:, J['pelvis']].copy()
    path = smooth(pel[:, [0, 2]], 0.75 * fps)
    out = np.empty_like(P)
    for f in range(len(P)):
        R = rot_y(-yaw[f])
        rel = P[f] - np.array([path[f, 0], 0, path[f, 1]])
        out[f] = rel @ R.T
    # re-centre the residual sway, scaled
    sway = out[:, J['pelvis'], [0, 2]]
    out[:, :, 0] -= (1 - keep_sway) * sway[:, 0:1]
    out[:, :, 2] -= (1 - keep_sway) * sway[:, 1:2]
    # how the removed path moved, in the dancer's own frame (units / frame),
    # for dances whose travel is the point (the moonwalk)
    vel = np.gradient(path, axis=0)
    local = np.stack([np.cos(yaw) * vel[:, 0] - np.sin(yaw) * vel[:, 1],
                      np.sin(yaw) * vel[:, 0] + np.cos(yaw) * vel[:, 1]], axis=1)
    return out, local


def find_loop(P, lo, hi, min_len, max_len, blend):
    """
    Best loop [s, e) inside [lo, hi): the end pose/velocity closest to the
    start pose/velocity. Poses are compared relative to the pelvis (plus the
    pelvis height), so the loop is free to be anywhere on the floor.
    """
    rel = P - P[:, J['pelvis']:J['pelvis'] + 1] * np.array([1, 0, 1])
    vel = np.gradient(rel, axis=0)
    best = None
    for s in range(max(lo, blend), hi - min_len):
        e0, e1 = s + min_len, min(hi, s + max_len)
        if e1 <= e0:
            continue
        c = np.abs(rel[e0:e1] - rel[s]).mean(axis=(1, 2)) + 4 * np.abs(vel[e0:e1] - vel[s]).mean(axis=(1, 2))
        k = int(np.argmin(c))
        if best is None or c[k] < best[0]:
            best = (float(c[k]), s, e0 + k)
    return best


def blend_loop(P, s, e, blend):
    """
    Frames [s, e) made seamless: the last `blend` frames ease into the
    frames that lead up to s, so frame e-1 flows straight into frame s.
    """
    L = P[s:e].copy()
    for i in range(blend):
        w = (i + 1) / (blend + 1)
        w = w * w * (3 - 2 * w)
        L[len(L) - blend + i] = (1 - w) * P[e - blend + i] + w * P[s - blend + i]
    return L


def resample_loop(L, src_fps, dst_fps=FPS):
    """Resample a loop to dst_fps (a whole number of frames, wrapping)."""
    n = max(4, int(round(len(L) * dst_fps / src_fps)))
    t = np.arange(n) * (len(L) / n)
    i0 = np.floor(t).astype(int) % len(L)
    i1 = (i0 + 1) % len(L)
    w = (t - np.floor(t))[:, None, None]
    return (1 - w) * L[i0] + w * L[i1]


def ground(P, pct=3):
    """Put the floor at y = 0 (robust low point of the feet)."""
    feet = P[:, [J['lToe'], J['rToe'], J['lAnkle'], J['rAnkle']], 1].min(axis=1)
    return P - np.array([0, np.percentile(feet, pct), 0])


def project(L, view_deg):
    """
    Orthographic view from `view_deg` degrees round to the dancer's left
    (0 = straight on, 90 = profile). Returns (frames, joints, 2) positions and
    (frames, parts) depth (bigger = nearer the viewer).
    """
    R = rot_y(np.deg2rad(view_deg))
    V = L @ R.T
    xy = V[:, :, :2].copy()
    xy[:, :, 0] -= V[:, J['pelvis'], 0].mean()
    z = V[:, :, 2]
    zp = z[:, J['pelvis']:J['pelvis'] + 1]
    depth = np.stack([
        z[:, [J['lElbow'], J['lWrist']]].mean(axis=1),
        z[:, [J['rElbow'], J['rWrist']]].mean(axis=1),
        z[:, [J['lKnee'], J['lAnkle']]].mean(axis=1),
        z[:, [J['rKnee'], J['rAnkle']]].mean(axis=1),
        z[:, J['chest']],
        z[:, J['head']],
    ], axis=1) - zp
    return xy, depth


def pack(xy, depth, meta):
    """The JSON record for one dance."""
    flat = []
    for f in range(len(xy)):
        flat.extend(int(round(v * 10)) for v in xy[f].reshape(-1))
        flat.extend(int(round(v * 10)) for v in depth[f])
    return {**meta, 'frames': len(xy), 'data': flat}
