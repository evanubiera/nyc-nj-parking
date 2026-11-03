// A stand-in for maplibre-gl in tests: jsdom has no WebGL. It records what the app asks of the map
// and lets a test tap it. Use with vi.mock('maplibre-gl', () => import('../test/maplibre.ts')).

export const maps: FakeMap[] = [];
export const markers: FakeMarker[] = [];

export let workerUrl: string | null = null;

export function setWorkerUrl(url: string): void {
  workerUrl = url;
}

export function resetMaps(): void {
  maps.length = 0;
  markers.length = 0;
}

type Handler = (event: { lngLat: { lat: number; lng: number } }) => void;

export class Map {
  readonly options: Record<string, unknown> & { container: HTMLElement };
  readonly controls: { control: unknown; position: string }[] = [];
  readonly handlers: Record<string, Handler> = {};
  readonly fitted: unknown[] = [];
  readonly jumped: unknown[] = [];
  removed = false;

  constructor(options: Record<string, unknown> & { container: HTMLElement }) {
    this.options = options;
    maps.push(this);
  }

  addControl(control: unknown, position: string): this {
    this.controls.push({ control, position });
    return this;
  }

  on(type: string, handler: Handler): this {
    this.handlers[type] = handler;
    return this;
  }

  fitBounds(bounds: unknown): this {
    this.fitted.push(bounds);
    return this;
  }

  jumpTo(options: unknown): this {
    this.jumped.push(options);
    return this;
  }

  remove(): void {
    this.removed = true;
  }

  /** Simulates a tap on the map at this point. */
  tap(lat: number, lng: number): void {
    this.handlers.click?.({ lngLat: { lat, lng } });
  }
}

export type FakeMap = Map;

export class Marker {
  readonly element: HTMLElement;
  lngLat: [number, number] | null = null;
  removed = false;

  constructor({ element }: { element: HTMLElement }) {
    this.element = element;
    markers.push(this);
  }

  setLngLat(lngLat: [number, number]): this {
    this.lngLat = lngLat;
    return this;
  }

  addTo(map: Map): this {
    map.options.container.appendChild(this.element);
    return this;
  }

  remove(): void {
    this.removed = true;
    this.element.remove();
  }
}

export type FakeMarker = Marker;

export class NavigationControl {
  readonly options: unknown;

  constructor(options: unknown) {
    this.options = options;
  }
}

export class AttributionControl {
  readonly options: { compact?: boolean };

  constructor(options: { compact?: boolean }) {
    this.options = options;
  }
}
