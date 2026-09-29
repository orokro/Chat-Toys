"""
keyed_dances.py
---------------
The hand-keyed dances (our own work; see keyed.py for the pose format).

Coordinates: height ~100, the dancer faces the viewer (+z), +x is the
dancer's LEFT. Hand targets are from that shoulder in the torso's frame; a
straight arm reaches ~29.
"""

import math


def mirror(pose):
    """The same pose with left and right swapped."""
    out = {}
    swap = lambda k: ('r' + k[1:]) if k.startswith('l') and k[1:2].isupper() else ('l' + k[1:]) if k.startswith('r') and k[1:2].isupper() else k
    for k, v in pose.items():
        nk = swap(k)
        if k in ('root', 'lHand', 'rHand', 'lElbow', 'rElbow', 'lFoot', 'rFoot', 'lKnee', 'rKnee'):
            out[nk] = (-v[0], v[1], v[2])
        elif k in ('lFootYaw', 'rFootYaw', 'hipYaw', 'hipRoll'):
            out[nk] = -v
        elif k in ('torso', 'head'):
            out[nk] = (v[0], -v[1], -v[2])
        elif k in ('lHandAt', 'rHandAt'):
            joint, off = v
            out[nk] = (swap(joint), (-off[0], off[1], off[2]))
        else:
            out[nk] = v
    return out


def m(pose, **kw):
    return {**pose, **kw}


# ---------------------------------------------------------------------------
# Floss: both arms swing side to side, the crossing arm in front of the body
# and the other one behind; the hips swing the other way.
# ---------------------------------------------------------------------------
_floss_r = {
    'lHand': (-24, -27, 11), 'rHand': (-5, -26, -9),
    'lElbow': (0, 0, -1), 'rElbow': (0, 0, -1),
    'root': (7, 0, 0), 'hipRoll': 10, 'hipYaw': 10,
    'torso': (0, -8, -3), 'head': (0, 6, 4),
}
FLOSS = dict(id='floss', name='Floss', bpm=126, beats=2, view=22, bounce=1.5, ease='smooth',
             keys=[(0, _floss_r), (1, mirror(_floss_r))])


# ---------------------------------------------------------------------------
# Thriller: zombie claws raised to one side, shoulders jerking on every beat,
# shuffling sideways; then the other way.
# ---------------------------------------------------------------------------
def _thriller():
    keys = []
    xs = [0, 5, 10, 15, 15, 10, 5, 0]
    for b in range(8):
        side = 1 if b < 4 else -1          # claws to the dancer's left, then right
        x = xs[b]
        wide = b % 2 == 0                   # lead foot out / trailing foot closes
        shrug = 3 if b % 2 else 0
        lead, trail = (x + 11 * side + (5 * side if wide else 0), x - 6 * side)
        p = {
            'lHand': (21, 8 + shrug, 11), 'rHand': (31, 9 + shrug, 13),
            'lElbow': (0.2, -1, -0.2), 'rElbow': (0, -1, -0.3),
            'torso': (10 + shrug, 14, -7 - shrug), 'head': (12, 10, -16),
            'root': (x + 2 * side, -4, 0), 'hipRoll': -4,
            'lFoot': (lead, 2, 2), 'rFoot': (trail, 2, -1),
            'lKnee': (0.3, 0, 1), 'rKnee': (-0.2, 0, 1),
        }
        if side < 0:
            p = mirror(p)
            p['root'] = (x - 2, -4, 0)
            p['rFoot'] = (x - 11 - (5 if wide else 0), 2, 2)
            p['lFoot'] = (x + 6, 2, -1)
        keys.append((b, p))
    return keys


THRILLER = dict(id='thriller', name='Thriller', bpm=118, beats=8, view=20, bounce=2.5, keys=_thriller())


# ---------------------------------------------------------------------------
# Twerk: wide squat, hands on knees, leaning forward, hips popping back.
# ---------------------------------------------------------------------------
def _twerk():
    base = {
        'lFoot': (16, 2, 0), 'rFoot': (-16, 2, 0), 'lFootYaw': 30, 'rFootYaw': -30,
        'lKnee': (0.7, 0, 1), 'rKnee': (-0.7, 0, 1),
        'lHandAt': ('lKnee', (-1, 4, 3)), 'rHandAt': ('rKnee', (1, 4, 3)),
        'lElbow': (1, 0, 0), 'rElbow': (-1, 0, 0),
        'head': (-50, 0, 0),
    }
    keys = []
    for q in range(8):
        up = q % 2 == 0
        sway = 3 if (q // 2) % 2 == 0 else -3
        keys.append((q * 0.25, m(base,
                                root=(sway * 0.5, -12 if up else -16, -11 if up else -5),
                                torso=(66 if up else 76, 0, 0),
                                hipRoll=sway)))
    return keys


TWERK = dict(id='twerk', name='Twerk', bpm=100, beats=2, view=85, ease='smooth', keys=_twerk())


# ---------------------------------------------------------------------------
# Hip-hop bounce: step-touch side to side, knees bouncing, fists swinging.
# ---------------------------------------------------------------------------
_hh_step = {
    'rFoot': (-17, 2, 0), 'lFoot': (-3, 5, -2), 'root': (-9, 0, 0),
    'torso': (8, -14, 6), 'head': (4, -10, 4),
    'lHand': (-8, -9, 17), 'rHand': (-5, -19, -11),
    'lElbow': (0.3, -1, -0.4), 'rElbow': (-0.3, -1, -0.2),
    'hipRoll': -5,
}
_hh_touch = m(_hh_step, lFoot=(-3, 2, -1), torso=(4, -6, 2),
              lHand=(2, -14, 12), rHand=(-3, -17, 2), hipRoll=0)
HIPHOP = dict(id='hiphop', name='Hip-Hop Bounce', bpm=96, beats=4, view=20, bounce=4, nod=10,
              keys=[(0, _hh_step), (1, _hh_touch), (2, mirror(_hh_step)), (3, mirror(_hh_touch))])


# ---------------------------------------------------------------------------
# Dab: face buried in one elbow, the other arm straight up and out.
# ---------------------------------------------------------------------------
_dab_rest = {'root': (0, -3, 0), 'lHand': (4, -24, 8), 'rHand': (-4, -24, 8),
             'lElbow': (0.4, -0.5, -1), 'rElbow': (-0.4, -0.5, -1), 'ease': 'snap'}
_dab = {
    'lHand': (25, 15, 4), 'rHand': (19, 16, 9),
    'lElbow': (0, 0, -1), 'rElbow': (0, -0.2, 1),
    'head': (38, 10, 12), 'torso': (14, -8, 8), 'root': (-2, -4, 0),
    'rFoot': (-10, 2, 1), 'ease': 'smooth',
}
DAB = dict(id='dab', name='Dab', bpm=100, beats=4, view=18, bounce=1.5,
           keys=[(0, _dab_rest), (1, _dab), (2, _dab_rest), (3, mirror(_dab))])


# ---------------------------------------------------------------------------
# Carlton: arms swinging side to side across the body, hips the other way,
# then a big arc over the head.
# ---------------------------------------------------------------------------
_carl_l = {  # arms swung to the dancer's left
    'lHand': (12, -20, 9), 'rHand': (26, -15, 11),
    'lElbow': (0.3, -1, -0.5), 'rElbow': (0, -1, -0.5),
    'root': (-4, 0, 0), 'hipRoll': -6, 'torso': (2, 10, 4), 'head': (0, 8, -6),
    'lFoot': (9, 2, 0), 'rFoot': (-9, 4, 0),
}
_carl_up_l = m(_carl_l, lHand=(18, 22, 6), rHand=(22, 20, 8), torso=(-6, 10, -8), root=(-4, -2, 0),
               lElbow=(0.3, -1, 0), rElbow=(0, -1, 0.3))
CARLTON = dict(id='carlton', name='Carlton', bpm=116, beats=8, view=20, bounce=2,
               keys=[(0, _carl_l), (1, mirror(_carl_l)), (2, _carl_l), (3, mirror(_carl_l)),
                     (4, _carl_up_l), (5, mirror(_carl_up_l)), (6, _carl_l), (7, mirror(_carl_l))])


# ---------------------------------------------------------------------------
# Running man: one knee up while the planted foot slides back, then swap.
# ---------------------------------------------------------------------------
_rm_up = {
    'lFoot': (7, 21, 11), 'rFoot': (-7, 2, -9), 'lFootYaw': 0, 'rFootYaw': 0,
    'root': (0, -4, 0), 'torso': (8, 0, 0),
    'rHand': (-1, -9, 15), 'lHand': (1, -17, -11),
    'rElbow': (0, -1, -0.5), 'lElbow': (0, -1, -0.3),
}
_rm_down = m(_rm_up, lFoot=(7, 2, 8), rFoot=(-7, 2, -5), root=(0, -8, 0),
             rHand=(-1, -21, 5), lHand=(1, -21, 3))
RUNNINGMAN = dict(id='runningman', name='Running Man', bpm=120, beats=2, view=55,
                  keys=[(0, _rm_up), (0.5, _rm_down), (1, mirror(_rm_up)), (1.5, mirror(_rm_down))])


# ---------------------------------------------------------------------------
# YMCA
# ---------------------------------------------------------------------------
_Y = {'lHand': (14, 25, 2), 'rHand': (-14, 25, 2), 'head': (-10, 0, 0), 'ease': 'snap'}
_M = {'lHandAt': ('head', (5, 16, 0)), 'rHandAt': ('head', (-5, 16, 0)),
      'lElbow': (1, 0.3, 0), 'rElbow': (-1, 0.3, 0), 'ease': 'snap'}
_C = {'lHand': (-17, 24, 6), 'rHand': (-27, 3, 7), 'lElbow': (0.2, 1, 0), 'rElbow': (0, -0.5, 1),
      'torso': (0, -6, 12), 'root': (3, 0, 0), 'head': (0, -10, 8), 'ease': 'snap'}
_A = {'lHand': (-8, 27, 4), 'rHand': (8, 27, 4), 'lElbow': (1, 0, 0), 'rElbow': (-1, 0, 0), 'ease': 'snap'}
YMCA = dict(id='ymca', name='YMCA', bpm=128, beats=8, view=15, bounce=3,
            keys=[(0, _Y), (2, _M), (4, _C), (6, _A)])


# ---------------------------------------------------------------------------
# Gangnam Style: the horse-riding gallop with crossed wrists, then the lasso.
# ---------------------------------------------------------------------------
def _gangnam():
    keys = []
    reins_l, reins_r = (-13, -12, 17), (13, -14, 16)
    for q in range(32):                       # quarter beats over 8 beats
        t = q / 4
        beat = int(t)
        lift = q % 2 == 1
        right = beat % 4 < 2                  # which foot does the double hop
        rf = (-13, 9 if (lift and right) else 2, 3 if (lift and right) else 0)
        lf = (13, 9 if (lift and not right) else 2, 3 if (lift and not right) else 0)
        p = {
            'root': (0, -9 - (2 if lift else 0), 0), 'lFoot': lf, 'rFoot': rf,
            'lKnee': (0.5, 0, 1), 'rKnee': (-0.5, 0, 1),
            'lHand': reins_l, 'rHand': reins_r,
            'lElbow': (0.5, -1, 0), 'rElbow': (-0.5, -1, 0),
            'torso': (6, 0, 0), 'head': (4, 0, 0),
        }
        if 4.5 <= t <= 7.25:  # lasso: the right hand circles above the head
            a = 2 * math.pi * (t - 4.5)
            p['rHand'] = (-5 + 8 * math.cos(a), 26, 4 + 8 * math.sin(a))
            p['rElbow'] = (-1, 0, 0)
            p['lHand'] = (-8, -12, 17)
        keys.append((t, p))
    return keys


GANGNAM = dict(id='gangnam', name='Gangnam Style', bpm=132, beats=8, view=18, keys=_gangnam())


# ---------------------------------------------------------------------------
# Sprinkler: hand behind the head, the other arm out front ticking across,
# then sweeping back.
# ---------------------------------------------------------------------------
def _sprinkler():
    keys = []
    yaws = [-35, -21, -7, 7, 21, 35]
    for i, yw in enumerate(yaws):
        keys.append((i * 0.5, {
            'torso': (4, yw, 0), 'hipYaw': yw * 0.4, 'head': (0, yw * 0.3, 0),
            'lHandAt': ('head', (-2, 7, -7)), 'lElbow': (1, 0.7, 0),
            'rHand': (-3, -1, 29), 'root': (0, -4 - (1.5 if i % 2 else 0), 0),
            'ease': 'snap',
        }))
    keys.append((3, m(keys[-1][1], ease='smooth')))
    return keys


SPRINKLER = dict(id='sprinkler', name='Sprinkler', bpm=110, beats=4, view=55, keys=_sprinkler())


# ---------------------------------------------------------------------------
# Robot: stiff snaps between held poses.
# ---------------------------------------------------------------------------
_r_fwd = {'lHand': (0, -16.5, 13), 'rHand': (0, -16.5, 13), 'lElbow': (0, -1, -0.2), 'rElbow': (0, -1, -0.2),
          'ease': 'snap'}
_r_rup = m(_r_fwd, rHand=(-16.5, 13, 0), rElbow=(-1, -1, 0))
_r_head = m(_r_rup, head=(0, 45, 0))
_r_both = m(_r_rup, lHand=(16.5, 13, 0), lElbow=(1, -1, 0))
_r_turn = m(_r_both, torso=(0, -30, 0), hipYaw=-10, root=(0, -3, 0))
_r_down = m(_r_fwd, rHand=(-16.5, -13, 0), rElbow=(-1, 1, 0), lHand=(16.5, 13, 0), lElbow=(1, -1, 0),
            torso=(0, 30, 0), hipYaw=10, root=(0, -3, 0))
_r_look = m(_r_fwd, head=(-10, -40, 0))
ROBOT = dict(id='robot', name='Robot', bpm=100, beats=8, view=20,
             keys=[(0, _r_fwd), (1, _r_rup), (2, _r_head), (3, _r_both), (4, _r_turn),
                   (5, _r_down), (6, _r_look), (7, m(_r_fwd, root=(0, -2, 0)))])


# ---------------------------------------------------------------------------
# Disco point: point up across one side, then down across the body.
# ---------------------------------------------------------------------------
_d_up = {
    'rHand': (-18, 22, 7), 'lHandAt': ('lHip', (3, 5, 2)), 'lElbow': (1, 0, -0.5),
    'root': (4, 0, 0), 'hipRoll': 7, 'torso': (0, -10, -6), 'head': (-12, -25, 0),
    'rFoot': (-11, 2, 2), 'lFoot': (8, 2, 0), 'ease': 'snap',
}
_d_down = m(_d_up, rHand=(22, -23, 13), root=(-3, -3, 0), hipRoll=-7, torso=(8, 12, 5), head=(18, 18, 0))
DISCO = dict(id='disco', name='Disco Point', bpm=104, beats=8, view=20, bounce=2,
             keys=[(0, _d_up), (1, _d_down), (2, _d_up), (3, _d_down),
                   (4, mirror(_d_up)), (5, mirror(_d_down)), (6, mirror(_d_up)), (7, mirror(_d_down))])


# ---------------------------------------------------------------------------
# Chicken dance: beaks, wings, tail feathers, claps.
# ---------------------------------------------------------------------------
def _chicken():
    keys = []
    for q in range(4):  # beaks: hands out front snapping
        keys.append((q * 0.5, {'lHand': (-4, -2 + (3 if q % 2 else 0), 26), 'rHand': (4, -2 + (3 if q % 2 else 0), 26),
                               'lElbow': (0, -1, 0), 'rElbow': (0, -1, 0), 'ease': 'snap'}))
    for q in range(4):  # wings: flap the elbows
        out = q % 2 == 0
        keys.append((2 + q * 0.5, {'lHandAt': ('lShoulder', (1, -5, 5)), 'rHandAt': ('rShoulder', (-1, -5, 5)),
                                   'lElbow': (1, 0.2 if out else -1, 0), 'rElbow': (-1, 0.2 if out else -1, 0),
                                   'ease': 'snap'}))
    for q in range(4):  # tail feathers: wiggle down
        s = 1 if q % 2 == 0 else -1
        keys.append((4 + q * 0.5, {'lHandAt': ('lShoulder', (1, -5, 5)), 'rHandAt': ('rShoulder', (-1, -5, 5)),
                                   'lElbow': (1, -0.5, 0), 'rElbow': (-1, -0.5, 0),
                                   'root': (2 * s, -4 - 3 * q, -3), 'hipRoll': 9 * s, 'torso': (14, 0, 0),
                                   'lKnee': (0.6, 0, 1), 'rKnee': (-0.6, 0, 1)}))
    for q in range(4):  # claps
        together = q % 2 == 0
        keys.append((6 + q * 0.5, {'lHand': (-8 if together else -2, -14, 20), 'rHand': (8 if together else 2, -14, 20),
                                   'lElbow': (0.5, -1, 0), 'rElbow': (-0.5, -1, 0), 'ease': 'snap'}))
    return keys


CHICKEN = dict(id='chicken', name='Chicken Dance', bpm=120, beats=8, view=45, keys=_chicken())


KEYED = [FLOSS, THRILLER, TWERK, HIPHOP, DAB, CARLTON, RUNNINGMAN, YMCA, GANGNAM, SPRINKLER, ROBOT, DISCO, CHICKEN]
