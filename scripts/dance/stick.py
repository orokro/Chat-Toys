"""
stick.py
--------
Shared helpers for the dance pipeline: facing the camera, projecting 3D
joints to the 2D stick figure, and drawing previews.
"""

import numpy as np
from PIL import Image, ImageDraw

from cmu import JOINT_NAMES

J = {n: i for i, n in enumerate(JOINT_NAMES)}

# limbs in draw order (back to front is decided at runtime); pairs of joints
LIMBS = [
    ('pelvis', 'chest'), ('chest', 'neck'), ('neck', 'head'),
    ('neck', 'lShoulder'), ('lShoulder', 'lElbow'), ('lElbow', 'lWrist'),
    ('neck', 'rShoulder'), ('rShoulder', 'rElbow'), ('rElbow', 'rWrist'),
    ('pelvis', 'lHip'), ('lHip', 'lKnee'), ('lKnee', 'lAnkle'), ('lAnkle', 'lToe'),
    ('pelvis', 'rHip'), ('rHip', 'rKnee'), ('rKnee', 'rAnkle'), ('rAnkle', 'rToe'),
]


def facing_yaw(P):
    """Average yaw (radians) that turns the dancer to face +z (the viewer)."""
    across = (P[:, J['rHip']] - P[:, J['lHip']]) + (P[:, J['rShoulder']] - P[:, J['lShoulder']])
    a = across.mean(axis=0)
    # facing = up x across (y up). Facing the viewer means facing +z.
    f = np.cross(np.array([0, 1, 0]), a)
    return np.arctan2(f[0], f[2])


def rotate_y(P, yaw):
    c, s = np.cos(-yaw), np.sin(-yaw)
    R = np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]])
    return P @ R.T


def render(frames2d, path, cols=10, cell=110, labels=None, title=None):
    """Contact sheet of 2D poses (frames, joints, 2), y up, height ~100."""
    n = len(frames2d)
    rows = (n + cols - 1) // cols
    top = 22 if title else 0
    im = Image.new('RGB', (cols * cell, rows * cell + top), (245, 245, 245))
    d = ImageDraw.Draw(im)
    if title:
        d.text((6, 4), title, fill=(0, 0, 0))
    for k, P in enumerate(frames2d):
        ox, oy = (k % cols) * cell + cell / 2, (k // cols) * cell + top + cell - 8
        s = cell / 135.0
        pt = lambda j: (ox + P[J[j]][0] * s, oy - P[J[j]][1] * s)
        for a, b in LIMBS:
            col = (200, 60, 60) if a.startswith('l') or b.startswith('l') else (60, 60, 200) if a.startswith('r') or b.startswith('r') else (40, 40, 40)
            d.line([pt(a), pt(b)], fill=col, width=3)
        hx, hy = pt('head')
        d.ellipse([hx - 7, hy - 16, hx + 7, hy - 2], outline=(0, 0, 0), width=2)
        if labels:
            d.text((ox - cell / 2 + 3, oy - cell + 10), str(labels[k]), fill=(120, 120, 120))
    im.save(path)
