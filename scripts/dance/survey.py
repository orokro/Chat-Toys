"""survey.py <asf> <amc> <out.png> [every] : contact sheet of a clip, for picking loop ranges."""
import sys
import numpy as np
import cmu, stick

asf, amc, out = sys.argv[1:4]
every = int(sys.argv[4]) if len(sys.argv) > 4 else 30
P = cmu.clip_joints(asf, amc)
# face the camera frame by frame (dancers turn), using a ~1 s window
Q = P.copy()
for f in range(len(P)):
    a, b = max(0, f - 60), min(len(P), f + 60)
    Q[f] = stick.rotate_y(P[f:f+1] - P[f, 0], stick.facing_yaw(P[a:b]))[0] + P[f, 0] * [0, 1, 0]
P = Q
floor = P[:, [stick.J['lToe'], stick.J['rToe'], stick.J['lAnkle'], stick.J['rAnkle']], 1].min()
h = np.median(P[:, stick.J['head'], 1] - floor)
F = []
for f in range(0, len(P), every):
    x0 = P[f, stick.J['pelvis'], 0]
    F.append(np.stack([(P[f, :, 0] - x0) / h * 100, (P[f, :, 1] - floor) / h * 100], axis=1))
stick.render(F, out, labels=list(range(0, len(P), every)), title=f'{amc} frames={len(P)} ({len(P)/120:.1f}s) every {every}')
print(out, len(P))
