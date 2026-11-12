/**
 * icons.tsx — the app's inline icon set.
 *
 * Every glyph is a single-path outline icon so pages stay consistent and
 * emoji never leak into the interface.
 */

export type IconName =
  | "search"
  | "sparkles"
  | "shield"
  | "shieldCheck"
  | "check"
  | "close"
  | "alert"
  | "lock"
  | "wallet"
  | "bag"
  | "receipt"
  | "chart"
  | "sliders"
  | "clock"
  | "tag"
  | "arrowRight"
  | "filter"
  | "trend"
  | "store"
  | "folder"
  | "list"
  | "refresh"
  | "download"
  | "link"
  | "bug"
  | "dot";

const PATHS: Record<IconName, string> = {
  search: "M20.5 20.5 16.9 16.9M18 11a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z",
  sparkles:
    "M12 3.5 13.8 8.2 18.5 10 13.8 11.8 12 16.5 10.2 11.8 5.5 10l4.7-1.8L12 3.5ZM18.5 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2Z",
  shield: "M12 3.5 19 6v5.6c0 4.1-2.9 7.7-7 8.9-4.1-1.2-7-4.8-7-8.9V6l7-2.5Z",
  shieldCheck:
    "M12 3.5 19 6v5.6c0 4.1-2.9 7.7-7 8.9-4.1-1.2-7-4.8-7-8.9V6l7-2.5ZM9 11.8l2.2 2.2 4-4.2",
  check: "M4.5 12.6 9.4 17.5 19.8 6.8",
  close: "M6 6l12 12M18 6 6 18",
  alert: "M12 4.6 20.6 19.4H3.4L12 4.6ZM12 10v4.1M12 17h.01",
  lock: "M7.5 11V8.2a4.5 4.5 0 0 1 9 0V11M5.5 11h13v9.5h-13V11Z",
  wallet: "M3.5 7.5h17v11.5h-17zM3.5 7.5 16.8 4v3.5M16 13.2h2",
  bag: "M6 8h12l-1.1 12.5h-9.8L6 8ZM9 8V6.2a3 3 0 0 1 6 0V8",
  receipt: "M6 3.5h12V21l-3-2-3 2-3-2-3 2V3.5ZM9 8.5h6M9 12.5h6",
  chart: "M4 20V4M4 20h16M8 16v-5M12.5 16V7.5M17 16v-3",
  sliders: "M4 7h6M14 7h6M4 17h10M18 17h2M12 4.8v4.4M14 14.8v4.4",
  clock: "M12 3.5a8.5 8.5 0 1 1 0 17 8.5 8.5 0 0 1 0-17ZM12 7.5V12l3 1.8",
  tag: "M20 13.2 13.2 20a2 2 0 0 1-2.8 0L4 13.6V4h9.6l6.4 6.4a2 2 0 0 1 0 2.8ZM8 8h.01",
  arrowRight: "M4 12h15M13 6l6 6-6 6",
  filter: "M4 6.5h16M7 12h10M10 17.5h4",
  trend: "M4 17 9.5 11l3.5 3.5L20 7M20 7h-4.5M20 7v4.5",
  store: "M4 9.5 6 4.5h12l2 5M4 9.5h16V20H4V9.5ZM9.5 20v-5.5h5V20",
  folder: "M3.5 6.5h6l2 2.5h9V19h-17V6.5Z",
  list: "M8 6.5h12M8 12h12M8 17.5h12M4 6.5h.01M4 12h.01M4 17.5h.01",
  refresh: "M20 11a8 8 0 1 0-2.6 6M20 5.5V11h-5.5",
  download: "M12 4v10M8 10.5l4 4 4-4M4.5 19.5h15",
  link: "M10 13.5a3.5 3.5 0 0 0 5 0l3-3a3.5 3.5 0 0 0-5-5l-1 1M14 10.5a3.5 3.5 0 0 0-5 0l-3 3a3.5 3.5 0 0 0 5 5l1-1",
  bug: "M9 6.5a3 3 0 0 1 6 0M8 10h8v5a4 4 0 0 1-8 0v-5ZM8 12H5M16 12h3M8.5 16 6 18M15.5 16 18 18M8.5 8 6.5 6M15.5 8l2-2",
  dot: "M12 12h.01",
};

export function Icon({
  name,
  className = "h-4 w-4",
  strokeWidth = 1.7,
}: {
  name: IconName;
  className?: string;
  strokeWidth?: number;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}

export default Icon;
