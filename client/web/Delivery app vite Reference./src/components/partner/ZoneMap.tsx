import { useState } from "react";
import { Crosshair, Maximize, Minus, Plus, Store, MapPin } from "lucide-react";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { Button } from "@/components/ui/button";
import { assignedZone } from "@/mocks";

export function ZoneMap() {
  const [scale, setScale] = useState(1);
  const zone = assignedZone;
  return <div className="zone-map relative min-h-0 flex-1 overflow-hidden">
    <TransformWrapper initialScale={1} minScale={1} maxScale={4} centerOnInit wheel={{ step: 0.08 }} doubleClick={{ mode: "zoomIn", step: 0.5 }} onTransform={(_, state) => setScale(state.scale)}>
      {({ zoomIn, zoomOut, resetTransform, zoomToElement }) => <>
        <TransformComponent wrapperClass="!h-full !w-full" contentClass="!h-full !w-full">
          <svg className="zone-map-art h-full w-full" viewBox="0 0 860 1500" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Illustrative delivery zone around Karaikal with a mock rider location">
            <rect width="860" height="1500" className="zone-land" />
            <path d="M715 0 C695 220 755 410 710 640 S675 940 655 1140 S645 1370 610 1500 H860 V0Z" className="zone-sea" />
            <path d="M0 915 C140 820 250 910 400 850 S600 780 705 825" className="zone-river" />
            <path d="M30 200 L170 160 L180 310 L80 350Z M55 750 L205 715 L235 880 L90 940Z M400 1190 L555 1170 L570 1370 L440 1390Z" className="zone-park" />
            <g className="zone-blocks">
              {Array.from({ length: 12 }, (_, row) => Array.from({ length: 6 }, (_, col) => <rect key={`${row}-${col}`} x={45 + col * 100} y={95 + row * 110} width="64" height="65" rx="8" transform={`rotate(-6 ${77 + col * 100} ${127 + row * 110})`} />))}
            </g>
            <g fill="none" strokeLinecap="round" className="zone-road-casing">{zone.roads.map((d) => <path key={d} d={d} />)}</g>
            <g fill="none" strokeLinecap="round" className="zone-roads">{zone.roads.map((d) => <path key={d} d={d} />)}</g>
            <path d={zone.roads[0]} fill="none" className="zone-highway" />
            <polygon points={zone.boundary.map(([x, y]) => `${x},${y}`).join(" ")} className="zone-boundary" strokeLinejoin="round" />
            <g className="zone-labels" textAnchor="middle">
              {zone.landmarks.map((landmark) => <g key={landmark.name} transform={`translate(${landmark.x} ${landmark.y})`}>
                {landmark.kind === "restaurant" && <><circle r="18" cy="-25" className="zone-restaurant" /><path d="M-6 -31v12m6-12v12m6-12v12m-12-7h12" className="zone-restaurant-glyph" fill="none" strokeWidth="2" /></>}
                <text className={landmark.kind === "town" ? "zone-town" : "zone-place"}>{landmark.name}</text>
              </g>)}
              <text x="780" y="580" transform="rotate(90 780 580)" className="zone-water-label">BAY OF BENGAL</text>
            </g>
            <g id="zone-rider" transform={`translate(${zone.rider.x} ${zone.rider.y})`}>
              <circle r="44" className="zone-rider-halo" /><circle r="20" className="zone-rider-dot" />
              <path d="M0 -11 L8 8 L0 4 L-8 8Z" className="zone-rider-arrow" />
            </g>
          </svg>
        </TransformComponent>
        <div className="pointer-events-none absolute inset-x-4 top-4 flex items-start justify-between gap-3">
          <span className="rounded-md border bg-card/95 px-3 py-2 text-[10px] font-semibold shadow-card">Assigned delivery zone</span>
          <div className="pointer-events-auto flex flex-col overflow-hidden rounded-md border bg-card shadow-card">
            <Button variant="ghost" size="icon" className="h-10 w-10 rounded-none" aria-label="Zoom in" title="Zoom in" disabled={scale >= 3.99} onClick={() => zoomIn(0.35)}><Plus /></Button>
            <span className="border-t" />
            <Button variant="ghost" size="icon" className="h-10 w-10 rounded-none" aria-label="Zoom out" title="Zoom out" disabled={scale <= 1.01} onClick={() => zoomOut(0.35)}><Minus /></Button>
          </div>
        </div>
        <div className="absolute bottom-44 left-4 flex flex-col gap-2">
          <Button variant="outline" size="icon" className="h-12 w-12 rounded-full bg-card shadow-card" aria-label="Recenter on rider" title="Recenter on rider" onClick={() => zoomToElement("zone-rider", 2, 300)}><Crosshair className="!h-5 !w-5 text-primary" /></Button>
          <Button variant="outline" size="icon" className="h-10 w-10 rounded-full bg-card shadow-card" aria-label="Fit entire zone" title="Fit entire zone" onClick={() => resetTransform(300)}><Maximize /></Button>
        </div>
      </>}
    </TransformWrapper>
    <section className="absolute inset-x-0 bottom-0 border-t bg-card/95 px-5 pb-5 pt-4 backdrop-blur-md" aria-label="Assigned zone details">
      <div className="flex items-center justify-between gap-2"><p className="text-[10px] font-bold text-primary">YOUR OPERATING ZONE</p><span className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground"><span className="h-1.5 w-1.5 rounded-full bg-success" />{zone.demand}</span></div>
      <h2 className="mt-2 text-xl font-bold">{zone.name}</h2>
      <p className="mt-1 text-xs text-muted-foreground">{zone.district}</p>
      <div className="mt-4 flex items-center justify-between gap-2 border-t pt-3 text-[11px]"><span className="flex items-center gap-1.5"><Store className="h-3.5 w-3.5 text-primary" />{zone.activeRestaurants} active restaurants</span><span className="flex items-center gap-1 text-muted-foreground"><MapPin className="h-3 w-3" />Illustrative · Mock location</span></div>
    </section>
  </div>;
}