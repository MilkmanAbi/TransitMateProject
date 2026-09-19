import { ChevronLeft } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrivalPanel } from '@/components/Arrivals/ArrivalPanel';

export default function StopPage() {
  const { code = '' } = useParams();
  const nav = useNavigate();
  return (
    <div className="animate-rise">
      <button onClick={() => nav(-1)} className="-ml-2 mb-2 flex h-11 items-center gap-1 rounded-full px-2 text-sm text-slate-300 active:bg-white/10">
        <ChevronLeft size={20} /> Back
      </button>
      <ArrivalPanel code={code} />
      <p className="mt-3 px-1 text-[0.75rem] leading-relaxed text-slate-400">
        Live from LTA DataMall <code>v3/BusArrival</code>, refreshed every 30 s. “≈” = timetable estimate, not GPS-tracked. Load bars: 1 seats · 2 standing · 3 packed.
      </p>
    </div>
  );
}
