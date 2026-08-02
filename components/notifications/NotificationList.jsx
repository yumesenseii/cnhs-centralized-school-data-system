import NotificationCard from "@/components/notifications/NotificationCard";

export default function NotificationList({ notifications, onAction, onMarkRead }) {
  return (
    <div className="space-y-3">
      {notifications.map((notification) => (
        <NotificationCard
          key={notification.id}
          notification={notification}
          onAction={onAction}
          onMarkRead={onMarkRead}
        />
      ))}
    </div>
  );
}
