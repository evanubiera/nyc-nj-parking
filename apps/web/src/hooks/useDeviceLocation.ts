import { useCallback, useState } from 'react';
import { roundPoint, type Point } from '../utils/location.ts';

export type LocationState =
  | { status: 'idle' }
  | { status: 'locating' }
  | { status: 'found'; point: Point }
  | { status: 'denied' | 'unavailable' | 'unsupported' };

/** WEB-4. The point is rounded as soon as it arrives (PRIV-3) and is kept only in memory. */
export function useDeviceLocation(
  geolocation: Geolocation | undefined = globalThis.navigator?.geolocation,
  onFound?: (point: Point) => void,
) {
  const [state, setState] = useState<LocationState>({ status: 'idle' });
  const reset = useCallback(() => setState({ status: 'idle' }), []);

  const locate = useCallback(() => {
    if (!geolocation) {
      setState({ status: 'unsupported' });
      return;
    }
    setState({ status: 'locating' });
    geolocation.getCurrentPosition(
      (position) => {
        const point = roundPoint({ lat: position.coords.latitude, lng: position.coords.longitude });
        setState({ status: 'found', point });
        onFound?.(point);
      },
      (error) => setState({ status: error.code === error.PERMISSION_DENIED ? 'denied' : 'unavailable' }),
      // A coarse fix is enough after rounding, and is quicker and lighter on the battery.
      { enableHighAccuracy: false, timeout: 15_000, maximumAge: 60_000 },
    );
  }, [geolocation, onFound]);

  return { state, locate, reset };
}
