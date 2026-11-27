#!/usr/bin/env python3
import re, subprocess, time, xml.etree.ElementTree as ET, json, os, sys

BASE=os.path.dirname(os.path.abspath(__file__))
DATA=os.path.join(BASE,'data'); os.makedirs(DATA,exist_ok=True)
DB=os.path.join(BASE,'capture_data.json')
RAW=os.path.join(BASE,'raw_texts.json')

def adb(*a): return subprocess.run(['adb',*a],capture_output=True,text=True)
def dump(tag=None):
    for _ in range(5):
        r=adb('shell','uiautomator','dump','/sdcard/ui.xml')
        if 'dumped' in (r.stdout+r.stderr) or r.returncode==0: break
        time.sleep(0.35)
    p='/tmp/opencode/cur.xml'
    adb('pull','/sdcard/ui.xml',p)
    try: root=ET.parse(p).getroot()
    except Exception: return None
    if tag:
        try: adb('pull','/sdcard/ui.xml',os.path.join(DATA,f'{tag}.xml'))
        except Exception: pass
    return root

def bd(n):
    b=n.attrib.get('bounds',''); m=re.findall(r'\d+',b)
    return tuple(map(int,m)) if len(m)==4 else (0,0,0,0)
def center(b): return ((b[0]+b[2])//2,(b[1]+b[3])//2)
def tap(x,y): adb('shell','input','tap',str(x),str(y))
def back(): adb('shell','input','keyevent','4')
def swipe(x1,y1,x2,y2,d=350): adb('shell','input','swipe',str(x1),str(y1),str(x2),str(y2),str(d))

def is_categories(root):
    return root is not None and any(n.attrib.get('content-desc')=='category_list' for n in root.iter('node'))

def is_plp(root):
    return root is not None and any(n.attrib.get('content-desc')=='plp_left_nav_list' for n in root.iter('node'))

def ensure_categories():
    for _ in range(4):
        root=dump()
        if is_categories(root): return True
        # if on a PLP or other page, go back
        back(); time.sleep(1.5)
        root=dump()
        if is_categories(root): return True
        # maybe home; tap Categories nav
        tap(346,2080); time.sleep(2.5)
        if is_categories(dump()): return True
    return is_categories(dump())

def find_node(root,desc):
    for n in root.iter('node'):
        if n.attrib.get('content-desc')==desc:
            b=bd(n)
            if b[2]>b[0] and b[3]>b[1]: return b
    return None

def scroll_categories_top(maxsw=40):
    for i in range(maxsw):
        root=dump()
        if root is None: continue
        b=find_node(root,'category_grid_item_fresh-vegetables')
        if b and b[1] < 700: return
        swipe(540,700,540,1750,250); time.sleep(0.25)

def find_category(slug, maxsw=45):
    for step in range(maxsw):
        root=dump()
        if root is None: continue
        b=find_node(root,'category_grid_item_'+slug)
        if b:
            # acceptable tap zone: below header, above bottom nav, not under floating orb
            cx,cy=center(b)
            if cy < 1950 and not (cx>820 and cy>1700):
                time.sleep(0.6)
                root2=dump()
                b2=find_node(root2,'category_grid_item_'+slug)
                if b2:
                    cx,cy=center(b2)
                    if cy<1950 and not (cx>820 and cy>1700):
                        return root2,b2
        swipe(540,1700,540,1000,350); time.sleep(0.6)
    return None,None

def norm(s): return re.sub(r'[^a-z0-9]+','',(s or '').lower().strip('" '))

def page_title(root):
    for n in root.iter('node'):
        if n.attrib.get('class','').endswith('TextView'):
            t=n.attrib.get('text','').strip(); b=bd(n)
            if t and 85<b[1]<235 and b[0]>200 and len(t)<80: return t
    return ''

def visible_texts(root):
    out=[]
    for n in root.iter('node'):
        t=n.attrib.get('text','').strip(); d=n.attrib.get('content-desc','').strip(); b=bd(n)
        if t or d: out.append({'t':t,'d':d,'b':b,'clk':n.attrib.get('clickable')=='true'})
    return out

def capture_nav():
    for _ in range(15): swipe(110,500,110,1950,250); time.sleep(0.2)
    seen=[]; miss=0
    for it in range(140):
        root=dump()
        if root is None: break
        nav=[n for n in root.iter('node') if n.attrib.get('content-desc')=='plp_left_nav_list']
        if not nav: break
        added=0
        for n in nav[0].iter('node'):
            d=n.attrib.get('content-desc','').strip()
            if d and d!='plp_left_nav_list' and d not in seen:
                seen.append(d); added+=1
        if added==0:
            miss+=1
            if miss>=3: break
        else: miss=0
        swipe(110,1650,110,1250,400); time.sleep(0.55)
    return [x for x in seen if x.lower()!='all']

UNIT_RE=re.compile(r'^\d+(\.\d+)?\s*(g|kg|mg|ml|l|litre|liter|pieces?|pcs?|pc|pack|pack\s*of|n|x)\b', re.I)
def is_unit(s):
    if not s or s.startswith('₹'): return False
    if s.lower()=='ad': return False
    return bool(UNIT_RE.match(s))

def parse_card(d):
    if '₹' not in d: return None
    parts=[p.strip() for p in d.split(',')]
    idx=None
    for i,p in enumerate(parts):
        if p.startswith('₹'): idx=i; break
    if idx is None: return None
    unit = parts[0] if idx>0 and is_unit(parts[0]) else ''
    price = parts[idx]
    name = ', '.join(parts[idx+1:]).strip()
    if name.startswith('Delivery'): name=''
    name=re.sub(r'Delivery Before.*$','',name).strip().strip(',').strip()
    return unit,price,name

def capture_units(maxswipes=7):
    units=set(); prods=[]; seen=set(); miss=0
    for i in range(maxswipes):
        root=dump()
        if root is None: break
        added=0
        for n in root.iter('node'):
            d=n.attrib.get('content-desc','')
            if '₹' not in d: continue
            c=parse_card(d)
            if not c: continue
            unit,price,name=c
            if d in seen: continue
            seen.add(d); added+=1
            if unit: units.add(unit)
            prods.append({'unit':unit,'price':price,'name':name})
        if added==0:
            miss+=1
            if miss>=2: break
        else: miss=0
        swipe(650,1900,650,600,350); time.sleep(0.7)
    return sorted(units), prods

def capture_current(slug,label,section):
    root=dump(slug)
    if root is None: return None
    t=page_title(root)
    nav_ok=is_plp(root)
    rec={'slug':slug,'label':label,'section':section,'page_title':t,'layout':'plp' if nav_ok else 'other',
         'subcats':[],'units':[],'sample_products':[],'suspect':False}
    if nav_ok:
        rec['subcats']=capture_nav()
    # raw texts snapshot (top)
    rec['texts']=[x for x in visible_texts(root)][:300]
    u,p=capture_units(7 if nav_ok else 5)
    rec['units']=u; rec['sample_products']=p[:80]
    if not nav_ok:
        seen=[]
        for i in range(8):
            r2=dump()
            if r2 is None: break
            added=0
            for x in visible_texts(r2):
                if x['clk'] and x['d'] and not x['d'].startswith(('plp_','category_')) and x['d'] not in seen:
                    seen.append(x['d']); added+=1
            if added==0 and i>0: break
            swipe(540,1900,540,650,350); time.sleep(0.6)
        rec['tiles']=seen
    n1,n2=norm(label),norm(t)
    if not (n1 in n2 or n2 in n1): rec['suspect']=True
    return rec

def load_db():
    if os.path.exists(DB): return json.load(open(DB))
    return {}
def save_db(db): json.dump(db,open(DB,'w'),indent=1,ensure_ascii=False)

def open_category(slug,label):
    for attempt in range(3):
        if not ensure_categories():
            print('   cannot reach categories',flush=True); return None
        scroll_categories_top()
        root,b=find_category(slug)
        if b is None:
            print('   not found',flush=True); return None
        tap(*center(b)); time.sleep(3.0)
        r=dump()
        t=page_title(r); n1,n2=norm(label),norm(t)
        if n1 in n2 or n2 in n1 or (n2 and label.lower()[:6] in (t or '').lower()):
            return r
        # wrong page -> back and retry
        print(f'   wrong page {t!r}; retry ({attempt+1})',flush=True)
        back(); time.sleep(1.8)
    return None

def main():
    top=json.load(open('/tmp/opencode/topcats.json'))
    items=top['items']; markers=top['markers']
    db=load_db()
    only=sys.argv[1:] if len(sys.argv)>1 else None
    queue=[(i,m,l,s) for i,(m,l,s) in enumerate(items) if (not only or s in only)]
    for idx,marker,label,slug in queue:
        if slug in db and db[slug].get('subcats') and not db[slug].get('suspect') and not only:
            continue
        section=markers.get(marker,'')
        print(f'\n[{idx+1}/{len(items)}] {section} > {label} ({slug})',flush=True)
        r=open_category(slug,label)
        if r is None:
            db[slug]={'slug':slug,'label':label,'section':section,'error':'open_failed','subcats':[],'units':[],'suspect':True}
            save_db(db); continue
        try: rec=capture_current(slug,label,section)
        except Exception as e:
            print('  ERR',e,flush=True); rec={'slug':slug,'label':label,'section':section,'error':str(e),'subcats':[],'units':[],'suspect':True}
        db[slug]=rec; save_db(db)
        print(f'  title={rec.get("page_title")!r} layout={rec.get("layout")} subcats={len(rec.get("subcats",[]))} units={len(rec.get("units",[]))} suspect={rec.get("suspect")}',flush=True)
        back(); time.sleep(1.8)
    print('\nDONE',len(db))

if __name__=='__main__':
    main()
