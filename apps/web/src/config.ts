// Build-time settings (specs/04-architecture.md, "Configuration").

/** ADR-0009: the map's style JSON. Without it there's no map, and the list works on its own. */
export const mapStyleUrl: string | null = import.meta.env.VITE_MAP_STYLE_URL?.trim() || null;
