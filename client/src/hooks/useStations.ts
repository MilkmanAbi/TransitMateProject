import { useEffect, useState } from 'react';

export interface Station {
  code: string;
  name: string;
  lat: number;
  lng: number;
  line: string;
}

let cache: Station[] | null = null;
let pending: Promise<Station[]> | null = null;

// Rail stations derived from OpenStreetMap (see scripts/build-mrt.py), bundled as a static asset.
export function useStations() {
  const [stations, setStations] = useState<Station[]>(cache ?? []);
  useEffect(() => {
    if (cache) return;
    pending ??= fetch('/mrt.json')
      .then((r) => r.json())
      .then((d: { stations: Station[] }) => (cache = d.stations));
    pending.then(setStations).catch(() => undefined);
  }, []);
  return stations;
}

export function stationNames(stations: Station[]) {
  return Object.fromEntries(stations.map((s) => [s.code, s.name]));
}
