import { useEffect, useRef, useState, memo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Box, Typography } from '@mui/material';
import { useAppDispatch, useAppSelector } from '../../../shared/hooks';
import { appActions } from '../../../store/appSlice';
import { getItemImage } from '../../../shared/utils/inventory';
import type { ChangeAlert } from '../../../shared/types';
import { theme } from '../../../styles/theme';

const NOTIFICATION_DURATION = 4000;
const EXIT_DURATION = 220;

const { success, error, warning, info, primary } = theme.palette;

const ACTION_CONFIG: Record<ChangeAlert['type'], { color: string; prefix?: string; label?: string }> = {
  add: { color: success.main, prefix: '+' },
  removed: { color: error.main, prefix: '-' },
  used: { color: warning.main, label: 'Used' },
  Equipped: { color: info.main, label: 'Equipped' },
  Holstered: { color: primary.light, label: 'Holstered' },
};

interface NotificationItemProps {
  alert: ChangeAlert;
  onRemove: () => void;
}

const NotificationItem = memo(({ alert, onRemove }: NotificationItemProps) => {
  const items = useAppSelector((state) => state.inventory.items);
  const itemDef = items[alert.item];
  const [exiting, setExiting] = useState(false);
  const onRemoveRef = useRef(onRemove);
  onRemoveRef.current = onRemove;

  useEffect(() => {
    const timer = setTimeout(() => setExiting(true), NOTIFICATION_DURATION - EXIT_DURATION);
    const removeTimer = setTimeout(() => onRemoveRef.current(), NOTIFICATION_DURATION);
    return () => { clearTimeout(timer); clearTimeout(removeTimer); };
  }, [alert.timestamp]);

  const config = ACTION_CONFIG[alert.type] ?? ACTION_CONFIG.used;
  const isCountType = alert.type === 'add' || alert.type === 'removed';
  const actionText = isCountType
    ? `${config.prefix}${alert.count ?? 1}`
    : config.label ?? alert.type;

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '8px 14px 8px 10px',
        background: theme.palette.background.paper,
        border: '0.5px solid rgba(255, 255, 255, 0.07)',
        borderLeft: `3px solid ${config.color}`,
        borderRadius: '6px',
        minWidth: '210px',
        maxWidth: '270px',
        animation: exiting
          ? `notifSlideOut ${EXIT_DURATION}ms ease-in forwards`
          : 'notifSlideIn 0.22s ease-out',
        '@keyframes notifSlideIn': {
          from: { opacity: 0, transform: 'translateX(30px)' },
          to: { opacity: 1, transform: 'translateX(0)' },
        },
        '@keyframes notifSlideOut': {
          from: { opacity: 1, transform: 'translateX(0)' },
          to: { opacity: 0, transform: 'translateX(30px)' },
        },
      }}
    >
      <Box
        sx={{
          width: '38px',
          height: '38px',
          flexShrink: 0,
          backgroundImage: `url(${getItemImage(alert.item)})`,
          backgroundSize: 'contain',
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center',
          filter: 'drop-shadow(0 0 4px rgba(0,0,0,0.6))',
        }}
      />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          sx={{
            fontSize: '13px',
            fontWeight: 600,
            lineHeight: 1.3,
            color: theme.palette.text.primary,
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            textOverflow: 'ellipsis',
          }}
        >
          {itemDef?.label ?? alert.item}
        </Typography>
        <Typography
          sx={{
            fontSize: '11px',
            color: theme.palette.text.secondary,
            lineHeight: 1.2,
            textTransform: 'capitalize',
          }}
        >
          {alert.type === 'add'
            ? 'Added to inventory'
            : alert.type === 'removed'
            ? 'Removed from inventory'
            : alert.type === 'used'
            ? 'Item used'
            : alert.type}
        </Typography>
      </Box>
      <Typography
        sx={{
          fontSize: '14px',
          fontWeight: 700,
          color: config.color,
          flexShrink: 0,
          minWidth: '36px',
          textAlign: 'right',
        }}
      >
        {actionText}
      </Typography>
    </Box>
  );
});

export const ItemNotifications = () => {
  const dispatch = useAppDispatch();
  const alerts = useAppSelector((state) => state.app.changes.alerts);

  const handleRemove = useCallback(
    (timestamp: number) => dispatch(appActions.removeAlert(timestamp)),
    [dispatch]
  );

  if (alerts.length === 0) return null;

  return createPortal(
    <Box
      sx={{
        position: 'fixed',
        bottom: '90px',
        right: '20px',
        display: 'flex',
        flexDirection: 'column-reverse',
        gap: '6px',
        zIndex: 9999,
        pointerEvents: 'none',
      }}
    >
      {alerts.map((alert) => (
        <NotificationItem
          key={alert.timestamp}
          alert={alert}
          onRemove={() => handleRemove(alert.timestamp)}
        />
      ))}
    </Box>,
    document.body
  );
};
