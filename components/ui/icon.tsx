import type { SVGProps } from "react";

// Stroke icons on a 24px grid (Tabler, MIT), the same set the Paper designs use.
const paths = {
  // Navigation
  dashboard: ["M4 4h6v8H4zM14 4h6v5h-6zM14 13h6v7h-6zM4 16h6v4H4z"],
  calendar: ["M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7zM16 3v4M8 3v4M4 11h16"],
  list: ["M9 6h11M9 12h11M9 18h11M5 6h.01M5 12h.01M5 18h.01"],
  repeat: ["M4 12a8 8 0 0 1 14-5.3M20 4v4h-4M20 12a8 8 0 0 1-14 5.3M4 20v-4h4"],
  "credit-card": ["M3 8a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V8zM3 10h18M7 15h.01M11 15h2"],
  users: ["M5 7a4 4 0 1 0 8 0a4 4 0 1 0-8 0M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2M16 3.1a4 4 0 0 1 0 7.8M21 21v-2a4 4 0 0 0-3-3.9"],
  news: ["M4 5h16v14H4zM4 9h16M8 13h5M8 16h8"],
  "calendar-star": [
    "M4 6.5h16v13.5H4zM4 10.5h16M8.5 4v4M15.5 4v4M12 13l1 2 2.2.3-1.6 1.5.4 2.2-2-1-2 1 .4-2.2-1.6-1.5 2.2-.3z",
  ],
  bell: ["M10 5a2 2 0 1 1 4 0a7 7 0 0 1 4 6v3a4 4 0 0 0 2 3H4a4 4 0 0 0 2-3v-3a7 7 0 0 1 4-6M9 17v1a3 3 0 0 0 6 0v-1"],
  "layout-grid": ["M4 4h16v16H4zM4 12h16M12 4v16"],
  adjustments: ["M4 6h8M16 6h4M4 12h2M10 12h10M4 18h12M14 4v4M8 10v4M18 16v4"],
  shield: ["M12 3l7 3v5c0 4.5-3 8.5-7 10c-4-1.5-7-5.5-7-10V6l7-3z"],

  // Actions
  plus: ["M12 5v14M5 12h14"],
  x: ["M6 6l12 12M18 6L6 18"],
  check: ["M5 12l5 5L20 7"],
  search: ["M3 10a7 7 0 1 0 14 0a7 7 0 1 0-14 0M21 21l-6-6"],
  download: ["M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2M7 11l5 5l5-5M12 4v12"],
  dots: ["M5 12h.01M12 12h.01M19 12h.01"],
  "chevron-down": ["M6 9l6 6l6-6"],
  "chevron-left": ["M15 18l-6-6l6-6"],
  "chevron-right": ["M9 6l6 6l-6 6"],
  "chevron-up": ["M6 15l6-6l6 6"],
  send: ["M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"],
  eye: ["M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z", "M9 12a3 3 0 1 0 6 0a3 3 0 1 0-6 0"],
  "eye-off": [
    "M3 3l18 18",
    "M10.6 5.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4M6.6 6.6C3.9 8.4 2 12 2 12s3.6 7 10 7a9.6 9.6 0 0 0 5.4-1.6",
    "M9.9 9.9a3 3 0 0 0 4.2 4.2",
  ],
  lock: ["M5 13a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-6zM8 11V7a4 4 0 0 1 8 0v4"],
  logout: ["M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4", "M16 17l5-5-5-5M21 12H9"],
  ban: ["M3 12a9 9 0 1 0 18 0a9 9 0 1 0-18 0M5.7 5.7l12.6 12.6"],
  "circle-x": ["M3 12a9 9 0 1 0 18 0a9 9 0 1 0-18 0M15 9l-6 6M9 9l6 6"],

  // Objects and states
  user: ["M8 7a4 4 0 1 0 8 0a4 4 0 0 0-8 0M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"],
  cash: ["M2 8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8z", "M9.5 12a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0-5 0"],
  transfer: ["M7 7h13l-3-3M17 17H4l3 3"],
  qrcode: ["M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h3v3h-3zM20 14v1M14 20h1M18 18h3v3h-3"],
  mail: ["M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z", "M3 7l9 6l9-6"],
  clock: ["M3 12a9 9 0 1 0 18 0a9 9 0 0 0-18 0M12 7v5l3 2"],
  info: ["M3 12a9 9 0 1 0 18 0a9 9 0 1 0-18 0M12 8h.01M11 12h1v4h1"],
  help: ["M3 12a9 9 0 1 0 18 0a9 9 0 1 0-18 0M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.7M12 17h.01"],
  alert: ["M12 3l10 18H2L12 3zM12 10v4M12 17.5v.5"],
  // Same marks as the app's event detail rows (Social / 07).
  "map-pin": ["M12 21s-6.5-5.6-6.5-11A6.5 6.5 0 0 1 18.5 10c0 5.4-6.5 11-6.5 11z", "M9.7 10a2.3 2.3 0 1 0 4.6 0a2.3 2.3 0 1 0-4.6 0"],
  ticket: [
    "M4 8.5a2 2 0 0 0 0 4v3.5a1.5 1.5 0 0 0 1.5 1.5h13a1.5 1.5 0 0 0 1.5-1.5v-3.5a2 2 0 0 1 0-4V6.5A1.5 1.5 0 0 0 18.5 5h-13A1.5 1.5 0 0 0 4 6.5z",
    "M14 5v1.5M14 10v2M14 15.5v2",
  ],
} as const;

export type IconName = keyof typeof paths;

type IconProps = Omit<SVGProps<SVGSVGElement>, "children"> & {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  /** Pass a label only when the icon carries meaning on its own. Otherwise it's hidden from screen readers. */
  label?: string;
};

/** Inherits its color from `currentColor`, so set the color with a text-* class. */
export function Icon({ name, size = 20, strokeWidth = 2, label, className, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className ? `shrink-0 ${className}` : "shrink-0"}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      {...rest}
    >
      {paths[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
