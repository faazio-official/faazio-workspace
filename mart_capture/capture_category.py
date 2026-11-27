#!/usr/bin/env python3
import re, subprocess, time, xml.etree.ElementTree as ET, json, os, sys

def adb(*a): return subprocess.run(['adb',*a],capture_output=True,text=True)

def dump():
    for _ in range(4):
        r=adb('shell','uiautomator','dump','/sdcard/ui.xml')
        if 'dumped' in (r.stdout+r.stderr) or r.returncode==0: break
        time.sleep(0.4)
    adb('pull','/sdcard/ui.xml','/tmp/opencode/cur.xml')
    return ET.parse('/tmp/opencode/cur.xml').getroot()

def bd(n):
    b=n.attrib.get('bounds',''); m=re.findall(r'\d+',b)
    return tuple(map(int,m)) if len(m)==4 else (0,0,0,0)

def find_desc(root, val):
    return [n for n in root.iter('node') if n.attrib.get('content-desc')==val]

def text_after_back(root):
    # title is TextView with y<230 and x>220
    for n in root.iter('node'):
        if n.attrib.get('class','').endswith('TextView'):
            t=n.attrib.get('text','').strip(); b=bd(n)
            if t and 90<b[1]<230 and b[0]>220:
                return t
    return ''

def capture_nav(root):
    nav=find_desc(root,'plp_left_nav_list')
    cats=[]
    if not nav: return cats, False
    seen=[]
    for _ in range(40):
        root2=dump()
        nav2=find_desc(root2,'plp_left_nav_list')
        if not nav2: break
        added=0
        for n in nav2[0].iter('node'):
            d=n.attrib.get('content-desc','').strip()
            if d and d!='plp_left_nav_list' and d not in seen:
                seen.append(d); added+=1
        if added==0 and len(seen)>0:
            # try one more
            pass
        if added==0 and _>0: break
        adb('shell','input','swipe','110','1900','110','450','300'); time.sleep(0.8)
    return seen, True

def capture_units(root, maxswipes=6):
    units=set(); prods=[]
    seen_cards=set()
    for i in range(maxswipes):
        root2=dump()
        for n in root2.iter('node'):
            d=n.attrib.get('content-desc','')
            if d.startswith('plp_product_item_'): continue
            # product cards look like {unit, ₹price, name, Delivery...}
            if d.startswith('{') and '₹' in d:
                inner=d[1:-1] if d.endswith('}') else d[1:]
                parts=[p.strip() for p in inner.split(',')]
                if len(parts)>=3 and ('Delivery' in parts[-1] or parts[-1].startswith('Delivery')):
                    unit=parts[0]
                    if unit and unit not in seen_cards:
                        seen_cards.add(unit+'|'+parts[2])
                        units.add(unit)
                        prods.append((unit,parts[1],parts[2]))
        adb('shell','input','swipe','650','1850','650','600','350'); time.sleep(0.8)
        if not prods: break
    return sorted(units), prods

if __name__=='__main__':
    root=dump()
    title=text_after_back(root)
    cats,hasnav=capture_nav(root)
    units,prods=capture_units(dump())
    print('TITLE',title,'hasnav',hasnav)
    print('NAV',len(cats))
    for c in cats: print('  ',c)
    print('UNITS',units)
    print('PRODS sample',prods[:8])
