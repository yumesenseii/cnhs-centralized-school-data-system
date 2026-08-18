"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Eye,
  KeyRound,
  MoreHorizontal,
  Pencil,
  Trash2,
  UserCheck,
  UserX,
} from "lucide-react";

export default function ActionButtons({
  user,
  onView,
  onEdit,
  onResetPassword,
  onToggleStatus,
  onDelete,
  currentAuthUserId,
}) {
  const isActive = user.status === "Active";
  const isSelf = Boolean(
    currentAuthUserId && user.authUserId && currentAuthUserId === user.authUserId
  );
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, right: 0 });
  const triggerRef = useRef(null);
  const menuRef = useRef(null);

  function closeMenu() {
    setOpen(false);
  }

  function toggleMenu() {
    if (!open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPosition({
        top: rect.bottom + 6,
        right: Math.max(8, window.innerWidth - rect.right),
      });
    }
    setOpen((current) => !current);
  }

  function runAction(callback) {
    closeMenu();
    callback?.(user);
  }

  useEffect(() => {
    if (!open) return undefined;

    function handlePointerDown(event) {
      if (
        !menuRef.current?.contains(event.target) &&
        !triggerRef.current?.contains(event.target)
      ) {
        closeMenu();
      }
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        closeMenu();
        triggerRef.current?.focus();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", closeMenu);
    window.addEventListener("scroll", closeMenu, true);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", closeMenu);
      window.removeEventListener("scroll", closeMenu, true);
    };
  }, [open]);

  return (
    <div className="flex items-center justify-end gap-1.5">
      <button
        type="button"
        onClick={() => onView?.(user)}
        className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-lg border border-cnhs-green-dark/25 bg-white px-2.5 text-[10px] font-semibold text-cnhs-green-dark transition-colors hover:border-cnhs-green-dark/40 hover:bg-green-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cnhs-green/30"
      >
        <Eye size={11} />
        View
      </button>
      <button
        ref={triggerRef}
        type="button"
        aria-label={`More actions for ${user.fullName}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={toggleMenu}
        className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cnhs-green/30"
      >
        <MoreHorizontal size={14} />
      </button>

      {open
        ? createPortal(
            <div
              ref={menuRef}
              role="menu"
              aria-label={`Actions for ${user.fullName}`}
              style={{ top: position.top, right: position.right }}
              className="fixed z-[80] w-44 overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-[0_16px_40px_rgba(15,23,42,0.16)]"
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => runAction(onEdit)}
                className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[11px] font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cnhs-green/25"
              >
                <Pencil size={13} aria-hidden="true" />
                Edit user
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => runAction(onResetPassword)}
                className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[11px] font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cnhs-green/25"
              >
                <KeyRound size={13} aria-hidden="true" />
                Reset password
              </button>
              <div className="my-1 border-t border-slate-100" />
              <button
                type="button"
                role="menuitem"
                onClick={() => runAction(onToggleStatus)}
                className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[11px] font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cnhs-green/25"
              >
                {isActive ? (
                  <UserX size={13} aria-hidden="true" />
                ) : (
                  <UserCheck size={13} aria-hidden="true" />
                )}
                {isActive ? "Deactivate user" : "Activate user"}
              </button>
              {isSelf ? null : (
                <>
                  <div className="my-1 border-t border-slate-100" />
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => runAction(onDelete)}
                    className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[11px] font-medium text-red-600 transition-colors hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-200"
                  >
                    <Trash2 size={13} aria-hidden="true" />
                    Delete user
                  </button>
                </>
              )}
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
