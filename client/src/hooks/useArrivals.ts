import { api } from '@/api/datamall';
import { usePoll } from './usePoll';

export const useArrivals = (stop: string | null | undefined) =>
  usePoll(stop ? () => api.arrivals(stop) : null, 30_000, [stop]);
