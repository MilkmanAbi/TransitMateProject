// One canonical line table. TrainServiceAlerts and Station Crowd Density use different codes for the
// same physical line (see PS2 brief §2.4 "A trap"), so everything is mapped through here.
export interface LineInfo {
  id: string;
  name: string;
  short: string;
  color: string;
  alertCodes: string[];
  pcdCodes: string[];
}

export const LINES: LineInfo[] = [
  { id: 'NSL', name: 'North-South Line', short: 'NS', color: '#d42e12', alertCodes: ['NSL'], pcdCodes: ['NSL'] },
  { id: 'EWL', name: 'East-West Line', short: 'EW', color: '#009645', alertCodes: ['EWL', 'CGL'], pcdCodes: ['EWL', 'CGL'] },
  { id: 'NEL', name: 'North East Line', short: 'NE', color: '#9900aa', alertCodes: ['NEL'], pcdCodes: ['NEL'] },
  { id: 'CCL', name: 'Circle Line', short: 'CC', color: '#fa9e0d', alertCodes: ['CCL', 'CEL'], pcdCodes: ['CCL', 'CEL'] },
  { id: 'DTL', name: 'Downtown Line', short: 'DT', color: '#005ec4', alertCodes: ['DTL'], pcdCodes: ['DTL'] },
  { id: 'TEL', name: 'Thomson-East Coast Line', short: 'TE', color: '#9d5b25', alertCodes: ['TEL'], pcdCodes: ['TEL'] },
  { id: 'BPL', name: 'Bukit Panjang LRT', short: 'BP', color: '#748477', alertCodes: ['BPL', 'BPLRT'], pcdCodes: ['BPL'] },
  { id: 'SKLRT', name: 'Sengkang LRT', short: 'SK', color: '#748477', alertCodes: ['STL', 'SKLRT', 'SLRT'], pcdCodes: ['SLRT'] },
  { id: 'PGLRT', name: 'Punggol LRT', short: 'PG', color: '#748477', alertCodes: ['PTL', 'PGLRT', 'PLRT'], pcdCodes: ['PLRT'] },
];

const byAlert = new Map<string, LineInfo>();
for (const l of LINES) for (const c of [...l.alertCodes, ...l.pcdCodes, l.id]) byAlert.set(c.toUpperCase(), l);

export const lineFromAnyCode = (code: string): LineInfo | undefined => byAlert.get(code.trim().toUpperCase());
export const lineById = (id: string): LineInfo | undefined => LINES.find((l) => l.id === id);

// Station code → PCD (TrainLine, Station) pair. CE1/CE2 are now numbered CC34/CC33 in OSM.
export function pcdKeyForStation(code: string): { line: string; station: string } | undefined {
  const p = code.replace(/\d.*$/, '');
  if (code === 'CC34') return { line: 'CEL', station: 'CE1' };
  if (code === 'CC33') return { line: 'CEL', station: 'CE2' };
  const map: Record<string, string> = {
    NS: 'NSL', EW: 'EWL', CG: 'CGL', NE: 'NEL', CC: 'CCL', DT: 'DTL', TE: 'TEL', BP: 'BPL',
    SE: 'SLRT', SW: 'SLRT', STC: 'SLRT', PE: 'PLRT', PW: 'PLRT', PTC: 'PLRT',
  };
  const line = map[p] ?? map[code];
  return line ? { line, station: code } : undefined;
}
