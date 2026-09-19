import L from 'leaflet';
import { Fragment, useEffect } from 'react';
import { CircleMarker, MapContainer, Marker, Polyline, Tooltip, useMap } from 'react-leaflet';
import { BaseLayer } from './BaseLayer';
import type { LatLng, Place, RouteOption } from '@/types';


const pin = (label: string, color: string) =>
  L.divIcon({
    className: '',
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    html: `<div style="width:30px;height:30px;border-radius:9999px;background:${color};border:3px solid #0b1220;box-shadow:0 0 0 2px ${color}66;display:grid;place-items:center;color:#fff;font:700 13px system-ui">${label}</div>`,
  });

function Fit({ points }: { points: LatLng[] }) {
  const map = useMap();
  const key = points.length ? `${points[0]}|${points[points.length - 1]}|${points.length}` : '';
  useEffect(() => {
    if (points.length > 1) map.fitBounds(L.latLngBounds(points), { padding: [28, 28], maxZoom: 16 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return null;
}

export function RouteMap({ option, usual, from, to, height = '40dvh' }: { option: RouteOption | null; usual?: RouteOption | null; from: Place; to: Place; height?: string }) {
  const pts: LatLng[] = [[from.lat, from.lng], [to.lat, to.lng], ...(option?.legs.flatMap((l) => l.path) ?? [])];
  return (
    <div className="relative overflow-hidden rounded-2xl ring-1 ring-white/10" style={{ height }}>
      <MapContainer center={[from.lat, from.lng]} zoom={13} zoomControl={false} className="h-full w-full" attributionControl>
        <BaseLayer />
        <Fit points={pts} />
        {usual &&
          usual.legs
            .filter((l) => l.mode !== 'walk')
            .map((l, i) => <Polyline key={`u${i}`} positions={l.path} pathOptions={{ color: '#94a3b8', weight: 4, opacity: 0.45, dashArray: '6 8' }} />)}
        {usual?.legs.flatMap((l, i) =>
          (l.affectedPaths ?? []).map((p, j) => (
            <Polyline key={`a${i}-${j}`} positions={p} pathOptions={{ color: '#ef4444', weight: 7, opacity: 0.95, dashArray: '2 9', lineCap: 'round' }}>
              <Tooltip sticky>{l.blocked ? 'No train service' : l.delayMin ? `Delays +${l.delayMin} min` : 'Affected'}</Tooltip>
            </Polyline>
          )),
        )}
        {option?.legs.map((l, i) => {
          if (l.mode === 'walk')
            return <Polyline key={i} positions={l.path} pathOptions={{ color: '#1f1c17', weight: 4, opacity: 0.85, dashArray: '1 7', lineCap: 'round' }} />;
          const color = l.mode === 'bus' ? '#10b981' : l.mode === 'shuttle' ? '#f59e0b' : (l.color ?? '#60a5fa');
          return (
            <Fragment key={i}>
              <Polyline positions={l.path} pathOptions={{ color: '#faf7f1', weight: 10, opacity: 0.95 }} />
              <Polyline positions={l.path} pathOptions={{ color, weight: 6, opacity: 1, dashArray: l.mode === 'shuttle' ? '10 8' : undefined }}>
                <Tooltip sticky>{l.mode === 'bus' ? `Bus ${l.service}` : l.lineName}</Tooltip>
              </Polyline>
            </Fragment>
          );
        })}
        {option?.legs.flatMap((l, i) =>
          (l.affectedPaths ?? []).map((p, j) => <Polyline key={`oa${i}-${j}`} positions={p} pathOptions={{ color: '#f59e0b', weight: 3, opacity: 1, dashArray: '2 6' }} />),
        )}
        {option?.legs
          .filter((l) => l.mode !== 'walk')
          .flatMap((l, i) => [
            <CircleMarker key={`s${i}`} center={[l.from.lat, l.from.lng]} radius={6} pathOptions={{ color: '#0b1220', weight: 2, fillColor: '#fff', fillOpacity: 1 }}>
              <Tooltip direction="top">{l.from.name}</Tooltip>
            </CircleMarker>,
            <CircleMarker key={`e${i}`} center={[l.to.lat, l.to.lng]} radius={6} pathOptions={{ color: '#0b1220', weight: 2, fillColor: '#fff', fillOpacity: 1 }}>
              <Tooltip direction="top">{l.to.name}</Tooltip>
            </CircleMarker>,
          ])}
        <Marker position={[from.lat, from.lng]} icon={pin('A', '#2563eb')} />
        <Marker position={[to.lat, to.lng]} icon={pin('B', '#db2777')} />
      </MapContainer>
      {usual && (
        <div className="pointer-events-none absolute left-2 top-2 z-[500] space-y-1 rounded-xl bg-surface/85 px-2.5 py-1.5 text-[0.6875rem] text-slate-300 backdrop-blur">
          <p className="flex items-center gap-1.5">
            <span className="inline-block h-1 w-5 rounded bg-brand-400" /> Recommended
          </p>
          <p className="flex items-center gap-1.5">
            <span className="inline-block w-5 border-t-2 border-dashed border-slate-400" /> Usual route
          </p>
          <p className="flex items-center gap-1.5">
            <span className="inline-block w-5 border-t-[3px] border-dotted border-red-500" /> Disrupted
          </p>
        </div>
      )}
    </div>
  );
}
