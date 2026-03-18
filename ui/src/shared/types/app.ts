import type { InventoryItem } from './inventory';

export type AppMode = 'inventory' | 'crafting';

export interface AppSettings {
  muted: boolean;
  useBank: boolean;
}

export interface ChangeAlert {
  type: 'add' | 'removed' | 'used' | 'Holstered' | 'Equipped';
  item: string;
  count?: number;
  id?: number;
  timestamp: number;
}

export interface AppState {
  hidden: boolean;
  showHotbar: boolean;
  mode: AppMode;
  settings: AppSettings;
  hotbarItems: (InventoryItem | null)[];
  equipped: InventoryItem | null;
  changes: {
    alerts: ChangeAlert[];
  };
}

export interface NUIMessage<T = unknown> {
  type: string;
  data?: T;
}
