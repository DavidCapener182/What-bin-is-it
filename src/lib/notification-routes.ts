import approvedRoutes from '../../shared/notification-routes.json';

export type ApprovedNotificationPath = '/' | '/activity' | '/schedule' | '/settings';

const approvedNotificationRoutes = new Set<string>(approvedRoutes);

export function approvedNativeNotificationPath(value: unknown): ApprovedNotificationPath | undefined {
  return typeof value === 'string' && approvedNotificationRoutes.has(value)
    ? value as ApprovedNotificationPath
    : undefined;
}
