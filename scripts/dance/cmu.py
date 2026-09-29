"""
cmu.py
------
Minimal reader for the CMU Graphics Lab motion capture files (ASF skeleton +
AMC motion) and forward kinematics to 3D joint positions.

The data comes from mocap.cs.cmu.edu ("The data used in this project was
obtained from mocap.cs.cmu.edu. The database was created with funding from
NSF EIA-0196217."). Motion is 120 fps, y up.
"""

import numpy as np


def _rot(axis, deg):
    r = np.deg2rad(deg)
    c, s = np.cos(r), np.sin(r)
    if axis == 'x':
        return np.array([[1, 0, 0], [0, c, -s], [0, s, c]])
    if axis == 'y':
        return np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]])
    return np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]])


def euler(rx, ry, rz):
    """ASF/AMC convention: rotate about x, then y, then z (R = Rz Ry Rx)."""
    return _rot('z', rz) @ _rot('y', ry) @ _rot('x', rx)


class Bone:
    def __init__(self, name):
        self.name = name
        self.direction = np.zeros(3)
        self.length = 0.0
        self.axis = np.zeros(3)
        self.dof = []
        self.children = []
        self.parent = None


def read_asf(path):
    bones = {'root': Bone('root')}
    lines = open(path).read().splitlines()
    i = 0
    root_order = ['TX', 'TY', 'TZ', 'RX', 'RY', 'RZ']
    root_axis = np.zeros(3)
    while i < len(lines):
        line = lines[i].strip()
        if line.startswith(':root'):
            i += 1
            while i < len(lines) and not lines[i].strip().startswith(':'):
                parts = lines[i].split()
                if parts and parts[0] == 'order':
                    root_order = [p.upper() for p in parts[1:]]
                elif parts and parts[0] == 'orientation':
                    root_axis = np.array([float(x) for x in parts[1:4]])
                i += 1
            continue
        if line.startswith(':bonedata'):
            i += 1
            while i < len(lines) and not lines[i].strip().startswith(':hierarchy'):
                if lines[i].strip() == 'begin':
                    b = None
                    i += 1
                    while lines[i].strip() != 'end':
                        parts = lines[i].split()
                        key = parts[0]
                        if key == 'name':
                            b = Bone(parts[1])
                        elif key == 'direction':
                            b.direction = np.array([float(x) for x in parts[1:4]])
                        elif key == 'length':
                            b.length = float(parts[1])
                        elif key == 'axis':
                            b.axis = np.array([float(x) for x in parts[1:4]])
                        elif key == 'dof':
                            b.dof = [p.lower() for p in parts[1:]]
                        i += 1
                    bones[b.name] = b
                i += 1
            continue
        if line.startswith(':hierarchy'):
            i += 1
            while i < len(lines) and lines[i].strip() != 'end':
                parts = lines[i].split()
                if parts and parts[0] != 'begin':
                    parent = bones[parts[0]]
                    for c in parts[1:]:
                        bones[c].parent = parent
                        parent.children.append(bones[c])
                i += 1
            continue
        i += 1
    bones['root'].axis = root_axis
    bones['root'].root_order = root_order
    return bones


def read_amc(path):
    frames = []
    cur = None
    for line in open(path):
        line = line.strip()
        if not line or line.startswith('#') or line.startswith(':'):
            continue
        parts = line.split()
        if parts[0].isdigit() and len(parts) == 1:
            cur = {}
            frames.append(cur)
            continue
        if cur is not None:
            cur[parts[0]] = [float(x) for x in parts[1:]]
    return frames


def fk(bones, frame):
    """3D end position of every bone (and 'root') for one AMC frame."""
    pos = {}
    root = bones['root']
    vals = frame['root']
    d = dict(zip(root.root_order, vals))
    C = euler(*root.axis)
    R = euler(d.get('RX', 0), d.get('RY', 0), d.get('RZ', 0))
    root_m = C @ R @ np.linalg.inv(C)
    pos['root'] = np.array([d.get('TX', 0), d.get('TY', 0), d.get('TZ', 0)])
    mats = {'root': root_m}

    def walk(b):
        for c in b.children:
            Cc = euler(*c.axis)
            v = frame.get(c.name, [])
            rx = ry = rz = 0.0
            for k, dof in enumerate(c.dof):
                if k < len(v):
                    if dof == 'rx': rx = v[k]
                    elif dof == 'ry': ry = v[k]
                    elif dof == 'rz': rz = v[k]
            m = mats[b.name] @ Cc @ euler(rx, ry, rz) @ np.linalg.inv(Cc)
            mats[c.name] = m
            pos[c.name] = pos[b.name] + c.length * (m @ c.direction)
            walk(c)

    walk(root)
    return pos


# the stick figure we draw: name -> CMU bone whose END is that joint
JOINTS = [
    ('pelvis', 'root'),
    ('chest', 'upperback'),
    ('neck', 'thorax'),
    ('head', 'upperneck'),      # base of the head; the emoji is centred above it
    ('lShoulder', 'lclavicle'), ('lElbow', 'lhumerus'), ('lWrist', 'lradius'),
    ('rShoulder', 'rclavicle'), ('rElbow', 'rhumerus'), ('rWrist', 'rradius'),
    ('lHip', 'lhipjoint'), ('lKnee', 'lfemur'), ('lAnkle', 'ltibia'), ('lToe', 'lfoot'),
    ('rHip', 'rhipjoint'), ('rKnee', 'rfemur'), ('rAnkle', 'rtibia'), ('rToe', 'rfoot'),
]
JOINT_NAMES = [j for j, _ in JOINTS]


def clip_joints(asf, amc, start=0, end=None, step=1):
    """(frames, joints, 3) array of the stick-figure joints."""
    bones = read_asf(asf)
    frames = read_amc(amc)
    frames = frames[start:end:step]
    out = np.zeros((len(frames), len(JOINTS), 3))
    for f, fr in enumerate(frames):
        p = fk(bones, fr)
        for j, (_, bone) in enumerate(JOINTS):
            out[f, j] = p[bone]
    return out
