"""
build_dances.py
---------------
Builds src/renderer/toys/EmojiFountain/dances/dances.json, the dance loops
the Emoji Fountain !dance command plays, from:

  - CMU Graphics Lab Motion Capture Database clips (mocap.cs.cmu.edu),
    "The data used in this project was obtained from mocap.cs.cmu.edu.
     The database was created with funding from NSF EIA-0196217."
    Their licence allows the data in commercially sold products, but not
    reselling the data itself, even converted. Download the ASF/AMC files
    listed in CMU_DANCES into --cmu <dir> (e.g. http://mocap.cs.cmu.edu/subjects/143/143_35.amc
    and .../143/143.asf).
  - our own hand-keyed dances (keyed_dances.py).

Usage:
  python scripts/dance/build_dances.py --cmu /tmp/cmu [--sheets <dir>]

Needs numpy (and Pillow for --sheets).
"""

import argparse
import json
import os
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import cmu            # noqa: E402
import keyed          # noqa: E402
import pipeline as pl  # noqa: E402
from keyed_dances import KEYED  # noqa: E402

OUT_DIR = os.path.join(HERE, '..', '..', 'src', 'renderer', 'toys', 'EmojiFountain', 'dances')
OUT = os.path.join(OUT_DIR, 'dances.json')          # the loops (loaded by the widget when needed)
OUT_META = os.path.join(OUT_DIR, 'danceMeta.json')  # names + lengths (small, for the toy / settings)

# extra words chat can use to ask for a dance by name ("!dance 😎 bboy")
ALIASES = {
    'moonwalk': ['mj'], 'cossack': ['russian', 'kazachok'], 'toprock': ['breakdance', 'bboy', 'breaking'],
    'hiphop': ['hip hop', 'bounce'], 'thriller': ['zombie'], 'gangnam': ['gangnam style', 'horse'],
    'disco': ['saturday night fever', 'point'], 'chicken': ['chicken dance'], 'runningman': ['running man'],
    'carlton': ['carlton dance'], 'sprinkler': [], 'robot': ['the robot'], 'twist': ['the twist'],
}

# id -> clip, search window (120 fps frames), loop length range (seconds), view
CMU_DANCES = [
    dict(id='macarena', name='Macarena', subject='143', clip='143_35', window=(30, 1160), secs=(4.3, 5.6), view=40),
    dict(id='twist', name='The Twist', subject='106', clip='106_12', window=(60, 520), secs=(1.4, 3.4), view=25),
    dict(id='charleston', name='Charleston', subject='93', clip='93_08', window=(40, 560), secs=(1.5, 4.0), view=25),
    dict(id='moonwalk', name='Moonwalk', subject='90', clip='90_32', window=(280, 760), secs=(1.4, 3.5), view=80, travel=True),
    dict(id='cossack', name='Cossack Kicks', subject='90', clip='90_30', window=(480, 1200), secs=(1.2, 3.5), view=30),
    dict(id='toprock', name='Breakdance Toprock', subject='85', clip='85_03', window=(580, 1520), secs=(1.5, 4.0), view=25),
]

CMU_FPS = 120
BLEND = 36  # frames (0.3 s) eased across the loop seam


def subject_scale(asf):
    """Scale that puts this skeleton's standing head base at pipeline.HEAD_Y."""
    bones = cmu.read_asf(asf)
    p = cmu.fk(bones, {'root': [0, 0, 0, 0, 0, 0]})
    P = np.array([p[b] for _, b in cmu.JOINTS])
    return pl.HEAD_Y / (P[pl.J['head'], 1] - P[:, 1].min())


def build_cmu(spec, cmu_dir):
    asf = os.path.join(cmu_dir, spec['subject'] + '.asf')
    amc = os.path.join(cmu_dir, spec['clip'] + '.amc')
    P = cmu.clip_joints(asf, amc) * subject_scale(asf)
    P = pl.ground(P)
    P, vel = pl.face_camera(P, CMU_FPS)
    lo, hi = spec['window']
    cost, s, e = pl.find_loop(P, lo, min(hi, len(P)), int(spec['secs'][0] * CMU_FPS), int(spec['secs'][1] * CMU_FPS), BLEND)
    L = pl.blend_loop(P, s, e, BLEND)
    L = pl.smooth_cyclic(L, 2.5)
    L = pl.resample_loop(L, CMU_FPS)
    info = f"{spec['id']}: frames {s}-{e} ({(e - s) / CMU_FPS:.2f}s) seam cost {cost:.2f}"
    meta = {'source': f"CMU {spec['clip']} frames {s}-{e}"}
    if spec.get('travel'):
        # keep the glide: units / second across the screen, seen from the view
        v = vel[s:e].mean(axis=0) * CMU_FPS
        a = np.deg2rad(spec['view'])
        meta['travel'] = round(float(v[0] * np.cos(a) + v[1] * np.sin(a)), 1)
        info += f" travel {meta['travel']}/s"
    return L, info, meta


def build_keyed(spec):
    L = keyed.render_dance(spec, pl.FPS)
    info = f"{spec['id']}: keyed, {spec['beats']} beats at {spec['bpm']} bpm ({spec['beats'] * 60 / spec['bpm']:.2f}s)"
    return L, info, {'source': 'hand-keyed'}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--cmu', default='/tmp/cmu')
    ap.add_argument('--sheets', default=None)
    ap.add_argument('--only', default=None)
    args = ap.parse_args()

    dances = {}
    order = []
    specs = [('cmu', d) for d in CMU_DANCES] + [('keyed', d) for d in KEYED]
    for kind, spec in specs:
        if args.only and spec['id'] not in args.only.split(','):
            continue
        L, info, meta = build_cmu(spec, args.cmu) if kind == 'cmu' else build_keyed(spec)
        xy, depth = pl.project(L, spec.get('view', 20))
        rec = pl.pack(xy, depth, {'name': spec['name'], **meta})
        dances[spec['id']] = rec
        order.append(spec['id'])
        print(info, f"-> {rec['frames']} frames")
        if args.sheets:
            import stick
            os.makedirs(args.sheets, exist_ok=True)
            step = max(1, len(xy) // 30)
            stick.render([xy[f] for f in range(0, len(xy), step)],
                         os.path.join(args.sheets, spec['id'] + '.png'),
                         labels=list(range(0, len(xy), step)), title=info)

    if args.only:
        return
    # settings / preview order: the most recognisable first
    first = ['floss', 'twerk', 'thriller', 'hiphop', 'dab', 'macarena', 'gangnam', 'ymca', 'moonwalk',
             'runningman', 'carlton', 'robot', 'sprinkler', 'disco', 'chicken', 'twist', 'charleston',
             'toprock', 'cossack']
    order = [i for i in first if i in dances] + [i for i in order if i not in first]
    doc = {
        'version': 1,
        'fps': pl.FPS,
        'scale': 10,
        'joints': cmu.JOINT_NAMES,
        'depth': pl.DEPTH_PARTS,
        'order': order,
        'dances': dances,
        'credits': 'Mocap dances: data obtained from mocap.cs.cmu.edu. The database was created with funding from NSF EIA-0196217. Hand-keyed dances: Chat Toys.',
    }
    os.makedirs(OUT_DIR, exist_ok=True)
    with open(OUT, 'w') as f:
        json.dump(doc, f, separators=(',', ':'))
    meta = {
        'order': order,
        'dances': {i: {'name': d['name'], 'duration': round(d['frames'] / pl.FPS, 4),
                       **({'aliases': ALIASES[i]} if ALIASES.get(i) else {})} for i, d in dances.items()},
    }
    with open(OUT_META, 'w') as f:
        json.dump(meta, f, indent='\t')
        f.write('\n')
    for p in (OUT, OUT_META):
        print('wrote', os.path.relpath(p), os.path.getsize(p), 'bytes')


if __name__ == '__main__':
    main()
