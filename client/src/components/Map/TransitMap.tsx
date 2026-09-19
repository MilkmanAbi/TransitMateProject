import type { FeatureCollection } from 'geojson';
import L from 'leaflet';
import { useEffect, useState } from 'react';
import { CircleMarker, GeoJSON, MapContainer, Polyline, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import { api } from '@/api/datamall';
import type { RailEdge, Station } from '@/hooks/useStations';
import { CROWD_META, LINE_META } from '@/lib/format';
import type { CrowdLevel, StopSummary } from '@/types';
import { BaseLayer } from './BaseLayer';

const CROWD_FILL: Record<CrowdLevel, string> = { l: '#22c55e', m: '#f59e0b', h: '#ef4444', NA: '#64748b' };

function StopsLayer({ onStop }: { onStop: (s: StopSummary) => void }) {
  const map = useMap();
  const [stops, setStops] = useState<StopSummary[]>([]);
  const [zoom, setZoom] = useState(map.getZoom());
  const load = () => {
    setZoom(map.getZoom());
    if (map.getZoom() < 16) return setStops([]);
    const c = map.getCenter();
    api.nearStops(c.lat, c.lng, 700).then(setStops).catch(() => undefined);
  };
  useMapEvents({ moveend: load });
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (zoom < 16) return null;
  return (
    <>
      {stops.map((s) => (
        <CircleMarker
          key={s.code}
          center={[s.lat, s.lng]}
          radius={8}
          pathOptions={{ color: '#0b1220', weight: 2, fillColor: '#10b981', fillOpacity: 1 }}
          eventHandlers={{ click: () => onStop(s) }}
        >
          <Tooltip direction="top">
            {s.name} · {s.code}
          </Tooltip>
        </CircleMarker>
      ))}
    </>
  );
}

// Station footprint polygons from the NebulaX dataset (AmendmenttoMP2014RailStation.geojson), shown when zoomed in.
function Footprints() {
  const map = useMap();
  const [data, setData] = useState<FeatureCollection | null>(null);
  const [zoom, setZoom] = useState(map.getZoom());
  useMapEvents({ zoomend: () => setZoom(map.getZoom()) });
  useEffect(() => {
    if (zoom >= 15 && !data) fetch('/mrt-stations.geojson').then((r) => r.json()).then(setData).catch(() => undefined);
  }, [zoom, data]);
  if (zoom < 15 || !data) return null;
  return (
    <GeoJSON
      data={data}
      style={() => ({ color: '#60a5fa', weight: 1, fillColor: '#60a5fa', fillOpacity: 0.12 })}
      onEachFeature={(f, layer) => layer.bindTooltip(`${f.properties?.NAME} · ${String(f.properties?.GRND_LEVEL ?? '').toLowerCase()}`)}
    />
  );
}

// The network itself, in official line colours, so station dots read as a transit map rather than scatter.
function RailLines({ stations, edges, disrupted }: { stations: Station[]; edges: RailEdge[]; disrupted: Set<string> }) {
  const at = new Map(stations.map((s) => [s.code, [s.lat, s.lng] as [number, number]]));
  return (
    <>
      {edges.map((e) => {
        const a = at.get(e.a);
        const b = at.get(e.b);
        if (!a || !b) return null;
        const hit = disrupted.has(e.a) && disrupted.has(e.b);
        return (
          <Polyline
            key={`${e.a}-${e.b}`}
            positions={[a, b]}
            pathOptions={hit ? { color: '#ef4444', weight: 7, opacity: 1, dashArray: '2 9', lineCap: 'round' } : { color: LINE_META[e.line]?.color ?? '#94a3b8', weight: 4, opacity: 0.9 }}
          />
        );
      })}
    </>
  );
}

function Recenter({ to }: { to: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (to) map.flyTo(to, 17, { duration: 0.8 });
  }, [to, map]);
  return null;
}

export function TransitMap({
  stations,
  edges,
  crowd,
  disrupted,
  center,
  flyTo,
  onStop,
  onStation,
}: {
  stations: Station[];
  edges: RailEdge[];
  crowd: Record<string, CrowdLevel>;
  disrupted: Set<string>;
  center: [number, number];
  flyTo: [number, number] | null;
  onStop: (s: StopSummary) => void;
  onStation: (s: Station) => void;
}) {
  return (
    <MapContainer center={center} zoom={12} zoomControl={false} className="h-full w-full">
      <BaseLayer />
      <Recenter to={flyTo} />
      <Footprints />
      <RailLines stations={stations} edges={edges} disrupted={disrupted} />
      {stations
        .filter((s) => !['STC', 'PTC'].includes(s.code))
        .map((s) => {
          const key = s.code === 'CC34' ? 'CE1' : s.code === 'CC33' ? 'CE2' : s.code;
          const level = crowd[key] ?? 'NA';
          const hit = disrupted.has(s.code);
          return (
            <CircleMarker
              key={s.code}
              center={[s.lat, s.lng]}
              radius={hit ? 9 : 7}
              eventHandlers={{ click: () => onStation(s) }}
              pathOptions={{ color: hit ? '#ef4444' : (LINE_META[s.line]?.color ?? '#94a3b8'), weight: hit ? 4 : 2.5, fillColor: CROWD_FILL[level], fillOpacity: 0.95 }}
            >
              <Tooltip direction="top">
                {s.name} ({s.code}) · {hit ? 'DISRUPTED · ' : ''}
                {CROWD_META[level].label}
              </Tooltip>
            </CircleMarker>
          );
        })}
      <StopsLayer onStop={onStop} />
    </MapContainer>
  );
}

export const latLng = (lat: number, lng: number) => L.latLng(lat, lng);
