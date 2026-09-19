"use client";

import { useEffect, useMemo, useState } from "react";
import NotificationList from "@/components/notifications/NotificationList";
import TablePagination from "@/components/academic-records/TablePagination";

export const NOTIFICATIONS_PAGE_SIZE = 10;

/**
 * Inbox list with 10-per-page pagination. Resets to page 1 when the
 * filtered set identity changes (search / filters).
 */
export default function PaginatedNotificationList({
  notifications = [],
  onAction,
  onMarkRead,
  pageSize = NOTIFICATIONS_PAGE_SIZE,
}) {
  const [page, setPage] = useState(1);
  const total = notifications.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1);

  const filterKey = useMemo(
    () => notifications.map((item) => item.id).join("|"),
    [notifications]
  );

  useEffect(() => {
    setPage(1);
  }, [filterKey]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const safePage = Math.min(Math.max(page, 1), totalPages);
  const start = (safePage - 1) * pageSize;
  const pageItems = notifications.slice(start, start + pageSize);

  return (
    <div className="space-y-3">
      <NotificationList
        notifications={pageItems}
        onAction={onAction}
        onMarkRead={onMarkRead}
      />
      {total > 0 ? (
        <TablePagination
          page={safePage}
          pageSize={pageSize}
          total={total}
          onPageChange={setPage}
        />
      ) : null}
    </div>
  );
}
