// Theme system removed — single design system, no switching.
export type ThemeId = string;
export const THEMES: ReadonlyArray<{ id: string; name: string; description: string; gradient: string; accent: string; surface: string; border: string }> = [];
export function getTheme(): ThemeId { return ''; }
export function applyTheme(_id: ThemeId): void { /* no-op */ }
