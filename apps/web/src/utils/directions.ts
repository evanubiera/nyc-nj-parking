// WEB-10: driving directions to a facility in the common map apps. Each link carries only the facility's
// location; the app opens with the person's own location as the start, so ours is never sent (PRIV-1).
// Formats from each vendor's documentation, checked on 2026-11-04:
// - Google Maps URLs: https://developers.google.com/maps/documentation/urls/get-started
// - Apple unified Maps URLs (iOS 18.4 and later): https://developer.apple.com/documentation/mapkit/unified-map-urls
// - Waze deep links: https://developers.google.com/waze/deeplinks
import type { LatLng } from '@parking/api-client';

export type DirectionsApp = 'google' | 'apple' | 'waze';

export const DIRECTIONS_APPS: readonly DirectionsApp[] = ['google', 'apple', 'waze'];

export function directionsUrl(app: DirectionsApp, { lat, lng }: LatLng): string {
  const point = `${lat},${lng}`;
  switch (app) {
    case 'google':
      return `https://www.google.com/maps/dir/?${new URLSearchParams({ api: '1', destination: point, travelmode: 'driving' })}`;
    case 'apple':
      return `https://maps.apple.com/directions?${new URLSearchParams({ destination: point, mode: 'driving' })}`;
    case 'waze':
      return `https://www.waze.com/ul?${new URLSearchParams({ ll: point, navigate: 'yes' })}`;
  }
}
