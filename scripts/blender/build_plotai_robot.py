"""
Modela y anima el robot PlotAI del tótem y lo exporta a public/models/plotai-robot.glb.

Uso:
  blender -b --factory-startup --python scripts/blender/build_plotai_robot.py -- [--out ruta.glb] [--preview ruta.png]

El frente del robot mira hacia -Y en Blender (queda +Z en glTF). Clips exportados:
idle, greeting, listening, thinking, speaking, presenting.
"""
import math
import os
import sys
import bpy

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
def arg(name, default):
    return argv[argv.index(name) + 1] if name in argv else default

OUT = arg('--out', 'public/models/plotai-robot.glb')
LOGO = arg('--logo', 'scripts/blender/assets/chest-logo.png')
PREVIEW = arg('--preview', '')
FPS = 30

# ---------------------------------------------------------------- utilidades
def lin(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

def hexcol(h):
    h = h.lstrip('#')
    return tuple(lin(int(h[i:i + 2], 16) / 255) for i in (0, 2, 4))

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.fps = FPS
col = bpy.data.collections.new('PlotAI')
scene.collection.children.link(col)

def material(name, color, metallic=0.0, rough=0.4, emit=None, strength=0.0, coat=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*hexcol(color), 1)
    b.inputs['Metallic'].default_value = metallic
    b.inputs['Roughness'].default_value = rough
    if coat:
        b.inputs['Coat Weight'].default_value = coat
        b.inputs['Coat Roughness'].default_value = 0.08
    if emit:
        b.inputs['Emission Color'].default_value = (*hexcol(emit), 1)
        b.inputs['Emission Strength'].default_value = strength
    return m

M_PEARL = material('Pearl', '#eceff8', 0.05, 0.28, coat=0.6)
M_ORANGE = material('Orange', '#eb671b', 0.1, 0.32, coat=0.4)
M_GRAPH = material('Graphite', '#1c2033', 0.55, 0.35)
M_VISOR = material('Visor', '#04050c', 0.7, 0.06, coat=1.0)
M_EYE = material('Emit_Eye', '#38bdf8', 0.0, 0.3, emit='#38bdf8', strength=4.0)
M_BLUSH = material('Emit_Blush', '#ff5e5e', 0.0, 0.4, emit='#ff6b6b', strength=1.2)
M_ACC = material('Emit_Accent', '#eb671b', 0.0, 0.3, emit='#ff7a2e', strength=3.0)

def logo_material(path):
    m = bpy.data.materials.new('Logo')
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes['Principled BSDF']
    tex = nt.nodes.new('ShaderNodeTexImage')
    tex.image = bpy.data.images.load(os.path.abspath(path))
    tex.image.colorspace_settings.name = 'sRGB'
    nt.links.new(tex.outputs['Color'], b.inputs['Base Color'])
    nt.links.new(tex.outputs['Color'], b.inputs['Emission Color'])
    b.inputs['Emission Strength'].default_value = 0.45
    b.inputs['Roughness'].default_value = 0.3
    b.inputs['Metallic'].default_value = 0.0
    return m

M_LOGO = logo_material(LOGO)

def link(o, parent=None):
    col.objects.link(o)
    if parent is not None:
        o.parent = parent
    return o

def empty(name, loc=(0, 0, 0), parent=None):
    o = bpy.data.objects.new(name, None)
    o.location = loc
    o.rotation_mode = 'XYZ'
    return link(o, parent)

def smooth(o):
    try:
        o.data.shade_smooth()
    except Exception:
        for p in o.data.polygons:
            p.use_smooth = True

def shape(name, kind, loc, scale, mat, parent, rot=(0, 0, 0), **kw):
    if kind == 'sphere':
        bpy.ops.mesh.primitive_uv_sphere_add(segments=kw.get('seg', 40), ring_count=kw.get('seg', 40) // 2, radius=1)
    elif kind == 'cyl':
        bpy.ops.mesh.primitive_cylinder_add(vertices=kw.get('verts', 32), radius=kw['r'], depth=kw['d'])
    elif kind == 'torus':
        bpy.ops.mesh.primitive_torus_add(major_segments=kw.get('seg', 56), minor_segments=14, major_radius=kw['R'], minor_radius=kw['r'])
    elif kind == 'cube':
        bpy.ops.mesh.primitive_cube_add(size=1)
    elif kind == 'circle':
        bpy.ops.mesh.primitive_circle_add(vertices=64, radius=kw['r'], fill_type='NGON', calc_uvs=True)
    o = bpy.context.active_object
    bpy.context.collection.objects.unlink(o)
    o.name = name
    o.data.name = name
    o.data.materials.append(mat)
    smooth(o) if kind != 'cube' else None
    o.location = loc
    o.scale = scale
    o.rotation_mode = 'XYZ'
    o.rotation_euler = rot
    return link(o, parent)

D = math.radians
# ---------------------------------------------------------------- jerarquía
root = empty('PlotAI')
hover = empty('Hover', parent=root)

torso = shape('Torso', 'sphere', (0, 0, 0), (0.50, 0.46, 0.58), M_PEARL, hover)
shape('Belt', 'torus', (0, 0, -0.18), (1, 0.92, 1), M_ORANGE, hover, R=0.49, r=0.022)
# chapa del pecho con el logo de la app (cubo PC)
shape('BadgeBack', 'cyl', (0, -0.446, 0.05), (1, 1, 1), M_GRAPH, hover, rot=(D(90), 0, 0), r=0.205, d=0.02, verts=48)
shape('BadgeRing', 'torus', (0, -0.452, 0.05), (1, 1, 1), M_ORANGE, hover, rot=(D(90), 0, 0), R=0.195, r=0.013, seg=64)
shape('ChestLogo', 'circle', (0, -0.459, 0.05), (1, 1, 1), M_LOGO, hover, rot=(D(90), 0, 0), r=0.185)
shape('NeckRing', 'torus', (0, 0, 0.6), (1, 1, 1), M_GRAPH, hover, R=0.27, r=0.04)

# pod y aro de vuelo: quedan fijos al root, el cuerpo flota sobre ellos
shape('Pod', 'sphere', (0, 0, -0.74), (0.26, 0.26, 0.13), M_GRAPH, root)
shape('Ring', 'torus', (0, 0, -0.66), (1, 1, 1), M_ACC, root, R=0.36, r=0.024)
shape('RingOuter', 'torus', (0, 0, -0.66), (1, 1, 1), M_ORANGE, root, R=0.44, r=0.012)

head = empty('Head', (0, 0, 0.62), hover)
shape('HeadShell', 'sphere', (0, 0, 0.30), (0.62, 0.52, 0.46), M_PEARL, head)
shape('Visor', 'sphere', (0, -0.30, 0.30), (0.52, 0.30, 0.34), M_VISOR, head)
eyes = {}
for side, sx in (('L', 1), ('R', -1)):
    eyes[side] = shape('Eye' + side, 'sphere', (sx * 0.19, -0.575, 0.34), (0.075, 0.03, 0.10), M_EYE, head, seg=20)
    shape('Ear' + side, 'cyl', (sx * 0.62, 0, 0.30), (1, 1, 1), M_GRAPH, head, rot=(0, D(90), 0), r=0.15, d=0.07)
    shape('EarGlow' + side, 'cyl', (sx * 0.635, 0, 0.30), (1, 1, 1), M_ACC, head, rot=(0, D(90), 0), r=0.085, d=0.06)
mouth = []
for i, (x, z) in enumerate(((-0.11, 0.205), (-0.055, 0.178), (0.0, 0.165), (0.055, 0.178), (0.11, 0.205))):
    mouth.append(shape('Mouth%d' % (i + 1), 'cube', (x, -0.578, z), (0.02, 0.012, 0.022), M_EYE, head))
for side, sx in (('L', 1), ('R', -1)):
    shape('Brow' + side, 'cyl', (sx * 0.19, -0.518, 0.505), (1, 1, 1), M_EYE, head, rot=(0, D(90), 0), r=0.011, d=0.12, verts=12)
    shape('Cheek' + side, 'sphere', (sx * 0.31, -0.508, 0.16), (0.065, 0.014, 0.032), M_BLUSH, head, rot=(0, 0, sx * D(-14)), seg=20)
    shape('Lid' + side, 'sphere', (sx * 0.19, -0.585, 0.17), (0.095, 0.03, 0.085), M_VISOR, head, seg=20)

ants = {}
for side, sx in (('L', 1), ('R', -1)):
    piv = empty('Ant' + side, (sx * 0.24, 0.0, 0.70), head)
    piv.rotation_euler = (0, sx * D(14), 0)
    shape('AntStalk' + side, 'cyl', (0, 0, 0.16), (1, 1, 1), M_GRAPH, piv, r=0.012, d=0.32, verts=12)
    shape('AntBall' + side, 'sphere', (0, 0, 0.34), (0.05, 0.05, 0.05), M_ACC, piv, seg=20)
    ants[side] = piv

sh, el = {}, {}
for side, sx in (('L', 1), ('R', -1)):
    s = empty('Shoulder' + side, (sx * 0.47, 0.0, 0.26), hover)
    s.rotation_euler = (0, -sx * D(10), 0)
    shape('ShoulderBall' + side, 'sphere', (0, 0, 0), (0.085, 0.085, 0.085), M_GRAPH, s, seg=20)
    shape('UpperArm' + side, 'cyl', (0, 0, -0.15), (1, 1, 1), M_PEARL, s, r=0.065, d=0.30, verts=32)
    e = empty('Elbow' + side, (0, 0, -0.30), s)
    e.rotation_euler = (D(-8), 0, 0)
    shape('ElbowBall' + side, 'sphere', (0, 0, 0), (0.075, 0.075, 0.075), M_GRAPH, e, seg=20)
    shape('Forearm' + side, 'cyl', (0, 0, -0.13), (1, 1, 1), M_PEARL, e, r=0.058, d=0.26, verts=32)
    shape('Hand' + side, 'sphere', (0, 0, -0.33), (0.10, 0.08, 0.11), M_ORANGE, e, seg=24)
    sh[side], el[side] = s, e

ring = bpy.data.objects['Ring']

# ---------------------------------------------------------------- animación
REST = {}
def track_objects():
    return [hover, head, ants['L'], ants['R'], sh['L'], sh['R'], el['L'], el['R'], eyes['L'], eyes['R'], ring]
for o in track_objects():
    REST[o.name] = (tuple(o.location), tuple(o.rotation_euler), tuple(o.scale))

def sine(total, period, amp, phase=0.0, base=0.0, step=6):
    out, f = [], 0
    while f < total:
        out.append((f, base + amp * math.sin(2 * math.pi * f / period + phase)))
        f += step
    out.append((total, base + amp * math.sin(2 * math.pi * total / period + phase)))
    return out

def const(total, v):
    return [(0, v), (total, v)]

def rest(o, prop, i):
    return REST[o.name][{'location': 0, 'rotation_euler': 1, 'scale': 2}[prop]][i]

def rot(o, i, keys, deg=True):
    return (o, 'rotation_euler', i, [(f, rest(o, 'rotation_euler', i) + (D(v) if deg else v)) for f, v in keys])

def loc(o, i, keys):
    return (o, 'location', i, [(f, rest(o, 'location', i) + v) for f, v in keys])

def scl(o, i, keys):
    return (o, 'scale', i, [(f, rest(o, 'scale', i) * v) for f, v in keys])

def blink(total, at, mult=1.0):
    return [(0, mult), (at, mult), (at + 4, 0.08), (at + 8, mult), (total, mult)]

def clip(name, total, channels, once=False):
    return {'name': name, 'total': total, 'channels': channels, 'once': once}

CLIPS = []

# idle: respira, flota, parpadea
T = 120
CLIPS.append(clip('idle', T, [
    loc(hover, 2, sine(T, 120, 0.045)),
    rot(hover, 0, sine(T, 120, 1.2, 0.5)),
    rot(hover, 1, sine(T, 120, 2.0)),
    rot(head, 2, sine(T, 120, 4.0, 1.0)),
    rot(head, 0, sine(T, 60, 1.5)),
    rot(ants['L'], 1, sine(T, 60, 5.0)),
    rot(ants['R'], 1, sine(T, 60, 5.0, 1.4)),
    rot(ants['L'], 0, sine(T, 120, 4.0, 0.6)),
    rot(ants['R'], 0, sine(T, 120, 4.0, 2.0)),
    rot(sh['L'], 0, sine(T, 120, 2.5)),
    rot(sh['R'], 0, sine(T, 120, 2.5, math.pi)),
    rot(el['L'], 0, sine(T, 120, 3.0, 0.4)),
    rot(el['R'], 0, sine(T, 120, 3.0, 0.4 + math.pi)),
    scl(eyes['L'], 2, blink(T, 84)), scl(eyes['R'], 2, blink(T, 84)),
    scl(ring, 0, sine(T, 60, 0.05, 0, 1.0)), scl(ring, 1, sine(T, 60, 0.05, 0, 1.0)),
]))

# greeting: saluda con la mano derecha (una sola vez)
T = 78
CLIPS.append(clip('greeting', T, [
    loc(hover, 2, [(0, 0), (10, -0.05), (22, 0.11), (40, 0.02), (T, 0)]),
    rot(hover, 0, [(0, 0), (12, 5), (26, -3), (T, 0)]),
    rot(head, 0, [(0, 0), (12, 7), (30, -4), (T, 0)]),
    rot(head, 1, [(0, 0), (24, 9), (60, 9), (T, 0)]),
    rot(head, 2, [(0, 0), (30, -6), (T, 0)]),
    rot(sh['R'], 1, [(0, 0), (20, 128), (62, 128), (T, 0)]),
    rot(sh['R'], 0, [(0, 0), (20, -10), (62, -10), (T, 0)]),
    rot(el['R'], 1, [(0, 0), (20, 0), (28, 30), (36, -14), (44, 30), (52, -14), (60, 0), (T, 0)]),
    rot(ants['L'], 0, [(0, 0), (14, 22), (30, -6), (T, 0)]),
    rot(ants['R'], 0, [(0, 0), (14, 22), (30, -6), (T, 0)]),
    scl(eyes['L'], 2, [(0, 1), (16, 1.2), (T, 1)]), scl(eyes['R'], 2, [(0, 1), (16, 1.2), (T, 1)]),
], once=True))

# listening: se inclina hacia quien habla, antenas atentas
T = 90
CLIPS.append(clip('listening', T, [
    loc(hover, 2, sine(T, 90, 0.03)),
    loc(hover, 1, const(T, -0.05)),
    rot(hover, 0, const(T, 5.0)),
    rot(head, 1, sine(T, 90, 2.0, 0, 9.0)),
    rot(head, 0, sine(T, 45, 1.6, 0, -2.0)),
    rot(head, 2, sine(T, 90, 3.0, 1.5)),
    rot(ants['L'], 0, sine(T, 30, 4.0, 0, 14.0)),
    rot(ants['R'], 0, sine(T, 30, 4.0, 1.5, 14.0)),
    rot(sh['L'], 0, const(T, -8.0)), rot(sh['R'], 0, const(T, -8.0)),
    rot(el['L'], 0, sine(T, 90, 3.0, 0, -22.0)), rot(el['R'], 0, sine(T, 90, 3.0, 1.0, -22.0)),
    scl(eyes['L'], 2, [(0, 1.15), (60, 1.15), (64, 0.1), (68, 1.15), (T, 1.15)]),
    scl(eyes['R'], 2, [(0, 1.15), (60, 1.15), (64, 0.1), (68, 1.15), (T, 1.15)]),
    scl(ring, 0, sine(T, 45, 0.06, 0, 1.0)), scl(ring, 1, sine(T, 45, 0.06, 0, 1.0)),
]))

# thinking: mira hacia arriba, inclina la cabeza, una mano al frente, antenas inquietas
T = 120
CLIPS.append(clip('thinking', T, [
    loc(hover, 2, sine(T, 120, 0.04)),
    rot(hover, 2, sine(T, 120, 6.0)),
    rot(head, 1, const(T, -11.0)),
    rot(head, 0, sine(T, 120, 2.0, 0, -9.0)),
    rot(head, 2, sine(T, 120, 9.0, 0.6)),
    rot(ants['L'], 0, sine(T, 40, 14.0)), rot(ants['R'], 0, sine(T, 40, 14.0, math.pi)),
    rot(ants['L'], 1, sine(T, 40, 8.0, 1.0)), rot(ants['R'], 1, sine(T, 40, 8.0, 2.0)),
    rot(sh['R'], 0, sine(T, 60, 2.5, 0, -70.0)), rot(sh['R'], 1, const(T, 24.0)),
    rot(el['R'], 0, sine(T, 30, 5.0, 0, -88.0)),
    rot(sh['L'], 0, const(T, -18.0)), rot(el['L'], 0, const(T, -30.0)),
    loc(eyes['L'], 0, sine(T, 120, 0.028, 0.5)), loc(eyes['R'], 0, sine(T, 120, 0.028, 0.5)),
    loc(eyes['L'], 2, const(T, 0.02)), loc(eyes['R'], 2, const(T, 0.02)),
    scl(eyes['L'], 2, [(0, 0.75), (T, 0.75)]), scl(eyes['R'], 2, [(0, 0.75), (T, 0.75)]),
    scl(ring, 0, sine(T, 40, 0.07, 0, 1.0)), scl(ring, 1, sine(T, 40, 0.07, 0, 1.0)),
]))

# speaking: cabeceo suave y gestos alternados con ambas manos
T = 60
CLIPS.append(clip('speaking', T, [
    loc(hover, 2, sine(T, 60, 0.03)),
    rot(hover, 2, sine(T, 60, 3.5)),
    rot(hover, 0, sine(T, 30, 1.5, 0.3, 2.0)),
    rot(head, 0, sine(T, 30, 3.5, 0, 1.0)),
    rot(head, 1, sine(T, 60, 3.0)),
    rot(head, 2, sine(T, 60, 5.0, 1.0)),
    rot(ants['L'], 0, sine(T, 30, 8.0, 0, 6.0)), rot(ants['R'], 0, sine(T, 30, 8.0, 1.6, 6.0)),
    rot(sh['L'], 0, sine(T, 60, 22.0, 0, -32.0)), rot(sh['R'], 0, sine(T, 60, 22.0, math.pi, -32.0)),
    rot(sh['L'], 1, sine(T, 60, 6.0, 0, -20.0)), rot(sh['R'], 1, sine(T, 60, 6.0, math.pi, 20.0)),
    rot(el['L'], 0, sine(T, 60, 24.0, 0.8, -34.0)), rot(el['R'], 0, sine(T, 60, 24.0, 0.8 + math.pi, -34.0)),
    scl(eyes['L'], 2, blink(T, 44, 1.05)), scl(eyes['R'], 2, blink(T, 44, 1.05)),
    scl(ring, 0, sine(T, 30, 0.08, 0, 1.0)), scl(ring, 1, sine(T, 30, 0.08, 0, 1.0)),
]))

# presenting: gira hacia la pantalla holográfica (a su izquierda, +X) y la señala con la palma arriba
T = 90
CLIPS.append(clip('presenting', T, [
    loc(hover, 2, sine(T, 90, 0.035)),
    rot(hover, 2, const(T, 9.0)),
    rot(hover, 0, sine(T, 90, 1.2, 0.4, 2.0)),
    rot(head, 2, sine(T, 90, 3.0, 0.8, 18.0)),
    rot(head, 1, sine(T, 90, 2.0, 0, -4.0)),
    rot(head, 0, sine(T, 45, 1.2, 0, -1.0)),
    rot(ants['L'], 0, sine(T, 45, 5.0, 0, 8.0)), rot(ants['R'], 0, sine(T, 45, 5.0, 1.4, 8.0)),
    rot(sh['L'], 1, sine(T, 90, 3.0, 0, -84.0)),
    rot(sh['L'], 0, sine(T, 90, 3.0, 1.0, -16.0)),
    rot(el['L'], 1, sine(T, 90, 5.0, 0.5, -22.0)),
    rot(el['L'], 0, const(T, -6.0)),
    rot(sh['R'], 0, sine(T, 90, 4.0, 2.0, -14.0)), rot(el['R'], 0, sine(T, 90, 4.0, 2.6, -24.0)),
    scl(eyes['L'], 2, blink(T, 60, 1.1)), scl(eyes['R'], 2, blink(T, 60, 1.1)),
    scl(ring, 0, sine(T, 45, 0.06, 0, 1.0)), scl(ring, 1, sine(T, 45, 0.06, 0, 1.0)),
]))

def reset_pose():
    for o in track_objects():
        l, r, s = REST[o.name]
        o.location, o.rotation_euler, o.scale = l, r, s

# vista previa en pose de reposo antes de bakear las animaciones
def render_preview(path):
    scene.render.engine = 'BLENDER_EEVEE'
    scene.render.resolution_x = scene.render.resolution_y = 900
    scene.render.filepath = path
    scene.render.image_settings.file_format = 'PNG'
    world = bpy.data.worlds.new('W')
    world.use_nodes = True
    bg = world.node_tree.nodes['Background']
    bg.inputs['Color'].default_value = (0.03, 0.03, 0.06, 1)
    bg.inputs['Strength'].default_value = 1.0
    scene.world = world
    cam = bpy.data.cameras.new('Cam')
    cam.lens = 70
    co = bpy.data.objects.new('Cam', cam)
    scene.collection.objects.link(co)
    co.location = (2.2, -7.0, 1.5)
    tgt = bpy.data.objects.new('T', None)
    scene.collection.objects.link(tgt)
    tgt.location = (0, 0, 0.15)
    tr = co.constraints.new('TRACK_TO')
    tr.target, tr.track_axis, tr.up_axis = tgt, 'TRACK_NEGATIVE_Z', 'UP_Y'
    scene.camera = co
    for nm, loc_, en, colr in (('Key', (4, -5, 5), 900, (1, 0.95, 0.9)), ('Rim', (-5, 3, 3), 700, (0.3, 0.7, 1.0)), ('Fill', (-4, -4, 1), 300, (1, 0.5, 0.25))):
        ld = bpy.data.lights.new(nm, 'AREA')
        ld.energy, ld.color, ld.size = en, colr, 3.0
        lo = bpy.data.objects.new(nm, ld)
        scene.collection.objects.link(lo)
        lo.location = loc_
        t2 = lo.constraints.new('TRACK_TO')
        t2.target, t2.track_axis, t2.up_axis = tgt, 'TRACK_NEGATIVE_Z', 'UP_Y'
    bpy.ops.render.render(write_still=True)
    for o in (co, tgt):
        bpy.data.objects.remove(o)

if PREVIEW:
    render_preview(PREVIEW)
    for o in list(scene.objects):
        if o.type in ('LIGHT', 'CAMERA') or o.name in ('T',):
            bpy.data.objects.remove(o)

# NLA: una pista por clip; el exportador une las pistas homónimas en una animación glTF
for c in CLIPS:
    for o in track_objects():
        reset_pose()
        ad = o.animation_data_create()
        ad.action = None
    reset_pose()
    per_obj = {}
    for (o, prop, i, keys) in c['channels']:
        per_obj.setdefault(o.name, []).append((o, prop, i, keys))
    for oname, chs in per_obj.items():
        o = bpy.data.objects[oname]
        reset_pose()
        for (_, prop, i, keys) in chs:
            for f, v in keys:
                vec = list(getattr(o, prop))
                vec[i] = v
                setattr(o, prop, vec)
                o.keyframe_insert(data_path=prop, index=i, frame=f)
        ad = o.animation_data
        act = ad.action
        act.name = '%s|%s' % (c['name'], oname)
        tr = ad.nla_tracks.new()
        tr.name = c['name']
        st = tr.strips.new(act.name, 0, act)
        st.name = c['name']
        ad.action = None
    reset_pose()

scene.frame_start, scene.frame_end = 0, max(c['total'] for c in CLIPS)
for o in bpy.data.objects:
    o.select_set(False)

import os
os.makedirs(os.path.dirname(os.path.abspath(OUT)), exist_ok=True)
bpy.ops.export_scene.gltf(
    filepath=OUT,
    export_format='GLB',
    export_animations=True,
    export_animation_mode='NLA_TRACKS',
    export_apply=True,
    export_yup=True,
    export_cameras=False,
    export_lights=False,
    export_optimize_animation_size=True,
    export_texcoords=True,
)
print('EXPORT_OK', OUT, [c['name'] for c in CLIPS])
