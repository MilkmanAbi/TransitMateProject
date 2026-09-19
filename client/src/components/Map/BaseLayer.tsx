// DEVIATION: CARTO raster basemaps now require an API key, and tile.openstreetmap.org forbids app traffic
// (PS2 §2.3). We use the OSM France humanitarian (HOT) raster tiles — OpenStreetMap data, community-hosted,
// fine for demo-level load — darkened with a CSS filter so the map matches the UI.
import L from 'leaflet';
import { useEffect } from 'react';
import { useMap } from 'react-leaflet';

export const OSM_ATTRIB =
  'Map data © <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap contributors</a> · Tiles: <a href="https://www.openstreetmap.fr/" target="_blank">OSM France</a> / HOT';

export function BaseLayer() {
  const map = useMap();
  useEffect(() => {
    const layer = L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
      subdomains: 'abc',
      maxZoom: 19,
      className: 'tm-dark-tiles',
      attribution: OSM_ATTRIB,
    }).addTo(map);
    map.attributionControl?.setPrefix(false);
    return () => {
      layer.remove();
    };
  }, [map]);
  return null;
}
