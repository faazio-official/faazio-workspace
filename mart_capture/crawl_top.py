#!/usr/bin/env python3
import re, subprocess, time, xml.etree.ElementTree as ET, json, os

def adb(*a): return subprocess.run(['adb',*a],capture_output=True,text=True)

def dump_xml(tag):
    for _ in range(4):
        r=adb('shell','uiautomator','dump','/sdcard/ui.xml')
        if 'dumped' in (r.stdout+r.stderr) or r.returncode==0: break
        time.sleep(0.4)
    p=os.path.join('/tmp/opencode',tag+'.xml')
    adb('pull','/sdcard/ui.xml',p)
    return ET.parse(p).getroot()

def container(root):
    for n in root.iter('node'):
        if n.attrib.get('content-desc')=='category_list':
            return list(list(n)[0])[0]
    return None

def parse(root):
    c=container(root)
    if c is None: return [],None
    marker=None; header=None; out=[]
    for ch in list(c):
        d=ch.attrib.get('content-desc','')
        if d.startswith('category_list_item_'):
            marker=d; header=None
        elif ch.attrib.get('class','').endswith('TextView') and ch.attrib.get('text','').strip():
            if marker is not None and header is None:
                header=ch.attrib['text'].strip()
        elif d.startswith('category_grid_item_'):
            slug=d[len('category_grid_item_'):]
            tv=[g.attrib.get('text','') for g in ch.iter('node')
                if g.attrib.get('class','').endswith('TextView') and g.attrib.get('text','').strip()]
            out.append((marker,header,tv[0] if tv else '',slug))
    return out,marker

def swipe_up(): adb('shell','input','swipe','540','1900','540','650','350')
def swipe_down(): adb('shell','input','swipe','540','650','540','1900','350')

for _ in range(30): swipe_down(); time.sleep(0.4)
time.sleep(1)

markers={}   # marker -> header text
items=[]     # (marker,label,slug)
scrolls=0
while scrolls<80:
    root=dump_xml('catdump')
    rows,_=parse(root)
    new=0
    for marker,header,label,slug in rows:
        if marker and header and marker not in markers:
            markers[marker]=header
        if slug not in [i[2] for i in items]:
            items.append((marker,label,slug)); new+=1
        elif label:
            for i,(m,l,s) in enumerate(items):
                if s==slug and not l:
                    items[i]=(m,label,s)
    print(f'scroll {scrolls:2d} items {len(items):3d} new {new:2d} markers {len(markers)}', flush=True)
    if new==0 and scrolls>2:
        swipe_up(); time.sleep(1.1); scrolls+=1
        root=dump_xml('catdump'); rows,_=parse(root); more=0
        for marker,header,label,slug in rows:
            if marker and header and marker not in markers: markers[marker]=header
            if slug not in [i[2] for i in items]:
                items.append((marker,label,slug)); more+=1
        print('   confirm new',more, flush=True)
        if more==0: break
        continue
    swipe_up(); time.sleep(1.1); scrolls+=1

json.dump({'markers':markers,'items':items}, open('/tmp/opencode/topcats.json','w'), indent=1, ensure_ascii=False)
print('\nTOTAL items',len(items),'markers',len(markers))
cur=None
for marker,label,slug in items:
    h=markers.get(marker,'(?)')
    if h!=cur:
        cur=h; print(f'\n## {h}')
    print('  ',label,'|',slug)
