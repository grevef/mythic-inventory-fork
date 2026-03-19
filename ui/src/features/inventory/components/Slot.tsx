import { useState, useMemo, memo, useCallback } from 'react';
import { Box, LinearProgress, Typography } from '@mui/material';
import { shallowEqual } from 'react-redux';
import { useAppDispatch, useAppSelector } from '../../../shared/hooks';
import { inventoryActions } from '../inventorySlice';
import { appActions } from '../../../store/appSlice';
import { getItemImage } from '../../../shared/utils/inventory';
import { lua2json } from '../../../shared/utils/lua';
import { formatThousands } from '../../../shared/utils/formatters';
import { rarityColors } from '../../../styles/theme';
import { Tooltip } from './Tooltip';
import { SplitDialog } from './SplitDialog';
import { nuiActions } from '../../../services/nui';
import type { InventoryItem, ItemMetadata, InventoryType } from '../../../shared/types';

interface SlotProps {
  slot: number;
  item: InventoryItem | null;
  invType: InventoryType;
  owner: string | number;
  disabled?: boolean;
}

const SlotComponent = ({ slot, item, invType, owner, disabled = false }: SlotProps) => {
  const dispatch = useAppDispatch();
  const { items, hover, hoverOrigin, player, secondary } = useAppSelector((state) => ({
    items: state.inventory.items,
    hover: state.inventory.hover,
    hoverOrigin: state.inventory.hoverOrigin,
    player: state.inventory.player,
    secondary: state.inventory.secondary,
  }), shallowEqual);
  const [tooltipAnchor, setTooltipAnchor] = useState<HTMLElement | null>(null);
  const [showSplit, setShowSplit] = useState(false);
  const [splitPosition, setSplitPosition] = useState({ x: 0, y: 0 });

  // Memoize metadata parsing to avoid recalculating on every render
  const metadata: ItemMetadata = useMemo(() => {
    if (!item?.MetaData) return {};
    return typeof item.MetaData === 'string' ? lua2json(item.MetaData) : item.MetaData;
  }, [item?.MetaData]);

  const itemData = item ? items[item.Name] : null;
  const isEmpty = !item || !itemData;

  // Memoize durability calculation
  const durability = useMemo((): number | null => {
    if (!item?.CreateDate || !itemData?.durability) return null;
    return Math.ceil(
      100 -
        ((Math.floor(Date.now() / 1000) - (item as any).CreateDate) /
          itemData.durability) *
          100
    );
  }, [item?.CreateDate, itemData?.durability]);

  const isBroken = durability !== null && durability <= 0;

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    if (disabled) return;
    if (!item || isEmpty) return;

    // Middle mouse button - Use Item
    if (e.button === 1) {
      const isPlayerInventory = invType === player.invType;
      if (isPlayerInventory && itemData?.isUsable && !isBroken) {
        nuiActions.frontEndSound('SELECT');
        nuiActions.useItem({
          owner: player.owner,
          slot,
          invType,
        });
        // Disable the slot optimistically while item is being used
        dispatch(
          inventoryActions.setPlayerSlotDisabled({
            slot,
            disabled: true,
          })
        );
      } else {
        nuiActions.frontEndSound('DISABLED');
      }
      return;
    }

    // Left mouse button only for dragging
    if (e.button !== 0) return;

    // Shift+Left-Click - Quick transfer to other inventory
    if (e.shiftKey && secondary.owner) {
      const isPlayerInventory = invType === player.invType;
      const targetInventory = isPlayerInventory ? secondary : player;

      // Block selling to shop
      if (isPlayerInventory && secondary.shop) {
        nuiActions.frontEndSound('DISABLED');
        return;
      }

      let destSlot: number | null = null;
      let shouldMerge = false;

      // Try to find existing stackable item first
      if (itemData?.isStackable) {
        for (const targetItem of targetInventory.inventory) {
          if (
            targetItem &&
            targetItem.Name === item.Name &&
            (itemData.isStackable === true ||
              (typeof itemData.isStackable === 'number' &&
                targetItem.Count + item.Count <= itemData.isStackable))
          ) {
            destSlot = targetItem.Slot;
            shouldMerge = true;
            break;
          }
        }
      }

      // If no stackable slot, find first empty slot
      if (!destSlot) {
        const occupiedSlots = new Set(
          targetInventory.inventory.map((item) => item?.Slot).filter(Boolean)
        );
        for (let i = 1; i <= targetInventory.size; i++) {
          if (!occupiedSlots.has(i)) {
            destSlot = i;
            break;
          }
        }
      }

      if (destSlot) {
        nuiActions.frontEndSound('drag');

        if (shouldMerge) {
          nuiActions.mergeSlot({
            ownerFrom: isPlayerInventory ? player.owner : secondary.owner,
            ownerTo: isPlayerInventory ? secondary.owner : player.owner,
            slotFrom: slot,
            slotTo: destSlot,
            name: item.Name,
            countFrom: item.Count,
            countTo: item.Count,
            invTypeFrom: invType,
            invTypeTo: targetInventory.invType,
          });

          // Optimistic update
          if (isPlayerInventory) {
            dispatch(inventoryActions.mergeItemPlayerToSecondary({ originSlot: slot, destSlot, origin: item }));
            dispatch(appActions.addAlert({ type: 'removed', item: item.Name, count: item.Count }));
          } else {
            dispatch(inventoryActions.mergeItemSecondaryToPlayer({ originSlot: slot, destSlot, origin: item }));
            dispatch(appActions.addAlert({ type: 'add', item: item.Name, count: item.Count }));
          }
        } else {
          nuiActions.moveSlot({
            ownerFrom: isPlayerInventory ? player.owner : secondary.owner,
            ownerTo: isPlayerInventory ? secondary.owner : player.owner,
            slotFrom: slot,
            slotTo: destSlot,
            name: item.Name,
            countFrom: item.Count,
            countTo: item.Count,
            invTypeFrom: invType,
            invTypeTo: targetInventory.invType,
            isSplit: false,
          });

          // Optimistic update
          if (isPlayerInventory) {
            dispatch(inventoryActions.moveItemPlayerToSecondary({ originSlot: slot, destSlot, origin: item }));
            dispatch(appActions.addAlert({ type: 'removed', item: item.Name, count: item.Count }));
          } else {
            dispatch(inventoryActions.moveItemSecondaryToPlayer({ originSlot: slot, destSlot, origin: item }));
            dispatch(appActions.addAlert({ type: 'add', item: item.Name, count: item.Count }));
          }
        }
      } else {
        nuiActions.frontEndSound('DISABLED');
      }
      return;
    }

    // Regular drag - Ctrl for half stack
    const count = e.ctrlKey ? Math.ceil(item.Count / 2) : item.Count;

    dispatch(
      inventoryActions.setHover({
        ...item,
        Count: count,
        owner,
        invType,
      })
    );

    dispatch(
      inventoryActions.setHoverOrigin({
        ...item,
        slot,
        owner,
        invType,
      })
    );
  }, [disabled, item, isEmpty, player, secondary, itemData, isBroken, invType, slot, owner, dispatch]);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    if (!hover || !hoverOrigin) return;
    if (e.button !== 0) return;

    // If dropping on same slot, just cancel
    if (hoverOrigin.Slot === slot && hoverOrigin.invType === invType) {
      dispatch(inventoryActions.clearHover());
      return;
    }

    // Determine origin and destination inventory
    const isOriginPlayer = hoverOrigin.invType === player.invType;
    const isDestPlayer = invType === player.invType;

    // Get hover item data
    const hoverItemData = items[hover.Name];
    if (!hoverItemData) {
      dispatch(inventoryActions.clearHover());
      return;
    }

    // Play drag sound
    nuiActions.frontEndSound('drag');

    // Check if we can merge items (same item, stackable, has room)
    const canMerge =
      item &&
      item.Name === hover.Name &&
      hoverItemData.isStackable &&
      (hoverItemData.isStackable === true ||
        (typeof hoverItemData.isStackable === 'number' &&
          item.Count + hover.Count <= hoverItemData.isStackable));

    // Determine if this is a split operation
    const isSplit = hoverOrigin.Count !== hover.Count;

    if (canMerge) {
      // MERGE operation
      nuiActions.mergeSlot({
        ownerFrom: isOriginPlayer ? player.owner : secondary.owner,
        ownerTo: isDestPlayer ? player.owner : secondary.owner,
        slotFrom: hoverOrigin.Slot,
        slotTo: slot,
        name: hover.Name,
        countFrom: hoverOrigin.Count,
        countTo: hover.Count,
        invTypeFrom: hoverOrigin.invType,
        invTypeTo: invType,
      });

      // Update local state optimistically
      if (isOriginPlayer && isDestPlayer) {
        dispatch(inventoryActions.mergeItemPlayerSame({ originSlot: hoverOrigin.Slot, destSlot: slot, origin: hover }));
      } else if (isOriginPlayer && !isDestPlayer) {
        dispatch(inventoryActions.mergeItemPlayerToSecondary({ originSlot: hoverOrigin.Slot, destSlot: slot, origin: hover }));
        dispatch(appActions.addAlert({ type: 'removed', item: hover.Name, count: hover.Count }));
      } else if (!isOriginPlayer && isDestPlayer) {
        dispatch(inventoryActions.mergeItemSecondaryToPlayer({ originSlot: hoverOrigin.Slot, destSlot: slot, origin: hover }));
        dispatch(appActions.addAlert({ type: 'add', item: hover.Name, count: hover.Count }));
      }
    } else if (item) {
      // SWAP operation (destination has item)
      nuiActions.swapSlot({
        ownerFrom: isOriginPlayer ? player.owner : secondary.owner,
        ownerTo: isDestPlayer ? player.owner : secondary.owner,
        slotFrom: hoverOrigin.Slot,
        slotTo: slot,
        name: hover.Name,
        countFrom: hoverOrigin.Count,
        countTo: hover.Count,
        invTypeFrom: hoverOrigin.invType,
        invTypeTo: invType,
      });

      // Update local state optimistically
      if (isOriginPlayer && isDestPlayer) {
        dispatch(inventoryActions.swapItemPlayerSame({ originSlot: hoverOrigin.Slot, destSlot: slot, origin: hover }));
      } else if (isOriginPlayer && !isDestPlayer) {
        dispatch(inventoryActions.swapItemPlayerToSecondary({ originSlot: hoverOrigin.Slot, destSlot: slot, origin: hover }));
        dispatch(appActions.addAlert({ type: 'removed', item: hover.Name, count: hover.Count }));
        dispatch(appActions.addAlert({ type: 'add', item: item.Name, count: item.Count }));
      } else if (!isOriginPlayer && isDestPlayer) {
        dispatch(inventoryActions.swapItemSecondaryToPlayer({ originSlot: hoverOrigin.Slot, destSlot: slot, origin: hover }));
        dispatch(appActions.addAlert({ type: 'add', item: hover.Name, count: hover.Count }));
        dispatch(appActions.addAlert({ type: 'removed', item: item.Name, count: item.Count }));
      }
    } else {
      // MOVE operation (destination is empty)
      nuiActions.moveSlot({
        ownerFrom: isOriginPlayer ? player.owner : secondary.owner,
        ownerTo: isDestPlayer ? player.owner : secondary.owner,
        slotFrom: hoverOrigin.Slot,
        slotTo: slot,
        name: hover.Name,
        countFrom: hoverOrigin.Count,
        countTo: hover.Count,
        invTypeFrom: hoverOrigin.invType,
        invTypeTo: invType,
        isSplit,
      });

      // Update local state optimistically
      if (isOriginPlayer && isDestPlayer) {
        dispatch(inventoryActions.moveItemPlayerSame({ originSlot: hoverOrigin.Slot, destSlot: slot, origin: hover }));
      } else if (isOriginPlayer && !isDestPlayer) {
        dispatch(inventoryActions.moveItemPlayerToSecondary({ originSlot: hoverOrigin.Slot, destSlot: slot, origin: hover }));
        dispatch(appActions.addAlert({ type: 'removed', item: hover.Name, count: hover.Count }));
      } else if (!isOriginPlayer && isDestPlayer) {
        dispatch(inventoryActions.moveItemSecondaryToPlayer({ originSlot: hoverOrigin.Slot, destSlot: slot, origin: hover }));
        dispatch(appActions.addAlert({ type: 'add', item: hover.Name, count: hover.Count }));
      }
    }

    dispatch(inventoryActions.clearHover());
  }, [hover, hoverOrigin, player, secondary, invType, slot, item, items, dispatch]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    if (disabled) return;
    if (!item || isEmpty || hoverOrigin) return;

    // Shift+Right-Click - Open split dialog
    if (e.shiftKey && itemData?.isStackable && item.Count > 1) {
      setSplitPosition({ x: e.clientX, y: e.clientY });
      setShowSplit(true);
      return;
    }

    // Ctrl+Right-Click - Start dragging single item
    if (e.ctrlKey) {
      dispatch(
        inventoryActions.setHover({
          ...item,
          Count: 1,
          owner,
          invType,
        })
      );
      dispatch(
        inventoryActions.setHoverOrigin({
          ...item,
          owner,
          invType,
        })
      );
      return;
    }

    // Regular Right-Click - Start dragging half stack
    const count = item.Count > 1 ? Math.ceil(item.Count / 2) : item.Count;
    dispatch(
      inventoryActions.setHover({
        ...item,
        Count: count,
        owner,
        invType,
      })
    );
    dispatch(
      inventoryActions.setHoverOrigin({
        ...item,
        slot,
        owner,
        invType,
      })
    );
  }, [disabled, item, isEmpty, hoverOrigin, itemData, owner, invType, slot, dispatch, setSplitPosition, setShowSplit]);

  const handleSplitDrag = useCallback((amount: number) => {
    if (!item) return;

    dispatch(
      inventoryActions.setHover({
        ...item,
        Count: amount,
        owner,
        invType,
      })
    );
    dispatch(
      inventoryActions.setHoverOrigin({
        ...item,
        slot,
        owner,
        invType,
      })
    );
    setShowSplit(false);
  }, [item, owner, invType, slot, dispatch, setShowSplit]);

  // Memoize durability color calculation
  const durabilityColor = useMemo(() => {
    if (!durability) return '#0FC6A6';
    if (durability >= 75) return '#0FC6A6';
    if (durability >= 50) return '#f09348';
    return '#6e1616';
  }, [durability]);

  const handleMouseEnter = useCallback((e: React.MouseEvent<HTMLElement>) => {
    if (!isEmpty) setTooltipAnchor(e.currentTarget);
  }, [isEmpty, setTooltipAnchor]);

  const handleMouseLeave = useCallback(() => {
    setTooltipAnchor(null);
  }, [setTooltipAnchor]);

  const isBeingDragged = hover && hoverOrigin?.Slot === slot && hoverOrigin?.invType === invType;

  return (
    <>
      <Box
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onContextMenu={handleContextMenu}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        sx={{
        width: '100%',
        height: '125px',
        background: isBroken
          ? 'linear-gradient(rgba(99, 35, 35, 0.8), 25%, rgba(99, 35, 35, 0.4))'
          : 'rgba(17, 49, 80, 0.330)',
        border: `0.15px solid ${
          itemData ? `${rarityColors[itemData.rarity]}40` : '#0101064b'
        }`,
        borderRadius: '6px',
        position: 'relative',
        opacity: isBeingDragged ? 0.35 : 1,
        transition: 'opacity ease-in 0.15s, background ease-in 0.15s',
        cursor: !isEmpty ? 'pointer' : 'default',
        '&:hover': {
          background: !isEmpty && !isBroken
            ? '#0c0c0c9e'
            : isBroken
            ? 'linear-gradient(rgba(99, 35, 35, 1), 25%, rgba(99, 35, 35, 0.6))'
            : undefined,
        },
      }}
    >
      {!isEmpty && itemData && (
        <>
          <Box
            sx={{
              height: '125px',
              width: '100%',
              backgroundImage: `url(${getItemImage(
                metadata.CustomItemImage || item.Name
              )})`,
              backgroundSize: '55%',
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'center center',
            }}
          />

          <Typography
            sx={{
              position: 'absolute',
              top: 0,
              right: 0,
              padding: '0 5px',
              fontSize: '14px',
              fontWeight: 'bold',
              zIndex: 4,
            }}
          >
            {item.Count > 1 ? item.Count : ''}
          </Typography>

          <Typography
            sx={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              width: '100%',
              textAlign: 'center',
              padding: '2px 5px',
              fontSize: '12px',
              background: 'rgba(12,24,38, 0.733)',
              borderTop: '1px solid rgb(255 255 255 / 4%)',
              overflow: 'hidden',
              whiteSpace: 'nowrap',
              textOverflow: 'ellipsis',
              zIndex: 4,
            }}
          >
            {metadata.CustomItemLabel || itemData.label}
          </Typography>

          {durability !== null && durability > 0 && (
            <Box
              sx={{
                position: 'absolute',
                bottom: '25px',
                left: 0,
                width: '100%',
                height: '4px',
                zIndex: 4,
              }}
            >
              <LinearProgress
                variant="determinate"
                value={durability}
                sx={{
                  height: '100%',
                  backgroundColor: 'transparent',
                  '& .MuiLinearProgress-bar': {
                    backgroundColor: durabilityColor,
                    transition: 'none',
                  },
                }}
              />
            </Box>
          )}

          {isBroken && (
            <Typography
              sx={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                fontSize: '16px',
                fontWeight: 'bold',
                color: '#fff',
                textShadow: '0 0 10px rgba(0,0,0,0.8)',
                zIndex: 5,
              }}
            >
              BROKEN
            </Typography>
          )}

          {slot <= 5 && !secondary.shop && (
            <Typography
              sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                padding: '0 5px',
                width: '20px',
                fontSize: '12px',
                color: '#9CE60D',
                background: 'rgba(12,24,38, 0.733)',
                borderRight: '1px solid rgb(255 255 255 / 4%)',
                borderBottom: '1px solid rgb(255 255 255 / 4%)',
                borderBottomRightRadius: '5px',
                borderTopLeftRadius: '5px',
                zIndex: 4,
              }}
            >
              {slot}
            </Typography>
          )}

          {secondary.shop && owner === secondary.owner && invType === secondary.invType && (
            <>
              {item.Price === 0 ? (
                <Typography
                  sx={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    padding: '0 5px',
                    fontSize: '12px',
                    color: 'success.main',
                    zIndex: 4,
                  }}
                >
                  FREE
                </Typography>
              ) : (
                <Typography
                  sx={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    padding: '0 5px',
                    fontSize: '12px',
                    color: 'success.main',
                    zIndex: 4,
                    '&::before': {
                      content: '"$"',
                      marginRight: '2px',
                      color: 'text.primary',
                    },
                  }}
                >
                  {formatThousands((item.Price ?? itemData?.price ?? 0) * item.Count)}
                  {item.Count > 1 && (
                    <Typography
                      component="span"
                      sx={{
                        marginLeft: '5px',
                        fontSize: '10px',
                        color: 'text.secondary',
                        '&::before': {
                          content: '"($"',
                        },
                        '&::after': {
                          content: '")"',
                        },
                      }}
                    >
                      {formatThousands(item.Price ?? itemData?.price ?? 0)}
                    </Typography>
                  )}
                </Typography>
              )}
            </>
          )}
        </>
      )}
    </Box>

    <Tooltip
      item={item}
      anchorEl={tooltipAnchor}
      onClose={() => setTooltipAnchor(null)}
    />

    <SplitDialog
      open={showSplit}
      item={item}
      anchorPosition={splitPosition}
      onClose={() => setShowSplit(false)}
      onSplit={handleSplitDrag}
    />
    </>
  );
};

// Memoize the entire component to prevent unnecessary re-renders
export const Slot = memo(SlotComponent);
