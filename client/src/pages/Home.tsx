import { ArrivalPanel } from '@/components/Arrivals/ArrivalPanel';
import { SectionTitle } from '@/components/ui';
import { useStore } from '@/store/useStore';

export default function Home() {
  const savedStops = useStore((s) => s.savedStops);
  return (
    <div className="animate-rise">
      <SectionTitle>Your stops</SectionTitle>
      <div className="space-y-3">
        {savedStops.map((c) => (
          <ArrivalPanel key={c} code={c} compact limit={5} />
        ))}
      </div>
    </div>
  );
}
