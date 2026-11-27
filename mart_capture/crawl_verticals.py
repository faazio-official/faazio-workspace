#!/usr/bin/env python3
import subprocess,time,re,xml.etree.ElementTree as ET,json,os

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
    if cl is None: return []
    out=[]; sec=None
    for ch in list(cl):
        d=ch.attrib.get('content-desc','')
        if d.startswith('category_list_item_'):
            sec=None
        elif ch.attrib.get('class','').endswith('TextView') and ch.attrib.get('text','').strip():
            if sec is None: sec=ch.attrib['text'].strip()
        elif d.startswith('category_grid_item_'):
            slug=d[len('category_grid_item_'):]
            tv=[g.attrib.get('text','') for g in ch.iter('node') if g.attrib.get('class','').endswith('TextView') and g.attrib.get('text','').strip()]
            out.append((sec,tv[0] if tv else '',slug))
    return out

def left_nav():
    seen=[]
    for _ in range(20):
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

def ensure_page():
    root=dump()
    if root is None: return False
    for n in root.iter('node'):
        if n.attrib.get('content-desc')=='category_left_nav_list': return True
    # tap Categories bottom nav
    tap(346,2080); time.sleep(3); return True

def select_vertical(name):
    # scroll left nav to top
    for _ in range(12): swipe(110,500,110,1900,250); time.sleep(.15)
    for i in range(25):
        root=dump()
        if root is None: return False
        n,b=find(root,name)
        if b:
            tap((b[0]+b[2])//2,(b[1]+b[3])//2); time.sleep(2.5); return True
        swipe(110,1700,110,1000,300); time.sleep(.5)
    return False

def content_top():
    # scroll content to top
    for _ in range(20):
        swipe(650,900,650,1700,300); time.sleep(.3)

def crawl_vertical(name):
    if not select_vertical(name): return None
    content_top(); time.sleep(.8)
    seen={}; order=[]; miss=0
    for step in range(60):
        root=dump()
        if root is None: break
        rows=parse(root); new=0
        for sec,lab,slug in rows:
            if slug not in seen:
                seen[slug]=(sec,lab); order.append(slug); new+=1
            elif lab and not seen[slug][1]:
                seen[slug]=(seen[slug][0],lab)
        if new==0:
            miss+=1
            if miss>=2: break
        else: miss=0
        swipe(650,1900,650,750,400); time.sleep(.9)
    return {'name':name,'items':[{'section':seen[s][0],'label':seen[s][1],'slug':s} for s in order]}

if __name__=='__main__':
    print('ensure',ensure_page())
    nav=left_nav(); print('verticals',nav,flush=True)
    # ensure at top then crawl each
    result={}
    for name in nav:
        print('==',name,flush=True)
        r=crawl_vertical(name)
        if r:
            result[name]=r
            print('   items',len(r['items']),flush=True)
            for it in r['items'][:60]: print('     ',it['section'],'|',it['label'],'|',it['slug'])
        json.dump(result,open('/tmp/opencode/verticals.json','w'),indent=1,ensure_ascii=False)
    print('DONE', {k:len(v['items']) for k,v in result.items()})
