"""
keyed.py
--------
A tiny 3D rig for hand-keyed dances (the ones no permissively licensed
mocap exists for: floss, Thriller, twerk, ...). These are our own work.

A dance is a list of keyed poses on a beat grid. A pose only lists what
differs from the neutral standing pose:

    root      (x, y, z)    pelvis offset (y < 0 = knees bend)
    hipYaw    deg          hips turn (+ = toward the dancer's left)
    hipRoll   deg          hips tilt (+ = left hip up)
    torso     (pitch, yaw, roll) deg   pitch + = lean toward the viewer,
                                       roll + = lean to the dancer's right
    head      (pitch, yaw, roll) deg   on top of the torso (pitch + = nod down)
    lHand / rHand          wrist target from that shoulder, in the torso's frame
    lHandAt / rHandAt      (joint, (dx, dy, dz)) wrist target on another joint
                           (after the rest of the body is posed), world frame
    lElbow / rElbow        which way the elbow points (torso frame)
    lFoot / rFoot          ankle position on the floor (world frame)
    lKnee / rKnee          which way the knee points (world frame)
    ease      'cr' (default, smooth through the keys) | 'smooth' | 'snap' | 'linear' | 'hold'
              how the move from THIS key to the next one plays

Space: y up, the dancer faces +z, their left is +x, floor y = 0, the base of
the head of the neutral pose is at y = 86 (same as the mocap after scaling).
"""

import numpy as np

from cmu import JOINT_NAMES

J = {n: i for i, n in enumerate(JOINT_NAMES)}

# bone lengths / offsets (close to the CMU skeletons after scaling)
PELVIS_Y = 53.0
HIP = np.array([6.0, -5.0, 1.5])
THIGH, SHIN = 23.0, 23.5
SPINE_LO = np.array([0.0, 14.0, -1.0])
SPINE_HI = np.array([0.0, 7.0, 0.0])
NECK = np.array([0.0, 11.0, 0.5])
SHOULDER = np.array([10.0, 4.0, -1.0])
UPPER_ARM, FOREARM = 16.5, 13.0
TOE = np.array([0.0, -2.0, 7.0])

NEUTRAL = {
    'root': (0, 0, 0),
    'hipYaw': 0, 'hipRoll': 0,
    'torso': (0, 0, 0),
    'head': (0, 0, 0),
    'lHand': (2, -29, 1), 'rHand': (-2, -29, 1),
    'lElbow': (0.4, 0, -1), 'rElbow': (-0.4, 0, -1),
    'lFoot': (8, 2, 1), 'rFoot': (-8, 2, 1),
    'lFootYaw': 10, 'rFootYaw': -10,
    'lKnee': (0.25, 0, 1), 'rKnee': (-0.25, 0, 1),
}
VEC_KEYS = ['root', 'torso', 'head', 'lHand', 'rHand', 'lElbow', 'rElbow',
            'lFoot', 'rFoot', 'lKnee', 'rKnee']
NUM_KEYS = ['hipYaw', 'hipRoll', 'lFootYaw', 'rFootYaw']


def _rx(d):
    r = np.deg2rad(d); c, s = np.cos(r), np.sin(r)
    return np.array([[1, 0, 0], [0, c, -s], [0, s, c]])


def _ry(d):
    r = np.deg2rad(d); c, s = np.cos(r), np.sin(r)
    return np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]])


def _rz(d):
    r = np.deg2rad(d); c, s = np.cos(r), np.sin(r)
    return np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]])


def _rot(pyr):
    """(pitch, yaw, roll) degrees -> matrix. Roll + leans to the dancer's right (-x)."""
    p, y, r = pyr
    return _ry(y) @ _rx(p) @ _rz(r)


def ik2(a, t, l1, l2, pole):
    """Two-bone IK: middle joint and end joint for root a reaching for t."""
    d = t - a
    dist = np.linalg.norm(d)
    if dist < 1e-6:
        d, dist = np.array([0, -1.0, 0]), 1e-6
    dn = d / dist
    dist = np.clip(dist, abs(l1 - l2) + 1e-3, l1 + l2 - 1e-4)
    x = (l1 * l1 - l2 * l2 + dist * dist) / (2 * dist)
    h = np.sqrt(max(l1 * l1 - x * x, 0.0))
    p = np.asarray(pole, float) - np.dot(pole, dn) * dn
    if np.linalg.norm(p) < 1e-6:
        p = np.cross(dn, [1.0, 0, 0])
        if np.linalg.norm(p) < 1e-6:
            p = np.cross(dn, [0, 0, 1.0])
    p /= np.linalg.norm(p)
    mid = a + dn * x + p * h
    end = a + dn * dist
    return mid, end


def _body(pose):
    """Everything but the arms. Returns (joints dict, torso matrix)."""
    out = {}
    root = np.array([0, PELVIS_Y, 0]) + np.asarray(pose['root'], float)
    out['pelvis'] = root
    H = _ry(pose['hipYaw']) @ _rz(pose['hipRoll'])
    out['lHip'] = root + H @ HIP
    out['rHip'] = root + H @ (HIP * [-1, 1, 1])
    tp = np.asarray(pose['torso'], float)
    Tlo = _rot(tp * 0.65)
    T = _rot(tp)
    out['chest'] = root + Tlo @ SPINE_LO
    out['neck'] = out['chest'] + T @ SPINE_HI
    out['head'] = out['neck'] + T @ _rot(pose['head']) @ NECK
    out['lShoulder'] = out['neck'] + T @ SHOULDER
    out['rShoulder'] = out['neck'] + T @ (SHOULDER * [-1, 1, 1])
    for side in 'lr':
        foot = np.asarray(pose[side + 'Foot'], float)
        knee_dir = np.asarray(pose[side + 'Knee'], float)
        knee, ankle = ik2(out[side + 'Hip'], foot, THIGH, SHIN, knee_dir)
        out[side + 'Knee'] = knee
        out[side + 'Ankle'] = ankle
        out[side + 'Toe'] = ankle + _ry(pose[side + 'FootYaw']) @ TOE
    return out, T


def _arms(out, T, pose):
    for side in 'lr':
        sh = out[side + 'Shoulder']
        tgt = sh + T @ np.asarray(pose[side + 'Hand'], float)
        elbow, wrist = ik2(sh, tgt, UPPER_ARM, FOREARM, T @ np.asarray(pose[side + 'Elbow'], float))
        out[side + 'Elbow'] = elbow
        out[side + 'Wrist'] = wrist
    return out


def _resolve(key):
    """A key's full pose, with *HandAt attachments turned into torso-frame hand targets."""
    pose = {**NEUTRAL, **{k: v for k, v in key.items() if k in NEUTRAL}}
    body, T = _body(pose)
    for side in 'lr':
        at = key.get(side + 'HandAt')
        if at:
            joint, off = at
            target = body[joint] + np.asarray(off, float)
            pose[side + 'Hand'] = tuple(T.T @ (target - body[side + 'Shoulder']))
    return pose


def _vec(pose):
    v = []
    for k in VEC_KEYS:
        v.extend(pose[k])
    for k in NUM_KEYS:
        v.append(pose[k])
    return np.array(v, float)


def _unvec(v):
    pose, i = {}, 0
    for k in VEC_KEYS:
        pose[k] = tuple(v[i:i + 3]); i += 3
    for k in NUM_KEYS:
        pose[k] = v[i]; i += 1
    return pose


def _ease(kind, u):
    if kind == 'linear':
        return u
    if kind == 'snap':
        x = min(u / 0.3, 1.0)
        return 1 - (1 - x) ** 3
    if kind == 'hold':
        return 0.0 if u < 0.85 else (u - 0.85) / 0.15
    return 0.5 - 0.5 * np.cos(np.pi * u)   # smooth


def _prepared(dance):
    if '_prep' not in dance:
        keys = sorted(dance['keys'], key=lambda k: k[0])
        P = dance['beats']
        times = [k[0] for k in keys]
        vecs = [_vec(_resolve(k[1])) for k in keys]
        eases = [k[1].get('ease', dance.get('ease', 'cr')) for k in keys]
        n = len(keys)
        # wrap one key before and two after, so every segment has neighbours
        tx = [times[-1] - P] + times + [times[0] + P, times[1 % n] + P * (1 if n > 1 else 2)]
        vx = [vecs[-1]] + vecs + [vecs[0], vecs[1 % n]]
        dance['_prep'] = (times, eases, tx, vx)
    return dance['_prep']


def pose_at(dance, beat):
    """Full pose at a beat (cyclic)."""
    times, eases, tx, vx = _prepared(dance)
    period = dance['beats']
    b = beat % period
    if b < times[0]:
        b += period
    i = max(k for k in range(len(times)) if times[k] <= b)
    # extended indices: segment from e=i+1 to e+1
    e = i + 1
    t0, t1 = tx[e], tx[e + 1]
    seg = t1 - t0
    u = (b - t0) / seg
    kind = eases[i]
    if kind == 'cr':
        m0 = (vx[e + 1] - vx[e - 1]) / (tx[e + 1] - tx[e - 1]) * seg
        m1 = (vx[e + 2] - vx[e]) / (tx[e + 2] - tx[e]) * seg
        u2, u3 = u * u, u * u * u
        v = ((2 * u3 - 3 * u2 + 1) * vx[e] + (u3 - 2 * u2 + u) * m0 +
             (-2 * u3 + 3 * u2) * vx[e + 1] + (u3 - u2) * m1)
    else:
        w = _ease(kind, u)
        v = (1 - w) * vx[e] + w * vx[e + 1]
    pose = _unvec(v)
    # beat-driven extras
    bounce = dance.get('bounce', 0)
    if bounce:
        per = dance.get('bouncePer', 1)          # bounces per beat
        dip = 0.5 + 0.5 * np.cos(2 * np.pi * b * per)
        r = pose['root']
        pose['root'] = (r[0], r[1] - bounce * dip, r[2])
    nod = dance.get('nod', 0)
    if nod:
        hd = pose['head']
        pose['head'] = (hd[0] + nod * (0.5 + 0.5 * np.cos(2 * np.pi * b)), hd[1], hd[2])
    return pose


def joints(pose):
    out, T = _body(pose)
    out = _arms(out, T, pose)
    return np.array([out[n] for n in JOINT_NAMES])


def render_dance(dance, fps):
    """(frames, joints, 3) for one cycle of a keyed dance at fps."""
    spb = 60.0 / dance['bpm']
    dur = dance['beats'] * spb
    n = max(4, int(round(dur * fps)))
    return np.array([joints(pose_at(dance, (f / n) * dance['beats'])) for f in range(n)])
