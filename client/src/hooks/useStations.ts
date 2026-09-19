import { useEffect, useState } from 'react';

export interface Station {
  code: string;
  name: string;
  lat: number;
  lng: number;
  line: string;
}

export interface RailEdge {
  a: string;
  b: string;
  line: string;
}
interface RailNet {
  stations: Station[];
  edges: RailEdge[];
}

let cache: RailNet | null = null;
let pending: Promise<RailNet> | null = null;

// Rail network derived from OpenStreetMap (see scripts/build-mrt.py), bundled as a static asset.
export function useRailNet(): RailNet {
  const [net, setNet] = useState<RailNet>(cache ?? { stations: [], edges: [] });
  useEffect(() => {
    if (cache) return;
    pending ??= fetch(`${import.meta.env.BASE_URL}mrt.json`)
      .then((r) => r.json())
      .then((d: RailNet) => (cache = { stations: d.stations, edges: d.edges }));
    pending.then(setNet).catch(() => undefined);
  }, []);
  return net;
}

export const useStations = () => useRailNet().stations;

export function stationNames(stations: Station[]) {
  return Object.fromEntries(stations.map((s) => [s.code, s.name]));
}
