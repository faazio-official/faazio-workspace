#!/usr/bin/env python3
import json, re, collections, datetime, os
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.table import Table, TableStyleInfo

BASE=os.path.dirname(os.path.abspath(__file__))
DB=os.path.join(BASE,'capture_data.json')
OUT=os.path.abspath(os.path.join(BASE,'..','MART_TAXONOMY_DB_EXPORT.xlsx'))

db=json.load(open(DB))
top=json.load(open('/tmp/opencode/topcats.json'))
items=top['items']; markers=top['markers']

SECTION_FIX={'': 'Kitchenware'}
def section_of(marker):
    return SECTION_FIX.get(markers.get(marker,''), markers.get(marker,''))

# ordered categories
cats=[]
seen=set()
for marker,label,slug in items:
    v=db.get(slug,{})
    sec=section_of(marker)
    cats.append({'section':sec,'label':label,'slug':slug,'data':v})
    seen.add(slug)

def unit_type(u):
    x=re.sub(r'^[\d.]+\s*','',u).strip().lower()
    if x in ('g','kg','mg'): return 'Weight'
    if x in ('ml','l','litre','liter'): return 'Volume'
    if x.startswith('piece') or x in ('pc','pcs','n'): return 'Count / Pack'
    if x.startswith('pack') or x=='x': return 'Count / Pack'
    return 'Other'

# aggregate
cat_units={c['slug']:c['data'].get('units',[]) for c in cats}
cat_types={s:sorted({unit_type(u) for u in us}) for s,us in cat_units.items()}
all_units=collections.Counter()
unit_examples=collections.defaultdict(list)
for c in cats:
    for u in cat_units[c['slug']]:
        all_units[u]+=1
    for p in c['data'].get('sample_products',[]):
        u=p.get('unit')
        if u and len(unit_examples[u])<3:
            unit_examples[u].append(f"{p.get('name','')} (₹{p.get('price','')})")

sub_rows=[]
for c in cats:
    sec=c['section']; lab=c['label']; slug=c['slug']; v=c['data']
    subs=v.get('subcats',[])
    us=cat_units[slug]; ut=', '.join(cat_types[slug])
    for i,s in enumerate(subs,1):
        sub_rows.append([ 'MART','Mart Taxonomy', sec, lab, slug, s, i, ', '.join(us), ut, '', '', '', 'Needs GST mapping', 'JioMart Android 3.4.9 (com.jpl.jiomart)' ])

# ---------- styling helpers ----------
HFILL=PatternFill('solid',fgColor='1F4E78')
HFONT=Font(color='FFFFFF',bold=True,size=11)
HFONT2=Font(color='FFFFFF',bold=True,size=14)
TITLEFILL=PatternFill('solid',fgColor='2E75B6')
THIN=Side(style='thin',color='D9D9D9')
BORDER=Border(left=THIN,right=THIN,top=THIN,bottom=THIN)
ALT=PatternFill('solid',fgColor='F2F7FB')

def add_sheet(wb,name,headers,rows,widths=None,title=None,wrap_cols=None,filters=True):
    ws=wb.create_sheet(name)
    r0=1
    if title:
        ws.merge_cells(start_row=1,start_column=1,end_row=1,end_column=len(headers))
        c=ws.cell(1,1,title); c.font=HFONT2; c.fill=TITLEFILL; c.alignment=Alignment(vertical='center')
        ws.row_dimensions[1].height=24
        r0=2
    for j,h in enumerate(headers,1):
        c=ws.cell(r0,j,h); c.fill=HFILL; c.font=HFONT; c.border=BORDER
        c.alignment=Alignment(vertical='center',horizontal='center',wrap_text=True)
    ws.row_dimensions[r0].height=28
    for i,row in enumerate(rows,1):
        rr=r0+i
        for j,val in enumerate(row,1):
            c=ws.cell(rr,j,val); c.border=BORDER
            c.alignment=Alignment(vertical='top',wrap_text=(wrap_cols is None or j in wrap_cols))
            if i%2==0: c.fill=ALT
    if widths:
        for j,w in enumerate(widths,1):
            ws.column_dimensions[get_column_letter(j)].width=w
    if filters and rows:
        ws.auto_filter.ref=f"A{r0}:{get_column_letter(len(headers))}{r0+len(rows)}"
    ws.freeze_panes=ws.cell(r0+1,1)
    return ws

wb=Workbook()
wb.remove(wb.active)

# ---- Notes / README ----
ws=wb.create_sheet('README')
ws.column_dimensions['A'].width=28; ws.column_dimensions['B'].width=110
ws['A1']='MART TAXONOMY — JioMart App Capture'; ws['A1'].font=Font(size=16,bold=True,color='1F4E78')
notes=[
 ('Source','JioMart Android app v3.4.9 (package com.jpl.jiomart), device JKM-LX1, Android 9.'),
 ('Capture date', datetime.date.today().isoformat()),
 ('Method','UI crawled page-by-page over USB (adb + uiautomator): Home → Categories → each category → left-nav subcategory list + product unit labels.'),
 ('Coverage','All 11 top-level sections, all 77 L2 categories, and all L3 subcategories exposed on the category left navigation at the delivery location "sirudayur, Lalgudi, Tamil Nadu 621601".'),
 ('Counts', f"{len(cats)} categories, {len(sub_rows)} subcategories, {len(all_units)} distinct unit labels observed."),
 ('Units caveat','Units are the pack-size labels seen on product cards while scrolling the first ~50-60 products of each category (labelled "Category_Units_Observed (sample)"). They are representative, not an exhaustive per-SKU list.'),
 ('GST','GST columns mirror the food catalog schema but are intentionally left blank: JioMart does not expose GST. Fill them during mart catalog setup. Status = "Needs GST mapping".'),
 ('Products','"Sample_Products" is a small reference set captured alongside units, not a product master.'),
 ('Not included','Brands, prices, offers, and full SKU lists are out of scope per request (categories / subcategories / units only).'),
 ('ShopAll','The ShopAll tab exposes 12 marketplace verticals (see JioMart_Verticals). The deep L3 + unit pass in this workbook covers the Groceries vertical; ShopAll_Extra_Categories lists extra curated categories without an L3/unit pass.'),
 ('Section note','The "Kitchenware" section header scrolled under the sticky bar during capture; it was verified manually and applied to Gas Stove, Pots & Pans, Containers & Storage, Flask/Bottle/Tiffin, Cutting & Chopping, Kitchen Tools.'),
 ('Region caveat','JioMart assortment is location-dependent. Re-capture from another pincode can add/remove categories.'),
]
ws['A3']='Field'; ws['B3']='Value'
for c in ('A3','B3'):
    ws[c].fill=HFILL; ws[c].font=HFONT; ws[c].border=BORDER
r=4
for k,val in notes:
    ws.cell(r,1,k).font=Font(bold=True); ws.cell(r,1).border=BORDER
    ws.cell(r,2,val).alignment=Alignment(wrap_text=True,vertical='top'); ws.cell(r,2).border=BORDER
    r+=1

# ---- main atomic taxonomy ----
add_sheet(wb,'mart_atomic_taxonomy',
 ['App','Record_Type','Section_L1','Category_L2','Category_Slug','Sub_Category_L3','Sub_Category_Index','Category_Units_Observed (sample)','Unit_Types','GST_Category_Name','GST_Slug','GST_Rate','GST_Rule_Status','Source'],
 sub_rows,
 widths=[8,16,22,30,26,30,10,42,18,20,18,9,20,34],
 title='Mart atomic taxonomy (one row per L3 subcategory)')

# ---- Sections ----
sec_order=[]
sec_map=collections.OrderedDict()
for c in cats:
    s=c['section']
    if s not in sec_map: sec_map[s]={'cats':[],'subs':0,'units':set()}; sec_order.append(s)
    sec_map[s]['cats'].append(c['label']); sec_map[s]['subs']+=len(c['data'].get('subcats',[]))
    sec_map[s]['units'].update(cat_units[c['slug']])
rows=[[s,len(m['cats']),m['subs'],len(m['units']),', '.join(m['cats'])] for s,m in sec_map.items()]
add_sheet(wb,'Sections',['Section_L1','Category_Count','Subcategory_Count','Distinct_Units','Categories'],rows,
          widths=[24,14,16,14,90],title='Top-level sections (L1)')

# ---- Categories ----
rows=[]
for c in cats:
    v=c['data']
    rows.append([c['section'],c['label'],c['slug'],len(v.get('subcats',[])),len(cat_units[c['slug']]),
                 ', '.join(cat_units[c['slug']]), ', '.join(cat_types[c['slug']]),
                 v.get('page_title',''), v.get('layout',''), 'JioMart 3.4.9'])
add_sheet(wb,'Categories',['Section_L1','Category_L2','Category_Slug','Subcategory_Count','Units_Count','Units_Observed','Unit_Types','Page_Title','Layout','Source'],rows,
          widths=[22,32,26,14,11,46,18,30,10,16],title='Categories (L2)')

# ---- Subcategories ----
rows=[]
for c in cats:
    v=c['data']
    for i,s in enumerate(v.get('subcats',[]),1):
        rows.append([c['section'],c['label'],c['slug'],s,i,', '.join(cat_units[c['slug']]),', '.join(cat_types[c['slug']])])
add_sheet(wb,'Subcategories',['Section_L1','Category_L2','Category_Slug','Sub_Category_L3','Index','Category_Units_Observed (sample)','Unit_Types'],rows,
          widths=[22,32,26,34,7,46,18],title='Subcategories (L3)')

# ---- Units ----
rows=[]
for u,cnt in sorted(all_units.items(), key=lambda x:(-x[1],x[0])):
    ecats=[c['label'] for c in cats if u in cat_units[c['slug']]]
    rows.append([u,unit_type(u),cnt,', '.join(ecats), ' | '.join(unit_examples.get(u,[]))])
add_sheet(wb,'Units',['Unit','Unit_Type','Category_Count','Categories','Example_Products'],rows,
          widths=[14,14,14,80,80],title='Distinct unit labels observed across categories')

# ---- Sample products ----
rows=[]
for c in cats:
    for p in c['data'].get('sample_products',[]):
        rows.append([c['section'],c['label'],p.get('unit',''),p.get('price',''),p.get('name','')])
add_sheet(wb,'Sample_Products',['Section_L1','Category_L2','Unit','Price_INR','Product_Name'],rows,
          widths=[22,32,14,12,70],title='Reference product cards seen while capturing units (not a product master)')

# ---- Capture log ----
rows=[]
for c in cats:
    v=c['data']
    rows.append([c['label'],c['slug'],c['section'],v.get('layout',''),v.get('page_title',''),
                 len(v.get('subcats',[])),len(v.get('units',[])),len(v.get('sample_products',[])),
                 'YES' if v.get('suspect') else '', v.get('error',''),'JioMart 3.4.9 / com.jpl.jiomart'])
add_sheet(wb,'Capture_Log',['Category_L2','Category_Slug','Section_L1','Layout','Page_Title','Subcategories','Units','Sample_Products','Suspect','Error','Source'],rows,
          widths=[32,26,22,10,30,13,8,15,10,20,28],title='Per-category capture log')


# ---- JioMart verticals (ShopAll) ----
verticals=['Groceries','Fashion','Electronics','Home & Lifestyle','Industrial & Professional Supplies','Furniture','Wellness','Jewellery','Sports, Toys & Luggage','Crafts of India','Local Shops','Books, Music & Stationery']
vrows=[[v,'ShopAll → Categories (left rail)','Deep L3 + units captured in this workbook' if v=='Groceries' else 'Category tree only — L3/units not captured this pass'] for v in verticals]
add_sheet(wb,'JioMart_Verticals',['Vertical','Where_Seen','Coverage'],vrows,
          widths=[40,34,60],title='JioMart marketplace verticals (ShopAll tab)')

# ---- Extra ShopAll categories ----
extra=[('Cooking Essentials','Combo Offers','combo-offers-l2'),
       ('Beauty','Personal Care','personal-care-l2'),
       ('Tableware','Glassware & Drinkware','glassware-drinkware'),
       ('Tableware','Table Accessories','table-accessories'),
       ('Tableware','Serveware','serveware'),
       ('School, Office & Stationery',"Children's Books",'children-s-books'),
       ('School, Office & Stationery','School & Art Supplies','school-art-supplies-l2'),
       ('School, Office & Stationery','School Textbooks','school-textbooks'),
       ('Fashion Jewellery','Handmade Jewellery','handmade-jewellery'),
       ('Fashion Jewellery','Imitation Jewellery','imitation-jewellery'),
       ('Crafts of India','Kitchenware','kitchenware'),
       ('Crafts of India','Other Stationery','other-stationery-l2'),
       ('Crafts of India','Bottles, Boxes & Containers','bottles-boxes-containers'),
       ('Books','Fiction Books','fiction-books'),
       ('Books','Textbooks','textbooks'),
       ('Pet Care','Dogs','dogs'),
       ('Kitchen & Dining','Kitchen Tools & Accessories','kitchen-tools-accessories-l2'),
       ('Beverages','Nutritional Drinks','nutritional-drinks')]
erows=[[ 'MART','Mart Taxonomy (ShopAll extra)', sec, lab, slug, '', '', '', 'Needs GST mapping',
         'JioMart 3.4.9 — ShopAll curated view (L3/units not captured)'] for sec,lab,slug in extra]
add_sheet(wb,'ShopAll_Extra_Categories',
 ['App','Record_Type','Section_L1','Category_L2','Category_Slug','Units_Observed','Unit_Types','GST_Rate','GST_Rule_Status','Source'],
 erows, widths=[8,28,24,32,28,14,12,9,20,52],
 title='Extra categories seen only in the ShopAll curated view (partial — no L3/units pass)')

wb.save(OUT)
print('WROTE',OUT)
print('sheets',wb.sheetnames)
PY_END_MARKER = None
