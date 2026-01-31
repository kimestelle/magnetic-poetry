"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { animate, stagger } from "motion";

type Props = {
  label: string;
  bold?: boolean;
  children: React.ReactNode;
  align?: "left" | "right";
  offsetClassName?: string; // lets you keep -left-2 like before
};

export function DDItem({
  className = "",
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      data-dd-item
      className={`thin-button bg-white/80 px-2 py-1 block w-max text-left hover:bg-gray-100 hover:text-gray-900 ${className}`}
    >
      {children}
    </div>
  );
}

export default function DropDown({
  label,
  children,
    bold = false,
  align = "left",
  offsetClassName = "-left-2",
}: Props) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const [hoveredTrigger, setHoveredTrigger] = useState(false);
  const [hoveredPanel, setHoveredPanel] = useState(false);
  const [touchOpen, setTouchOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  const chainRef = useRef(Promise.resolve());

  const leaveTimer = useRef<number | null>(null);
  const clearLeaveTimer = () => {
    if (leaveTimer.current != null) {
      window.clearTimeout(leaveTimer.current);
      leaveTimer.current = null;
    }
  };
  const scheduleHoverClose = () => {
    clearLeaveTimer();
    leaveTimer.current = window.setTimeout(() => {
      setHoveredTrigger(false);
      setHoveredPanel(false);
    }, 90);
  };

  const desiredOpen = useMemo(
    () => touchOpen || hoveredTrigger || hoveredPanel,
    [touchOpen, hoveredTrigger, hoveredPanel]
  );

  const getItems = () => {
    const panel = panelRef.current;
    if (!panel) return [];
    return Array.from(panel.querySelectorAll("[data-dd-item]")) as HTMLElement[];
  };

  const playIn = async () => {
    const items = getItems();
    if (!items.length) return;

    await animate(
      items,
      { opacity: 1, transform: "translateY(0px)" },
      {
        initial: { opacity: 0, transform: "translateY(-6px)" },
        delay: stagger(0.06),
        duration: 0.18,
        easing: "ease-out",
      }
    ).finished;
  };

  const playOut = async () => {
    const items = getItems();
    if (!items.length) return;

    await animate(
      items,
      { opacity: 0, transform: "translateY(-6px)" },
      {
        delay: stagger(0.05, { from: "last" }),
        duration: 0.14,
        easing: "ease-in",
      }
    ).finished;
  };

  useEffect(() => {
    chainRef.current = chainRef.current.then(async () => {
      if (desiredOpen) {
        if (!mounted) {
          setMounted(true);
          await new Promise<void>((r) => requestAnimationFrame(() => r()));
        }
        await playIn();
      } else {
        if (!mounted) return;
        await playOut();
        setMounted(false);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [desiredOpen]);

  useEffect(() => {
    if (!mounted) return;

    const onDocPointerDown = (e: PointerEvent) => {
      const root = rootRef.current;
      if (!root) return;
      if (!root.contains(e.target as Node)) {
        setTouchOpen(false);
        setHoveredTrigger(false);
        setHoveredPanel(false);
      }
    };

    document.addEventListener("pointerdown", onDocPointerDown);
    return () => document.removeEventListener("pointerdown", onDocPointerDown);
  }, [mounted]);

  return (
    <div ref={rootRef} className="relative inline-block text-left cursor-pointer">
      <button
        type="button"
        className="thin-button inline-flex justify-center"
        style={{ fontWeight: bold ? 600 : 400 }}
        onPointerEnter={(e) => {
          if (e.pointerType !== "mouse") return;
          clearLeaveTimer();
          setHoveredTrigger(true);
        }}
        onPointerLeave={(e) => {
          if (e.pointerType !== "mouse") return;
          scheduleHoverClose();
        }}
        onPointerDown={(e) => {
          if (e.pointerType !== "touch") return;
          e.preventDefault();
          clearLeaveTimer();
          setTouchOpen((v) => !v);
        }}
      >
        {label}
      </button>

      {mounted && (
        <div
          ref={panelRef}
          className={[
            "absolute mt-2 z-10 focus:outline-none",
            align === "left" ? `${offsetClassName} origin-top-left` : "right-0 origin-top-right",
            "flex flex-col w-max flex-shrink-0 gap-[3px]",
          ].join(" ")}
          role="menu"
          tabIndex={-1}
          onPointerEnter={(e) => {
            if (e.pointerType !== "mouse") return;
            clearLeaveTimer();
            setHoveredPanel(true);
          }}
          onPointerLeave={(e) => {
            if (e.pointerType !== "mouse") return;
            scheduleHoverClose();
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}