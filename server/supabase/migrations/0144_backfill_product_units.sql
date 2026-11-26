-- 0144_backfill_product_units.sql
--
-- Product cards now show a pack-size / unit line, but most catalog rows were created before the
-- structured pack fields (0137) and have neither `unit` nor pack metadata. Backfill every empty
-- row deterministically:
--   1. Parse an explicit size/count out of the product name ("500g", "1L", "170ml", "10 Tabs",
--      "60 Capsules", "Pack of 6", "12 pcs", "1 dozen").
--   2. Otherwise fall back to a neutral sellable unit: "1 piece" (MART/PHARMA) or "1 serving"
--      (FOOD).
-- Existing non-empty `unit` / pack fields are never overwritten. Idempotent: re-running only
-- touches rows that are still empty.
--
-- Legacy rows have no pack metadata, so the fallback writes PIECE/1/piece unless the app is FOOD
-- (net_unit has no "serving", so FOOD keeps only the display string). Sellers can refine any row by
-- re-saving the Pack size step in the partner portal.
--
-- The logic lives in catalog.backfill_product_units() so the seed can call it after inserting its
-- rows; this migration runs it for databases that already had products.

create or replace function catalog.backfill_product_units() returns void
language plpgsql
as $$
declare
  r          record;
  m          text[];
  q          numeric;
  pt         text;
  nu         text;
  disp       text;
  kw         text;
  consumable boolean;
begin
  for r in
    select id, app::text as app, name, coalesce(category, '') as category
    from catalog.products
    where unit is null or btrim(unit) = ''
  loop
    q := null; pt := null; nu := null; disp := null;
    -- Capacity in an appliance/backpack name ("5L air fryer", "35L backpack") is a spec, not a
    -- pack size. Only trust weight/volume for consumable categories.
    consumable := r.app in ('FOOD', 'PHARMA') or r.category ~* '(grocery|fresh|produce|dairy|milk|bakery|snack|beverage|drink|juice|food|stapl|spice|oil|beauty|personal|care|baby|pet|health|medicine|vitamin|supplement|ayurved|wellness|nutrition|protein|household|clean|oral|tea|coffee|frozen|fruit|vegetable|meat|seafood|rice|atta|flour|sugar|salt|sauce|jam|chocolate|candy|ice cream|cereal|noodle|pasta|egg|farm|organic|garden|butcher|baker|yogurt|yoghurt|curd|cheese|paneer|butter|ghee|groc)';

    if consumable then
      -- Volume first, so "170ml" is never read as litres.
      m := regexp_match(r.name, '([0-9]+(?:\.[0-9]+)?)\s*(?:ml|millilitres?|milliliters?|millilitre|milliliter)\y', 'i');
      if m is not null then
        q := m[1]::numeric; pt := 'ML'; nu := 'ml';
        disp := trim_scale(q)::text || ' ml';
      end if;

      -- Mass.
      if disp is null then
        m := regexp_match(r.name, '([0-9]+(?:\.[0-9]+)?)\s*(?:kg|kgs|kilogram|kilograms)\y', 'i');
        if m is not null then
          q := m[1]::numeric; pt := 'KG'; nu := 'kg';
          disp := trim_scale(q)::text || ' kg';
        end if;
      end if;
      if disp is null then
        m := regexp_match(r.name, '([0-9]+(?:\.[0-9]+)?)\s*(?:g|gm|gms|gram|grams)\y');
        if m is null then
          -- Uppercase G only when whitespace-separated, so "5G Phones" is not misread as grams.
          m := regexp_match(r.name, '([0-9]+(?:\.[0-9]+)?)\s+(?:G|GM|GMS|GRAM|GRAMS|Gm|Gms|Gram|Grams)\y');
        end if;
        if m is not null then
          q := m[1]::numeric; pt := 'G'; nu := 'g';
          disp := trim_scale(q)::text || ' g';
        end if;
      end if;

      -- Litres (ml already handled above).
      if disp is null then
        m := regexp_match(r.name, '([0-9]+(?:\.[0-9]+)?)\s*(?:l|lt|ltr|litre|litres|liter|liters)\y', 'i');
        if m is not null then
          q := m[1]::numeric; pt := 'L'; nu := 'l';
          disp := trim_scale(q)::text || ' l';
        end if;
      end if;
    end if;

    -- Pack of N / Set of N.
    if disp is null then
      m := regexp_match(r.name, 'pack\s+of\s+([0-9]+)\y', 'i');
      if m is not null then
        q := m[1]::numeric; pt := 'PACKET'; nu := 'pack';
        disp := 'Pack of ' || trim_scale(q)::text;
      end if;
    end if;

    if disp is null then
      m := regexp_match(r.name, 'set\s+of\s+([0-9]+)\y', 'i');
      if m is not null then
        q := m[1]::numeric; pt := 'SET'; nu := 'piece';
        disp := 'Set of ' || trim_scale(q)::text;
      end if;
    end if;

    -- Counted pieces.
    if disp is null then
      m := regexp_match(r.name, '([0-9]+)\s*(?:pcs?|pieces?|pc)\y', 'i');
      if m is not null then
        q := m[1]::numeric; pt := 'PIECE'; nu := 'piece';
        disp := case when q = 1 then '1 piece' else trim_scale(q)::text || ' pieces' end;
      end if;
    end if;

    if disp is null then
      m := regexp_match(r.name, '([0-9]+)\s*dozen\y', 'i');
      if m is not null then
        q := m[1]::numeric; pt := 'DOZEN'; nu := 'piece';
        disp := 'Dozen (' || trim_scale(q)::text || ')';
      end if;
    end if;

    -- Capsules / tablets / gummies / strips / sachets / sheets / softgels (display-only: there is
    -- no matching structured net_unit for most of these).
    if disp is null then
      m := regexp_match(r.name, '([0-9]+)\s*(caps?|capsules?|tablets?|tabs?|gummies?|sachets?|strips?|sheets?|softgels?)\y', 'i');
      if m is null then
        m := regexp_match(r.name, '\(([0-9]+)\)');
        if m is not null then
          if r.name ~* 'capsule|softgel|\ycaps?\y' then
            kw := case when r.name ~* 'softgel' then 'softgels' else 'capsules' end;
          elsif r.name ~* 'tablet|\ytabs?\y' then
            kw := 'tablets';
          elsif r.name ~* 'strip' then
            kw := 'strips';
          elsif r.name ~* 'sachet' then
            kw := 'sachets';
          elsif r.name ~* 'gumm' then
            kw := 'gummies';
          elsif r.name ~* 'lozenge|pastille' then
            kw := 'lozenges';
          elsif r.name ~* 'chewable' then
            kw := 'tablets';
          elsif r.name ~* 'piece|\ypcs?\y' then
            kw := 'pieces';
          elsif r.name ~* '\ypack\y|combo|bundle|\yset\y|\ybooks?\y' then
            kw := 'pieces';
          else
            m := null;
          end if;
        end if;
      else
        kw := case
          when m[2] ilike 'cap%' then 'capsules'
          when m[2] ilike 'tab%' then 'tablets'
          when m[2] ilike 'gum%' then 'gummies'
          when m[2] ilike 'sach%' then 'sachets'
          when m[2] ilike 'strip%' then 'strips'
          when m[2] ilike 'sheet%' then 'sheets'
          when m[2] ilike 'soft%' then 'softgels'
          else null
        end;
      end if;
      if m is not null and kw is not null then
        q := m[1]::numeric;
        disp := trim_scale(q)::text || ' ' || kw;
      end if;
    end if;

    -- "(100p)" / "(2p)" shorthand for counted pieces.
    if disp is null then
      m := regexp_match(r.name, '\(([0-9]+)p\)', 'i');
      if m is not null then
        q := m[1]::numeric;
        disp := case when q = 1 then '1 piece' else trim_scale(q)::text || ' pieces' end;
      end if;
    end if;

    -- Neutral fallback so every sellable row has a unit line.
    if disp is null then
      if r.app = 'FOOD' then
        disp := '1 serving';
      else
        disp := '1 piece'; pt := 'PIECE'; nu := 'piece'; q := 1;
      end if;
    end if;

    update catalog.products
       set unit      = disp,
           pack_type = coalesce(nullif(pack_type, ''), pt),
           -- Count-only displays (capsules, sachets, lozenges) have no structured pack; do not
           -- leave a half-populated net_qty behind.
           net_qty   = case when pt is not null then coalesce(net_qty, q) else net_qty end,
           net_unit  = coalesce(nullif(net_unit, ''), nu)
     where id = r.id;
  end loop;
end;
$$;

select catalog.backfill_product_units();

-- Clean up orphan net_qty values from an earlier apply of this backfill (count-only rows).
update catalog.products
   set net_qty = null
 where pack_type is null
   and (net_unit is null or btrim(net_unit) = '')
   and net_qty is not null;
