// Build-time settings (specs/04-architecture.md, "Configuration").

/** ADR-0009: the map's style JSON. Without it there's no map, and the list works on its own. */
export const mapStyleUrl: string | null = import.meta.env.VITE_MAP_STYLE_URL?.trim() || null;

/** ADR-0013: the geocoders address search calls from the browser. The smoke test points them at stubs. */
export const geocoderUrls = {
  nyc: import.meta.env.VITE_NYC_GEOSEARCH_URL?.trim() || 'https://geosearch.planninglabs.nyc/v2',
  nj: import.meta.env.VITE_NJ_GEOCODER_URL?.trim() || 'https://geo.nj.gov/arcgis/rest/services/Tasks/NJ_Geocode/GeocodeServer',
};
