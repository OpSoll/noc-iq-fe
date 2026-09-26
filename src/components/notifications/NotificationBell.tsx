'use client';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useNotifications } from '@/components/ui/toast';

export function NotificationBell() {
  const { notifications, markAllAsRead } = useNotifications();
  const unread = notifications.filter(
    (notification) => !notification.read
  ).length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Notifications, ${unread} unread`}
          className="relative rounded p-2 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
            <path d="M10 21h4" />
          </svg>
          {unread > 0 && (
            <span
              aria-hidden="true"
              className="absolute -right-1 -top-1 min-w-4 rounded-full bg-red-600 px-1 text-center text-xs font-semibold text-white"
            >
              {unread}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-80 max-w-[calc(100vw-2rem)] bg-white text-slate-900"
        aria-label="Recent notifications"
      >
        <DropdownMenuLabel>Notifications</DropdownMenuLabel>
        <DropdownMenuItem
          disabled={unread === 0}
          onSelect={(event) => {
            event.preventDefault();
            markAllAsRead();
          }}
        >
          Mark All as Read
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {notifications.length === 0 ? (
          <p className="p-3 text-sm text-slate-500">No notifications yet.</p>
        ) : (
          <ul aria-label="Recent alerts" className="max-h-80 overflow-y-auto">
            {notifications.map((notification) => (
              <li
                key={notification.id}
                className={`break-words border-b border-slate-100 p-3 text-sm ${notification.read ? 'text-slate-600' : 'bg-indigo-50 font-medium'}`}
              >
                {!notification.read && (
                  <span className="sr-only">Unread: </span>
                )}
                {notification.message}
              </li>
            ))}
          </ul>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
