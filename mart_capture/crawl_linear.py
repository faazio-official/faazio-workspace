#!/usr/bin/env python3
import subprocess,time,re,xml.etree.ElementTree as ET,json

def adb(*a): return subprocess.run(['adb',*a],capture_output=True,text=True)
def dump():
    for _ in range(6):
        r=adb('shell','uiautomator','dump','--compressed','/sdcard/uic.xml')
        if 'dumped' in (r.stdout+r.stderr): break
        time.sleep(.35)
    adb('pull','/sdcard/uic.xml','/tmp/opencode/l.xml')
    try: return ET.parse('/tmp/opencode/l.xml').getroot()
    except Exception: return None
def bd(n):
    b=n.attrib.get('bounds','');m=re.findall(r'\d+',b);return tuple(map(int,m)) if len(m)==4 else (0,0,0,0)
def find(root,desc):
    for n in root.iter('node'):
        if n.attrib.get('content-desc')==desc:
            b=bd(n)
            if b[2]>b[0] and b[3]>b[1]: return b
    return None
def parse(root):
    cl=None
    for n in root.iter('node'):
        if n.attrib.get('content-desc')=='category_list': cl=n; break
    if cl is None: return []
    rows=[]; sec=None
    for ch in list(cl):
        d=ch.attrib.get('content-desc','')
        if d.startswith('category_list_item_'): sec=None
        elif ch.attrib.get('class','').endswith('TextView') and ch.attrib.get('text','').strip():
            if sec is None: sec=ch.attrib['text'].strip()
        elif d.startswith('category_grid_item_'):
            slug=d[len('category_grid_item_'):]
            tv=[g.attrib.get('text','') for g in ch.iter('node') if g.attrib.get('class','').endswith('TextView') and g.attrib.get('text','').strip()]
            rows.append((sec,tv[0] if tv else '',slug))
    return rows

# select Groceries
for _ in range(12): adb('shell','input','swipe','110','500','110','1900','250'); time.sleep(.1)
for i in range(20):
    r=dump()
    if r is None: break
    b=find(r,'Groceries')
    if b:
        adb('shell','input','tap',str((b[0]+b[2])//2),str((b[1]+b[3])//2)); time.sleep(2.5); break
    adb('shell','input','swipe','110','1700','110','900','300'); time.sleep(.4)

# scroll content to top
for _ in range(15): adb('shell','input','swipe','650','900','650','1750','280'); time.sleep(.2)
time.sleep(1)

sections=[]; seen_sec=set(); items=[]; seen=set(); miss=0
for step in range(260):
    r=dump()
    if r is None: break
    rows=parse(r); new=0
    for sec,lab,slug in rows:
        if sec and sec not in seen_sec: seen_sec.add(sec); sections.append(sec)
        if slug not in seen:
            seen.add(slug); items.append((sec,lab,slug)); new+=1
    if new==0:
        miss+=1
        if miss>=3: break
    else: miss=0
    adb('shell','input','swipe','650','1950','650','700','400'); time.sleep(.85)
    if step%10==0: print('step',step,'items',len(items),'sections',len(sections),flush=True)

json.dump({'sections':sections,'items':items},open('/tmp/opencode/shopall_linear.json','w'),indent=1,ensure_ascii=False)
print('TOTAL items',len(items),'sections',len(sections))
print('SECTIONS:',sections)
