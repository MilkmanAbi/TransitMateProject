import { lazy, Suspense, useEffect } from 'react';
import { Route, Routes } from 'react-router-dom';
import { Shell } from '@/components/Layout/Shell';
import { Skeleton } from '@/components/ui';
import { useLiveFeeds } from '@/hooks/useLiveFeeds';
import { useStore } from '@/store/useStore';
import Home from '@/pages/Home';
import StopPage from '@/pages/StopPage';

const JourneyPage = lazy(() => import('@/pages/JourneyPage'));
const AlertsPage = lazy(() => import('@/pages/AlertsPage'));
const MapPage = lazy(() => import('@/pages/MapPage'));

export default function App() {
  useLiveFeeds();
  const largeText = useStore((s) => s.largeText);
  useEffect(() => {
    document.documentElement.classList.toggle('large-text', largeText);
  }, [largeText]);

  return (
    <Shell>
      <Suspense fallback={<Skeleton className="mt-4 h-64" />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/plan" element={<JourneyPage />} />
          <Route path="/alerts" element={<AlertsPage />} />
          <Route path="/map" element={<MapPage />} />
          <Route path="/stop/:code" element={<StopPage />} />
          <Route path="*" element={<Home />} />
        </Routes>
      </Suspense>
    </Shell>
  );
}
