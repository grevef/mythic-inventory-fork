import { useEffect, useCallback, useState } from 'react';
import { ThemeProvider, CssBaseline, Box } from '@mui/material';
import { theme } from './styles/theme';
import { useAppDispatch, useAppSelector } from './shared/hooks';
import { appActions } from './store/appSlice';
import { inventoryActions } from './features/inventory/inventorySlice';
import { craftingActions } from './features/crafting/craftingSlice';
import { Inventory } from './features/inventory/components/Inventory';
import { HoverSlot } from './features/inventory/components/HoverSlot';
import { Hotbar } from './features/hotbar/components/Hotbar';
import { Crafting, Process } from './features/crafting/components';
import { DevModeButton } from './features/inventory/components/DevModeButton';
import { DevModePopup } from './features/inventory/components/DevModePopup';
import { ItemNotifications } from './features/inventory/components/ItemNotifications';
import { nuiActions } from './services/nui';
import type { NUIMessage } from './shared/types';

function App() {
  const dispatch = useAppDispatch();
  const [devPopupOpen, setDevPopupOpen] = useState(false);

  const handleNUIMessage = useCallback(
    (message: NUIMessage) => {
      switch (message.type) {
        case 'APP_SHOW':
          dispatch(appActions.showApp());
          break;
        case 'APP_HIDE':
          dispatch(appActions.hideApp());
          dispatch(inventoryActions.clearHover());
          dispatch(craftingActions.clearRecipes());
          break;
        case 'SET_MODE':
          dispatch(appActions.setMode((message.data as any)?.mode || 'inventory'));
          break;
        case 'SET_PLAYER_INVENTORY':
          dispatch(inventoryActions.setPlayerInventory(message.data as any));
          break;
        case 'SET_SECONDARY_INVENTORY':
          dispatch(inventoryActions.setSecondaryInventory(message.data as any));
          break;
        case 'SHOW_SECONDARY_INVENTORY':
          dispatch(inventoryActions.showSecondaryInventory());
          break;
        case 'HIDE_SECONDARY_INVENTORY':
          dispatch(inventoryActions.hideSecondaryInventory());
          break;
        case 'SET_PLAYER_SLOT':
          dispatch(
            inventoryActions.setPlayerSlotDisabled({
              slot: (message.data as any).slot,
              disabled: false,
              itemData: (message.data as any).itemData,
            })
          );
          break;
        case 'SET_SECONDARY_SLOT':
          dispatch(
            inventoryActions.setSecondarySlotDisabled({
              slot: (message.data as any).slot,
              disabled: false,
              itemData: (message.data as any).itemData,
            })
          );
          break;
        case 'USE_IN_PROGRESS':
          dispatch(inventoryActions.setInUse((message.data as any).state));
          break;
        case 'ADD_ALERT':
          dispatch(appActions.addAlert((message.data as any).alert));
          break;
        case 'OPEN_STATIC_TOOLTIP':
          dispatch(inventoryActions.setStaticTooltip((message.data as any).item));
          break;
        case 'CLOSE_STATIC_TOOLTIP':
          dispatch(inventoryActions.setStaticTooltip(false));
          break;
        case 'UPDATE_SETTINGS':
          dispatch(appActions.updateSettings(message.data as any));
          break;
        case 'HOTBAR_SHOW':
          dispatch(appActions.showHotbar());
          dispatch(appActions.setHotbarItems((message.data as any).items || []));
          break;
        case 'HOTBAR_HIDE':
          dispatch(appActions.hideHotbar());
          break;
        case 'SET_EQUIPPED':
          dispatch(appActions.setEquipped(message.data as any));
          break;
        case 'SET_AVALIABLE_ITEMS':
          dispatch(inventoryActions.setItems(message.data as any));
          break;
        case 'ADD_ITEM':
          dispatch(inventoryActions.addItem(message.data as any));
          break;
        case 'RESET_ITEMS':
          dispatch(inventoryActions.setItems({}));
          break;
        case 'SET_EQUIPMENT':
          dispatch(inventoryActions.setEquipment(message.data as any));
          break;
        case 'SLOT_NOT_USED':
          // Re-enable slot if item use failed
          if ((message.data as any).originSlot) {
            dispatch(
              inventoryActions.setPlayerSlotDisabled({
                slot: (message.data as any).originSlot,
                disabled: false,
              })
            );
          }
          break;
        case 'ITEMS_LOADED':
          dispatch(inventoryActions.setItemsLoaded(true));
          break;
        case 'ITEMS_UNLOADED':
          dispatch(inventoryActions.setItemsLoaded(false));
          break;
        case 'SET_BENCH':
          dispatch(craftingActions.setBench(message.data as any));
          break;
        case 'SET_CRAFTING':
          dispatch(craftingActions.setCrafting(message.data as any));
          break;
        case 'END_CRAFTING':
          dispatch(craftingActions.endCrafting());
          break;
        case 'CRAFT_PROGRESS':
          dispatch(craftingActions.setCraftProgress((message.data as any).progress));
          break;
        case 'CURRENT_CRAFT':
          dispatch(craftingActions.setCurrentCraft((message.data as any).currentCraft));
          break;
        case 'UPDATE_CRAFTING_COUNTS':
          dispatch(craftingActions.updateCounts((message.data as any).myCounts));
          break;
      }
    },
    [dispatch]
  );

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      handleNUIMessage(event.data);
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [handleNUIMessage]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' || event.key === 'F2') {
        dispatch(appActions.hideApp());
        nuiActions.close();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dispatch]);

  const hidden = useAppSelector((state) => state.app.hidden);
  const mode = useAppSelector((state) => state.app.mode);
  const crafting = useAppSelector((state) => state.crafting.crafting);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box
        sx={{
          width: '100vw',
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'transparent',
        }}
      >
        {!hidden && mode === 'inventory' && <Inventory />}
        {!hidden && mode === 'crafting' && <Crafting />}
        {mode === 'inventory' && <HoverSlot />}
        <Hotbar />
        {Boolean(crafting) && <Process crafting={crafting} />}
        <DevModeButton onClick={() => setDevPopupOpen(true)} />
        <DevModePopup open={devPopupOpen} onClose={() => setDevPopupOpen(false)} />
        <ItemNotifications />
      </Box>
    </ThemeProvider>
  );
}

export default App;
