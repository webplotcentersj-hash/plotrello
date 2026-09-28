"""
Renderiza el fondo del tótem: un taller de impresión de gran formato, oscuro y con reflejos.
Genera dos capas: lejana (escena completa) y cercana (motas desenfocadas con alfa) para dar paralaje.

Uso:
  blender -b --factory-startup --python scripts/blender/build_totem_backdrop.py -- --far far.png --near near.png [--w 2304 --h 1296 --samples 48]
Después: scripts/blender/post_backdrop.sh (o los comandos ffmpeg del README) para brillo y WebP.
"""
import math
import random
import sys
import bpy

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
def arg(name, default):
    return argv[argv.index(name) + 1] if name in argv else default

FAR = arg('--far', 'backdrop-far.png')
NEAR = arg('--near', 'backdrop-near.png')
W, H = int(arg('--w', 2304)), int(arg('--h', 1296))
SAMPLES = int(arg('--samples', 48))
random.seed(11)
D = math.radians

def lin(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
def hexcol(h):
    h = h.lstrip('#')
    return tuple(lin(int(h[i:i + 2], 16) / 255) for i in (0, 2, 4))

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

def new_obj(name, kind, loc, scale=(1, 1, 1), rot=(0, 0, 0), **kw):
    if kind == 'plane':
        bpy.ops.mesh.primitive_plane_add(size=1)
    elif kind == 'cube':
        bpy.ops.mesh.primitive_cube_add(size=1)
    elif kind == 'torus':
        bpy.ops.mesh.primitive_torus_add(major_segments=160, minor_segments=20, major_radius=kw['R'], minor_radius=kw['r'])
    elif kind == 'cyl':
        bpy.ops.mesh.primitive_cylinder_add(vertices=64, radius=kw['r'], depth=kw['d'])
    elif kind == 'sphere':
        bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=8, radius=1)
    elif kind == 'circle':
        bpy.ops.mesh.primitive_circle_add(vertices=96, radius=kw['r'], fill_type='NGON', calc_uvs=True)
    o = bpy.context.active_object
    o.name = name
    o.location, o.scale, o.rotation_euler = loc, scale, rot
    return o

def emission(name, color, strength):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    e = nt.nodes.new('ShaderNodeEmission')
    e.inputs['Color'].default_value = (*hexcol(color), 1)
    e.inputs['Strength'].default_value = strength
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    nt.links.new(e.outputs['Emission'], out.inputs['Surface'])
    return m

def principled(name, color, metallic, rough, coat=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*hexcol(color), 1)
    b.inputs['Metallic'].default_value = metallic
    b.inputs['Roughness'].default_value = rough
    if coat:
        b.inputs['Coat Weight'].default_value = coat
    return m

def gradient_emission(name, stops, strength):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    tc = nt.nodes.new('ShaderNodeTexCoord')
    sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    e = nt.nodes.new('ShaderNodeEmission')
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    nt.links.new(tc.outputs['UV'], sep.inputs['Vector'])
    nt.links.new(sep.outputs['Y'], ramp.inputs['Fac'])
    nt.links.new(ramp.outputs['Color'], e.inputs['Color'])
    nt.links.new(e.outputs['Emission'], out.inputs['Surface'])
    e.inputs['Strength'].default_value = strength
    cr = ramp.color_ramp
    while len(cr.elements) > 1:
        cr.elements.remove(cr.elements[-1])
    for i, (pos, hx) in enumerate(stops):
        el = cr.elements[0] if i == 0 else cr.elements.new(pos)
        el.position = pos
        el.color = (*hexcol(hx), 1)
    return m

def assign(o, m):
    o.data.materials.append(m)

def smooth(o):
    try:
        o.data.shade_smooth()
    except Exception:
        pass

far, near = [], []

# ---------------------------------------------------------------- suelo y muro
floor = new_obj('Floor', 'plane', (0, 6, 0), (120, 120, 1))
assign(floor, principled('FloorMat', '#070a16', 0.35, 0.10, coat=0.6))
wall = new_obj('Wall', 'plane', (0, 30, 15), (140, 1, 34), (D(90), 0, 0))
assign(wall, principled('WallMat', '#03040b', 0.0, 0.95))
far += [floor, wall]

# líneas de piso: guían la perspectiva y se reflejan en el brillo
line_cy = emission('LineCyan', '#38bdf8', 0.55)
line_or = emission('LineOrange', '#eb671b', 0.9)
for i in range(-14, 15):
    o = new_obj('GX%d' % i, 'cube', (i * 2.0, 8, 0.004), (0.010, 46, 0.004))
    assign(o, line_cy if i % 4 else line_or)
    far.append(o)
for j in range(-4, 24):
    o = new_obj('GY%d' % j, 'cube', (0, j * 2.0, 0.004), (60, 0.010, 0.004))
    assign(o, line_cy if j % 4 else line_or)
    far.append(o)

# ---------------------------------------------------------------- portal de luz
PX, PY, PZ = -4.2, 15, 3.4
for nm, R, r, colr, st in (('PortalA', 3.7, 0.08, '#eb671b', 14), ('PortalB', 3.25, 0.03, '#38bdf8', 10), ('PortalC', 4.25, 0.045, '#ff7a2e', 4)):
    o = new_obj(nm, 'torus', (PX, PY, PZ), rot=(D(90), 0, 0), R=R, r=r)
    assign(o, emission(nm, colr, st))
    smooth(o)
    far.append(o)
glow = new_obj('PortalGlow', 'circle', (PX, PY + 0.6, PZ), rot=(D(90), 0, 0), r=3.55)
gm = bpy.data.materials.new('GlowMat')
gm.use_nodes = True
nt = gm.node_tree
nt.nodes.clear()
tc = nt.nodes.new('ShaderNodeTexCoord')
grad = nt.nodes.new('ShaderNodeTexGradient')
grad.gradient_type = 'SPHERICAL'
mp = nt.nodes.new('ShaderNodeMapping')
mp.inputs['Location'].default_value = (0.5, 0.5, 0)
mp.inputs['Scale'].default_value = (2, 2, 2)
mp.inputs['Location'].default_value = (-1, -1, 0)
ramp = nt.nodes.new('ShaderNodeValToRGB')
em = nt.nodes.new('ShaderNodeEmission')
out = nt.nodes.new('ShaderNodeOutputMaterial')
nt.links.new(tc.outputs['UV'], mp.inputs['Vector'])
nt.links.new(mp.outputs['Vector'], grad.inputs['Vector'])
nt.links.new(grad.outputs['Fac'], ramp.inputs['Fac'])
nt.links.new(ramp.outputs['Color'], em.inputs['Color'])
nt.links.new(em.outputs['Emission'], out.inputs['Surface'])
em.inputs['Strength'].default_value = 1.0
cr = ramp.color_ramp
cr.elements[0].position, cr.elements[0].color = 0.0, (0, 0, 0, 1)
cr.elements[1].position, cr.elements[1].color = 1.0, (*hexcol('#070a1e'), 1)
for pos, hx in ((0.16, '#b8410e'), (0.34, '#5a1f52'), (0.62, '#141240')):
    e2 = cr.elements.new(pos)
    e2.color = (*hexcol(hx), 1)
assign(glow, gm)
far.append(glow)

# ---------------------------------------------------------------- pendones de gran formato
PALETTES = [
    [(0, '#00b7eb'), (0.55, '#5b3df0'), (1, '#e6007e')],
    [(0, '#ffd800'), (0.5, '#eb671b'), (1, '#e6007e')],
    [(0, '#0b1a4a'), (0.5, '#00b7eb'), (1, '#7bf3d0')],
    [(0, '#e6007e'), (0.6, '#7a2cf0'), (1, '#0b1a4a')],
    [(0, '#eb671b'), (0.5, '#ffb347'), (1, '#fff1c9')],
]
bx = [-15, -11.5, -8.5, -5.5, 0.8, 4.2, 7.4, 10.6, 14, 17.5]
for i, x in enumerate(bx):
    y = 10.5 + (i % 4) * 2.6 + random.uniform(-0.5, 0.5)
    hgt = random.uniform(5.2, 7.0)
    p = new_obj('Banner%d' % i, 'plane', (x, y, hgt / 2 + 1.3), (1.5, hgt, 1), (D(90), 0, D(random.uniform(-22, 22))))
    assign(p, gradient_emission('Ban%d' % i, PALETTES[i % len(PALETTES)], random.uniform(0.55, 1.05)))
    rod = new_obj('Rod%d' % i, 'cyl', (x, y, hgt + 1.35), rot=(0, D(90), p.rotation_euler[2] + D(0)), r=0.05, d=1.8)
    assign(rod, principled('RodMat', '#1a1e30', 0.8, 0.3))
    far += [p, rod]

# ---------------------------------------------------------------- rollos de papel en primer plano
for k, (x, y) in enumerate(((-8.0, 2.0), (9.5, 4.5))):
    roll = new_obj('Roll%d' % k, 'cyl', (x, y, 0.7), rot=(0, D(90), D(12 if k == 0 else -18)), r=0.7, d=3.4)
    assign(roll, principled('Paper', '#e8ebf5', 0.0, 0.55))
    core = new_obj('Core%d' % k, 'cyl', (x, y, 0.7), rot=(0, D(90), D(12 if k == 0 else -18)), r=0.22, d=3.6)
    assign(core, emission('CoreOr', '#eb671b', 1.5))
    far += [roll, core]

# ---------------------------------------------------------------- motas lejanas (bokeh)
pal = [('#eb671b', 9), ('#38bdf8', 8), ('#ffffff', 5), ('#ffb347', 8)]
for i in range(150):
    hx, st = random.choice(pal)
    s = random.uniform(0.02, 0.07)
    o = new_obj('Mote%d' % i, 'sphere', (random.uniform(-15, 15), random.uniform(0, 20), random.uniform(0.3, 8)), (s, s, s))
    assign(o, emission('M%d' % i, hx, st))
    far.append(o)

# ---------------------------------------------------------------- motas cercanas (capa aparte)
for i in range(46):
    hx, st = random.choice(pal)
    s = random.uniform(0.05, 0.16)
    o = new_obj('Cerca%d' % i, 'sphere', (random.uniform(-5.5, 5.5), random.uniform(-8.6, -5.5), random.uniform(0.2, 4.8)), (s, s, s))
    assign(o, emission('C%d' % i, hx, st * 1.2))
    near.append(o)

# ---------------------------------------------------------------- luces
def add_light(name, kind, loc, energy, color, **kw):
    ld = bpy.data.lights.new(name, kind)
    ld.energy, ld.color = energy, color
    ld.specular_factor = kw.get('spec', 0.0)
    if kind == 'SPOT':
        ld.spot_size, ld.spot_blend = D(kw.get('angle', 60)), 0.8
    if kind == 'AREA':
        ld.size = kw.get('size', 4)
    o = bpy.data.objects.new(name, ld)
    scene.collection.objects.link(o)
    o.location = loc
    tgt = kw.get('target')
    if tgt is not None:
        e = o.constraints.new('TRACK_TO')
        t = bpy.data.objects.new(name + '_t', None)
        t.location = tgt
        scene.collection.objects.link(t)
        e.target, e.track_axis, e.up_axis = t, 'TRACK_NEGATIVE_Z', 'UP_Y'
    return o
pool = add_light('Pool', 'SPOT', (-1.8, 0.6, 8.0), 2600, (1.0, 0.6, 0.3), angle=38, target=(-1.8, 0.6, 0))
add_light('Rim', 'AREA', (-10, 10, 5), 500, (0.25, 0.65, 1.0), size=4, target=(-4, 8, 1))
add_light('Fill', 'AREA', (9, 2, 5), 350, (1.0, 0.45, 0.25), size=6, target=(3, 6, 1))

# ---------------------------------------------------------------- mundo y volumen (haz de luz)
world = bpy.data.worlds.new('W')
world.use_nodes = True
world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.006, 0.008, 0.02, 1)
world.node_tree.nodes['Background'].inputs['Strength'].default_value = 1.0
try:
    vol = world.node_tree.nodes.new('ShaderNodeVolumePrincipled')
    vol.inputs['Density'].default_value = 0.010
    vol.inputs['Color'].default_value = (0.8, 0.85, 1, 1)
    vol.inputs['Anisotropy'].default_value = 0.35
    world.node_tree.links.new(vol.outputs['Volume'], world.node_tree.nodes['World Output'].inputs['Volume'])
except Exception as ex:
    print('sin volumen:', ex)
scene.world = world

# ---------------------------------------------------------------- cámara
cam = bpy.data.cameras.new('Cam')
cam.lens, cam.sensor_width = 32, 36
cam.dof.use_dof = True
cam.dof.aperture_fstop = 1.0
cam.dof.focus_distance = 24
co = bpy.data.objects.new('Cam', cam)
scene.collection.objects.link(co)
co.location = (0, -10, 2.2)
co.rotation_euler = (D(86), 0, 0)
scene.camera = co

r = scene.render
r.engine = 'BLENDER_EEVEE'
r.resolution_x, r.resolution_y = W, H
r.image_settings.file_format = 'PNG'
r.image_settings.color_mode = 'RGBA'
r.image_settings.color_depth = '8'
scene.view_settings.view_transform = 'AgX'
try:
    ev = scene.eevee
    ev.taa_render_samples = SAMPLES
    ev.use_raytracing = True
    ev.use_shadows = True
    ev.volumetric_samples = 48
    ev.volumetric_tile_size = '2'
except Exception as ex:
    print('eevee opciones:', ex)

def show(objs_visible):
    vis = set(o.name for o in objs_visible)
    for o in scene.objects:
        if o.type in ('MESH',):
            o.hide_render = o.name not in vis

def render(path, transparent):
    r.film_transparent = transparent
    r.filepath = path
    bpy.ops.render.render(write_still=True)

show(far)
render(FAR, False)

# capa cercana: solo motas, fondo transparente, sin volumen ni reflejos
show(near)
try:
    world.node_tree.nodes['World Output'].inputs['Volume'].links[0]
    world.node_tree.links.remove(world.node_tree.nodes['World Output'].inputs['Volume'].links[0])
except Exception:
    pass
cam.dof.aperture_fstop = 0.9
cam.dof.focus_distance = 24
render(NEAR, True)
print('BACKDROP_OK', FAR, NEAR)
