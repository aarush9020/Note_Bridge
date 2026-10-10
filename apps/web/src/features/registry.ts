import type { ComponentType } from 'react';

/**
 * Panel registry. A feature registers its panel with ONE line in `panels` below
 * (owner: Dev B). Panels are mounted by <PanelSlot slot="..."/>.
 */
export type PanelSlotName = 'viewer' | 'course' | 'chat' | 'global';

export interface PanelDefinition {
  id: string;
  title: string;
  slot: PanelSlotName;
  component: ComponentType;
}

export const panels: PanelDefinition[] = [
  // { id: 'conflicts', title: 'Conflicts', slot: 'viewer', component: ConflictsPanel },
];

export function panelsFor(slot: PanelSlotName): PanelDefinition[] {
  return panels.filter((p) => p.slot === slot);
}
