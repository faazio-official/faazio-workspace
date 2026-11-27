#!/usr/bin/env python3
import sys, subprocess, re, time, os, xml.etree.ElementTree as ET

BASE = os.path.dirname(os.path.abspath(__file__))
ADB = "adb"

def sh(*args, **kw):
    return subprocess.run([ADB, *args], capture_output=True, text=True, **kw)

def dump(tag="ui"):
    for _ in range(3):
        r = sh("shell", "uiautomator", "dump", "/sdcard/ui.xml")
        if "dumped" in (r.stdout + r.stderr) or r.returncode == 0:
            break
        time.sleep(0.5)
    sh("pull", "/sdcard/ui.xml", os.path.join(BASE, "dumps", tag + ".xml"))
    return os.path.join(BASE, "dumps", tag + ".xml")

def shot(tag="shot"):
    p = os.path.join(BASE, "shots", tag + ".png")
    with open(p, "wb") as f:
        f.write(subprocess.run([ADB, "exec-out", "screencap", "-p"], capture_output=True).stdout)
    return p

def load(path):
    return ET.parse(path).getroot()

def bounds(node):
    b = node.attrib.get("bounds", "")
    m = re.findall(r"\d+", b)
    if len(m) == 4:
        return tuple(map(int, m))
    return None

def center(node):
    b = bounds(node)
    if not b: return None
    return ((b[0]+b[2])//2, (b[1]+b[3])//2)

def nodes(path):
    root = load(path)
    out = []
    for n in root.iter("node"):
        t = n.attrib.get("text", "")
        d = n.attrib.get("content-desc", "")
        if t.strip() or d.strip():
            out.append({
                "text": t, "desc": d,
                "cls": n.attrib.get("class", ""),
                "clickable": n.attrib.get("clickable") == "true",
                "bounds": bounds(n),
                "center": center(n),
                "rid": n.attrib.get("resource-id", ""),
            })
    return out

def show(path, only_clickable=False):
    for i, n in enumerate(nodes(path)):
        if only_clickable and not n["clickable"]: continue
        label = n["text"] or ("{" + n["desc"] + "}")
        print(f'{i:3d} {str(n["bounds"]):24s} c={int(n["clickable"])} {n["cls"].split(".")[-1]:12s} {label!r}')

def find(path, needle, exact=False):
    res = []
    for n in nodes(path):
        hay = (n["text"] + " " + n["desc"]).strip()
        if (hay == needle) if exact else (needle.lower() in hay.lower()):
            res.append(n)
    return res

def tap(x, y):
    sh("shell", "input", "tap", str(x), str(y))

def back():
    sh("shell", "input", "keyevent", "4")

def swipe(x1,y1,x2,y2,dur=300):
    sh("shell","input","swipe",str(x1),str(y1),str(x2),str(y2),str(dur))

if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "show"
    if cmd == "show":
        p = dump(sys.argv[2] if len(sys.argv) > 2 else "ui")
        show(p, only_clickable=("--click" in sys.argv))
    elif cmd == "find":
        p = os.path.join(BASE, "dumps", (sys.argv[3] if len(sys.argv) > 3 else "ui") + ".xml")
        for n in find(p, sys.argv[2]): print(n)
    elif cmd == "tap":
        tap(int(sys.argv[2]), int(sys.argv[3]))
    elif cmd == "tapname":
        p = os.path.join(BASE, "dumps", (sys.argv[3] if len(sys.argv) > 3 else "ui") + ".xml")
        r = find(p, sys.argv[2])
        if r and r[0]["center"]:
            print("tapping", r[0]["text"] or r[0]["desc"], r[0]["center"])
            tap(*r[0]["center"])
        else:
            print("not found")
    elif cmd == "back":
        back()
