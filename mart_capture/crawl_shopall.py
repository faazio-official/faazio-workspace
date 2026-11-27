#!/usr/bin/env python3
import subprocess,time,re,xml.etree.ElementTree as ET,json

def adb(*a): return subprocess.run(['adb',*a],capture_output=True,text=True)
def dump():
    for _ in range(6):
        r=adb('shell','uiautomator','dump','--compressed','/sdcard/uic.xml')
        if 'dumped' in (r.stdout+r.stderr): break
        time.sleep(.4)
    adb('pull','/sdcard/uic.xml','/tmp/opencode/v.xml')
    try: return ET.parse('/tmp/opencode/v.xml').getroot()
    except Exception: return None
def bd(n):
    b=n.attrib.get('bounds','');m=re.findall(r'\d+',b);return tuple(map(int,m)) if len(m)==4 else (0,0,0,0)
def find(root,desc):
    for n in root.iter('node'):
        if n.attrib.get('content-desc')==desc:
            b=bd(n)
            if b[2]>b[0] and b[3]>b[1]: return n,b
    return None,None
def tap(x,y): adb('shell','input','tap',str(x),str(y))
def swipe(x1,y1,x2,y2,d=350): adb('shell','input','swipe',str(x1),str(y1),str(x2),str(y2),str(d))

def parse(root):
    cl=None
    for n in root.iter('node'):
        if n.attrib.get('content-desc')=='category_list': cl=n; break
    if cl is None: return [],None
    rows=[]; sec=None
    for ch in list(cl):
        d=ch.attrib.get('content-desc','')
        if d.startswith('category_list_item_'):
            sec=None
        elif ch.attrib.get('class','').endswith('TextView') and ch.attrib.get('text','').strip():
            if sec is None: sec=ch.attrib['text'].strip()
        elif d.startswith('category_grid_item_'):
            slug=d[len('category_grid_item_'):]
            tv=[g.attrib.get('text','') for g in ch.iter('node') if g.attrib.get('class','').endswith('TextView') and g.attrib.get('text','').strip()]
            rows.append((sec,tv[0] if tv else '',slug))
    return rows,cl

def ensure_page():
    root=dump()
    if root is not None and any(n.attrib.get('content-desc')=='category_left_nav_list' for n in root.iter('node')): return True
    tap(346,2080); time.sleep(3)
    root=dump()
    return root is not None and any(n.attrib.get('content-desc')=='category_left_nav_list' for n in root.iter('node'))

def left_nav():
    for _ in range(12): swipe(110,500,110,1900,250); time.sleep(.15)
    seen=[]
    for _ in range(25):
        root=dump()
        if root is None: break
        ln=None
        for n in root.iter('node'):
            if n.attrib.get('content-desc')=='category_left_nav_list': ln=n; break
        if ln is None: break
        added=0
        for n in ln.iter('node'):
            d=n.attrib.get('content-desc','').strip()
            if d and d!='category_left_nav_list' and d not in seen: seen.append(d); added+=1
        if added==0: break
        swipe(110,1900,110,500,300); time.sleep(.6)
    return seen

def select_vertical(name):
    for _ in range(12): swipe(110,500,110,1900,250); time.sleep(.12)
    for i in range(30):
        root=dump()
        if root is None: return None
        n,b=find(root,name)
        if b:
            tap((b[0]+b[2])//2,(b[1]+b[3])//2); time.sleep(2.5); return dump()
        swipe(110,1700,110,900,300); time.sleep(.45)
    return None

def first_section(root):
    # topmost section header in content: TextView, wide, below 300
    best=None
    for n in root.iter('node'):
        if n.attrib.get('class','').endswith('TextView'):
            t=n.attrib.get('text','').strip(); b=bd(n)
            if t and (b[2]-b[0])>700 and 300<b[1]<1200:
                if best is None or b[1]<best[1][1]: best=(t,b)
    return best[0] if best else None

def content_top():
    for _ in range(18): swipe(650,900,650,1700,300); time.sleep(.25)

# ensure ShopAll categories page, select Groceries
print('ensure',ensure_page(),flush=True)
nav=left_nav(); print('verticals',nav,flush=True)

# Record first section for each vertical (to partition)
starts={}
for name in nav:
    r=select_vertical(name)
    if r is None: print('  no',name,flush=True); continue
    fs=first_section(r)
    starts[name]=fs
    print('  start',name,'=>',repr(fs),flush=True)

# Go back to Groceries and crawl entire linear list
select_vertical('Groceries'); content_top(); time.sleep(1)

sections=[]  # ordered section names
seen_sec=set()
items=[]     # (section,label,slug)
seen_slug=set()
miss=0
for step in range(220):
    root=dump()
    if root is None: break
    rows,_=parse(root)
    new=0
    for sec,lab,slug in rows:
        if sec and sec not in seen_sec:
            seen_sec.add(sec); sections.append(sec)
        if slug not in seen_slug:
            seen_slug.add(slug); items.append((sec,lab,slug)); new+=1
    if new==0:
        miss+=1
        if miss>=3: break
    else: miss=0
    swipe(650,1950,650,700,380); time.sleep(.85)
    if step%10==0: print('  scroll',step,'items',len(items),'sections',len(sections),flush=True)

out={'verticals':nav,'starts':starts,'sections':sections,'items':items}
json.dump(out,open('/tmp/opencode/shopall.json','w'),indent=1,ensure_ascii=False)
print('TOTAL items',len(items),'sections',len(sections))
print('sections:',sections)
