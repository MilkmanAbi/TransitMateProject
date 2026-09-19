// Commuter reports: a crowd-sourced signal in Cloud Firestore (project travelmatedb-db265, asia-southeast1).
// Official feeds lag the platform by minutes; commuters see it first. Security rules only allow creating
// a validated report and incrementing its "confirms" count — no edits, no deletes, no personal data.
import { initializeApp } from 'firebase/app';
import { addDoc, collection, doc, getFirestore, increment, limit, onSnapshot, orderBy, query, serverTimestamp, Timestamp, updateDoc, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';

// Firebase web config is a public project identifier, not a secret; access is enforced by Firestore rules.
const app = initializeApp({
  apiKey: 'AIzaSyCkfc3Qyj1SQKAVFSc5iKgMOU1OmBnDEac',
  authDomain: 'travelmatedb-db265.firebaseapp.com',
  projectId: 'travelmatedb-db265',
  storageBucket: 'travelmatedb-db265.firebasestorage.app',
  messagingSenderId: '290440304979',
  appId: '1:290440304979:web:dc03680f5ec2f85f32e9a6',
});
const db = getFirestore(app);

export type ReportKind = 'crowded' | 'delay' | 'stopped' | 'lift' | 'aircon' | 'other';
export const REPORT_KINDS: { kind: ReportKind; label: string }[] = [
  { kind: 'delay', label: 'Train delayed' },
  { kind: 'stopped', label: 'Train stopped' },
  { kind: 'crowded', label: 'Platform packed' },
  { kind: 'lift', label: 'Lift / escalator down' },
  { kind: 'aircon', label: 'No aircon' },
  { kind: 'other', label: 'Other' },
];
export interface Report {
  id: string;
  kind: ReportKind;
  station: string;
  stationName: string;
  line: string;
  note: string;
  createdAt: number;
  confirms: number;
}

export function addReport(r: { kind: ReportKind; station: string; stationName: string; line: string; note?: string; lat: number; lng: number }) {
  return addDoc(collection(db, 'reports'), { ...r, note: (r.note ?? '').slice(0, 140), confirms: 0, createdAt: serverTimestamp() });
}
export const confirmReport = (id: string) => updateDoc(doc(db, 'reports', id), { confirms: increment(1) });

// Live subscription to the last 90 minutes of reports (older ones are no longer actionable).
export function useReports() {
  const [reports, setReports] = useState<Report[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const since = Timestamp.fromMillis(Date.now() - 90 * 60_000);
    const q = query(collection(db, 'reports'), where('createdAt', '>=', since), orderBy('createdAt', 'desc'), limit(60));
    return onSnapshot(
      q,
      (snap) => {
        setError(null);
        setReports(
          snap.docs.map((d) => {
            const x = d.data();
            return { id: d.id, kind: x.kind, station: x.station, stationName: x.stationName, line: x.line, note: x.note ?? '', confirms: x.confirms ?? 0, createdAt: (x.createdAt as Timestamp | null)?.toMillis() ?? Date.now() };
          }),
        );
      },
      (e) => setError(e.message),
    );
  }, []);
  return { reports, error };
}

export const kindLabel = (k: ReportKind) => REPORT_KINDS.find((x) => x.kind === k)?.label ?? k;
