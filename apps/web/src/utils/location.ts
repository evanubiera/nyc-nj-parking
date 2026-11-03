// PRIV-3: the device's location is rounded to 3 decimal places (about 110 m by 85 m in NYC) before it
// leaves the browser. It's kept only in memory: never in the URL, storage, or logs (ADR-0006).

export interface Point {
  lat: number;
  lng: number;
}

export function roundCoordinate(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export function roundPoint(point: Point): Point {
  return { lat: roundCoordinate(point.lat), lng: roundCoordinate(point.lng) };
}
