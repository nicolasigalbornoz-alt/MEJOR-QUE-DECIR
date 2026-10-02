"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import L, { type GeoJSON as LeafletGeoJSON, type Layer, type Map as LeafletMap, type Path } from "leaflet";
import { PROVINCES, normalizeText } from "@/data/provinces";
import type { ProvinceReport, PublicReport } from "@/features/reports/types";

const RAMP = ["--seq-150", "--seq-250", "--seq-350", "--seq-450", "--seq-550", "--seq-650"];
const SITUATION: Record<number, string> = { 1: "Muy mala", 2: "Mala", 3: "Regular", 4: "Buena", 5: "Muy buena" };
const VISION: Record<number, string> = { [-2]: "Muy pesimista", [-1]: "Pesimista", 0: "Neutral", 1: "Optimista", 2: "Muy optimista" };

function cssVariable(name: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function bucket(count: number, max: number) {
  if (count <= 0) return -1;
  if (max <= 1) return RAMP.length - 1;
  return Math.min(RAMP.length - 1, Math.floor((Math.log(count) / Math.log(max)) * RAMP.length));
}

function topEntries(values: Record<string, number>, limit = 5) {
  return Object.entries(values).sort((a, b) => b[1] - a[1]).slice(0, limit);
}

function BarList({ values }: { values: Record<string, number> }) {
  const entries = topEntries(values);
  if (!entries.length) return <p className="empty-note">Todavía no hay respuestas suficientes para este distrito.</p>;
  const maximum = Math.max(...entries.map(([, value]) => value), 1);
  return (
    <ul className="bar-list">
      {entries.map(([label, value]) => (
        <li className="bar-row" key={label}>
          <div className="bar-row__top"><span className="label">{label}</span><span className="value">{value}</span></div>
          <div className="bar-track"><div className="bar-fill" style={{ width: `${Math.max(6, value / maximum * 100)}%` }} /></div>
        </li>
      ))}
    </ul>
  );
}

function ProvinceDetail({ province }: { province: ProvinceReport }) {
  const localities = Object.entries(province.localidades).sort((a, b) => b[1] - a[1]);
  const situation = province.situacionN ? SITUATION[Math.round(province.situacionSum / province.situacionN)] : "Sin datos";
  const vision = province.visionN ? VISION[Math.round(province.visionSum / province.visionN)] : "Sin datos";
  return (
    <>
      <span className="region-tag">Región {province.region}</span>
      <h3>{province.name}</h3>
      <div className="stat-row" style={{ margin: "14px 0 18px" }}>
        <div className="stat"><b>{province.count}</b><span>Respuestas</span></div>
        <div className="stat"><b className="stat-text">{situation}</b><span>Situación</span></div>
        <div className="stat"><b className="stat-text">{vision}</b><span>Visión país</span></div>
      </div>
      {localities.length > 0 && <><h4>Localidades</h4><div className="locality-chips">{localities.map(([name, count]) => <span className="locality-chip" key={name}>{name} <b>{count}</b></span>)}</div></>}
      <h4>Problemas más mencionados</h4><BarList values={province.problemas} />
      <h4>Necesidades más mencionadas</h4><BarList values={province.necesidades} />
      {province.quotes.length > 0 && <><h4>En sus palabras</h4>{province.quotes.slice(0, 3).map((quote, index) => <blockquote className="testimonio" key={`${quote.text}-${index}`}>“{quote.text}”{quote.localidad && <footer>({quote.localidad})</footer>}</blockquote>)}</>}
    </>
  );
}

function antarticaPath(radius: number) {
  const west = -74;
  const east = -25;
  const middle = (west + east) / 2;
  const point = (longitude: number) => {
    const angle = ((longitude - middle) * Math.PI) / 180;
    return [radius * Math.sin(angle), radius * Math.cos(angle)];
  };
  const [x1, y1] = point(west);
  const [x2, y2] = point(east);
  return `M 0 0 L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${radius} ${radius} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`;
}

function addAntarcticaControl(map: LeafletMap, fill: string, onClick: () => void) {
  const control = new L.Control({ position: "bottomright" });
  control.onAdd = () => {
    const element = L.DomUtil.create("div", "map-antartida is-clickable");
    element.innerHTML = `<svg viewBox="-16 -3 32 30" width="30" height="28" aria-hidden="true"><path d="${antarticaPath(22)}" fill="${fill}" stroke="#fff" stroke-width="1.5"></path></svg><span>Antártida Arg.</span>`;
    element.setAttribute("role", "button");
    element.setAttribute("tabindex", "0");
    element.setAttribute("aria-label", "Antártida Argentina — parte de Tierra del Fuego");
    L.DomEvent.disableClickPropagation(element);
    L.DomEvent.disableScrollPropagation(element);
    L.DomEvent.on(element, "click", onClick);
    L.DomEvent.on(element, "keydown", (rawEvent) => {
      const event = rawEvent as KeyboardEvent;
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onClick();
      }
    });
    return element;
  };
  control.addTo(map);
  return control;
}

export function FederalMap({ report }: { report: PublicReport }) {
  const mapElement = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<LeafletMap | null>(null);
  const provinceLayers = useRef<Record<string, Layer>>({});
  const searchBounds = useRef<Record<string, L.LatLngBounds>>({});
  const [selectedProvince, setSelectedProvince] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const selected = selectedProvince ? report.byProvince[selectedProvince] : null;
  const localities = useMemo(() => Object.values(report.byProvince)
    .flatMap((province) => Object.entries(province.localidades).map(([name, count]) => ({
      name, count, provinceId: province.id, provinceName: province.name,
    })))
    .sort((a, b) => b.count - a.count), [report.byProvince]);
  const matches = query.trim().length >= 2
    ? localities.filter((locality) => normalizeText(locality.name).includes(normalizeText(query))).slice(0, 8)
    : [];

  useEffect(() => {
    if (!mapElement.current) return;
    let map: LeafletMap | null = null;
    let provinceLayer: LeafletGeoJSON | null = null;
    let resizeObserver: ResizeObserver | null = null;
    const boundaryLayers: Record<string, Layer> = {};
    const loadedBoundaries = new Set<string>();
    let cancelled = false;

    async function initialize() {
      const response = await fetch("/assets/data/argentina-provincias.geojson", { cache: "force-cache" });
      if (!response.ok || !mapElement.current || cancelled) return;
      const geo = await response.json();
      map = L.map(mapElement.current, {
        zoomControl: true,
        attributionControl: false,
        minZoom: 4,
        maxZoom: 10,
        zoomSnap: 0.25,
        worldCopyJump: false,
      }).setView([-38.4, -63.6], 4);
      mapInstance.current = map;

      const baseStyle = (provinceId: string): L.PathOptions => {
        const count = report.byProvince[provinceId]?.count ?? 0;
        const index = bucket(count, report.maxCount);
        return {
          fillColor: index < 0 ? cssVariable("--seq-100") || "#cde2fb" : cssVariable(RAMP[index]),
          fillOpacity: 0.82,
          color: "#fff",
          weight: 1.2,
          dashArray: index < 0 ? "3,3" : undefined,
        };
      };

      const layers: Record<string, Layer> = {};
      const provinceBounds: Record<string, L.LatLngBounds> = {};
      provinceLayer = L.geoJSON(geo, {
        style: (feature) => baseStyle(String(feature?.properties?.id ?? "")),
        onEachFeature(feature, layer) {
          const id = String(feature.properties?.id ?? "");
          layers[id] = layer;
          if (id === "tierradelfuego" && feature.geometry.type === "MultiPolygon") {
            const mainland = L.latLngBounds([]);
            feature.geometry.coordinates.slice(0, 2).forEach((polygon) => polygon.forEach((ring) => ring.forEach(([longitude, latitude]) => mainland.extend([latitude, longitude]))));
            provinceBounds[id] = mainland;
          } else if ("getBounds" in layer && typeof layer.getBounds === "function") {
            provinceBounds[id] = layer.getBounds();
          }
          layer.on({
            click: () => {
              (layer as Path).setStyle({ weight: 3, color: cssVariable("--navy") || "#04537a" });
              setSelectedProvince(id);
            },
            mouseover: () => (layer as Path).setStyle({ weight: 2.4 }),
            mouseout: () => (layer as Path).setStyle(baseStyle(id)),
          });
        },
      }).addTo(map);
      map.fitBounds(provinceLayer.getBounds(), { padding: [12, 12] });

      const caba = PROVINCES.find((province) => province.id === "caba");
      if (caba?.point) {
        const count = report.byProvince.caba?.count ?? 0;
        const colorIndex = bucket(count, report.maxCount);
        const marker = L.circleMarker(caba.point, {
          radius: 9,
          fillColor: colorIndex < 0 ? cssVariable("--seq-100") : cssVariable(RAMP[colorIndex]),
          fillOpacity: 0.95,
          color: "#fff",
          weight: 2,
        }).addTo(map);
        marker.bindTooltip("CABA", { direction: "top", offset: [0, -6] });
        provinceBounds.caba = L.latLngBounds([caba.point, caba.point]);
        marker.on("click", () => {
          marker.setStyle({ weight: 3, color: cssVariable("--navy") || "#04537a" });
          setSelectedProvince("caba");
        });
        layers.caba = marker;
      }
      provinceLayers.current = layers;
      searchBounds.current = provinceBounds;

      const tierraDelFuego = report.byProvince.tierradelfuego;
      const tdfBucket = bucket(tierraDelFuego?.count ?? 0, report.maxCount);
      addAntarcticaControl(map, tdfBucket < 0 ? cssVariable("--seq-100") : cssVariable(RAMP[tdfBucket]), () => setSelectedProvince("tierradelfuego"));

      async function loadVisibleBoundaries() {
        if (!map || map.getZoom() < 6) {
          if (map) Object.values(boundaryLayers).forEach((layer) => map?.removeLayer(layer));
          return;
        }
        const view = map.getBounds();
        const visible = Object.entries(layers).filter(([, layer]) => {
          const candidate = layer as Layer & { getBounds?: () => L.LatLngBounds; getLatLng?: () => L.LatLng };
          try {
            return candidate.getBounds ? candidate.getBounds().intersects(view) : !!candidate.getLatLng && view.contains(candidate.getLatLng());
          } catch { return false; }
        }).map(([id]) => id).filter((id) => id !== "caba");

        for (const id of Object.keys(boundaryLayers)) {
          if (!visible.includes(id)) {
            map.removeLayer(boundaryLayers[id]);
            delete boundaryLayers[id];
          }
        }
        for (const id of visible) {
          if (loadedBoundaries.has(id)) continue;
          loadedBoundaries.add(id);
          const boundaryResponse = await fetch(`/assets/data/departamentos/${id}.geojson`, { cache: "force-cache" }).catch(() => null);
          if (!boundaryResponse?.ok || !map || map.getZoom() < 6) continue;
          const boundaryData = await boundaryResponse.json();
          boundaryLayers[id] = L.geoJSON(boundaryData, {
            interactive: false,
            style: { fill: false, color: cssVariable("--navy") || "#04537a", weight: 1, opacity: 0.55 },
          }).addTo(map);
        }
      }

      map.on("zoomend moveend", loadVisibleBoundaries);
      resizeObserver = new ResizeObserver(() => {
        window.setTimeout(() => {
          if (map && provinceLayer) {
            map.invalidateSize({ animate: false, pan: false });
            map.fitBounds(provinceLayer.getBounds(), { padding: [12, 12], animate: false });
          }
        }, 150);
      });
      resizeObserver.observe(mapElement.current);
    }

    initialize().catch((error) => console.error("No se pudo inicializar el mapa federal", error));
    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      map?.remove();
      mapInstance.current = null;
      provinceLayers.current = {};
      searchBounds.current = {};
    };
  }, [report]);

  useEffect(() => {
    const reset = () => {
      Object.entries(provinceLayers.current).forEach(([provinceId, layer]) => {
        const current = report.byProvince[provinceId];
        const count = current?.count ?? 0;
        const index = bucket(count, report.maxCount);
        const fill = index < 0 ? cssVariable("--seq-100") || "#cde2fb" : cssVariable(RAMP[index]);
        (layer as Path).setStyle?.({
          fillColor: fill,
          fillOpacity: 0.82,
          color: provinceId === selectedProvince ? (cssVariable("--navy") || "#04537a") : "#fff",
          weight: provinceId === selectedProvince ? 3 : provinceId === "caba" ? 2 : 1.2,
          dashArray: index < 0 ? "3,3" : undefined,
        });
      });
    };
    reset();
  }, [selectedProvince, report]);

  useEffect(() => {
    if (!selectedProvince) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setSelectedProvince(null); };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [selectedProvince]);

  function goToLocality(provinceId: string) {
    const province = report.byProvince[provinceId];
    setSelectedProvince(provinceId);
    setSearchOpen(false);
    setQuery("");
    const element = mapElement.current;
    if (!province || !element) return;
    const center = PROVINCES.find((item) => item.id === provinceId)?.point;
    if (center) return;
    const layer = provinceLayers.current[provinceId];
    const bounds = searchBounds.current[provinceId];
    if (bounds?.isValid()) mapInstance.current?.fitBounds(bounds, { padding: [24, 24], maxZoom: 9, animate: true });
    else if (layer && "getLatLng" in layer && typeof layer.getLatLng === "function") mapInstance.current?.setView(layer.getLatLng(), 9);
  }

  return (
    <>
      <div className="map-legend">
        <span>Sin respuestas</span>
        <span className="ramp">{["--seq-100", ...RAMP].map((color) => <span key={color} style={{ background: `var(${color})` }} />)}</span>
        <span>Más respuestas</span>
      </div>
      <div className="locality-search">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
        <input type="search" value={query} placeholder="Buscar tu localidad…" autoComplete="off" onFocus={() => setSearchOpen(true)} onChange={(event) => { setQuery(event.target.value); setSearchOpen(true); }} />
        {searchOpen && query.trim().length >= 2 && <div className="locality-results">
          {matches.length ? matches.map((locality) => <button className="locality-result" type="button" key={`${locality.provinceId}-${locality.name}`} onClick={() => goToLocality(locality.provinceId)}><span>{locality.name}</span><span className="muted small">{locality.provinceName} · {locality.count}</span></button>) : <p className="empty-note">No encontramos localidades con ese nombre.</p>}
        </div>}
      </div>
      <div ref={mapElement} className="map-canvas" aria-label="Mapa federal de respuestas" />
      <p className="muted center small">Acercá con dos dedos, arrastrá para moverte y tocá una provincia para ver su detalle.</p>
      {selected && <>
        <button className="sheet-backdrop is-open" type="button" aria-label="Cerrar detalle del distrito" onClick={() => setSelectedProvince(null)} />
        <section className="sheet is-open" role="dialog" aria-modal="true" aria-label={`Detalle de ${selected.name}`}>
          <div className="sheet__handle" />
          <button className="sheet__close" type="button" aria-label="Cerrar" onClick={() => setSelectedProvince(null)}>×</button>
          <div className="sheet__body" id="sheetBody"><ProvinceDetail province={selected} /></div>
        </section>
      </>}
    </>
  );
}
