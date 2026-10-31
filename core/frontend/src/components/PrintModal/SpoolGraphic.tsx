import { spoolColorString } from '../../utils/colors';

interface SpoolGraphicProps {
  color?: string | null;
  isEmpty?: boolean;
  className?: string;
}

/**
 * SpoolGraphic renders a 3D isometric Bambu Studio style filament spool.
 * Shows the metallic outer flanges and inner wound filament with the given color.
 */
export function SpoolGraphic({ color, isEmpty = false, className = 'w-7 h-5' }: SpoolGraphicProps) {
  const fillColor = isEmpty || !color ? '#374151' : spoolColorString(color);

  return (
    <svg
      viewBox="0 0 28 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 ${className}`}
      aria-hidden="true"
    >
      {/* Back / Right flange rim */}
      <path
        d="M22 2.5C24 2.5 25.5 5.5 25.5 10C25.5 14.5 24 17.5 22 17.5"
        stroke="#9CA3AF"
        strokeWidth="1.5"
        strokeLinecap="round"
      />

      {/* Filament winding cylinder */}
      <rect
        x="5.5"
        y="3.5"
        width="17"
        height="13"
        rx="1.5"
        fill={fillColor}
        opacity={isEmpty ? 0.35 : 1}
      />

      {/* Filament subtle shine / shadow texture */}
      {!isEmpty && color && (
        <>
          <line
            x1="6"
            y1="6"
            x2="22.5"
            y2="6"
            stroke="white"
            strokeOpacity="0.3"
            strokeWidth="1"
          />
          <line
            x1="6"
            y1="14"
            x2="22.5"
            y2="14"
            stroke="black"
            strokeOpacity="0.3"
            strokeWidth="1"
          />
        </>
      )}

      {/* Front / Left flange */}
      <ellipse
        cx="5.5"
        cy="10"
        rx="3.8"
        ry="7.5"
        fill="#2A2D32"
        stroke="#E5E7EB"
        strokeWidth="1.5"
      />

      {/* Inner spindle hub hole */}
      <ellipse
        cx="5.5"
        cy="10"
        rx="1.5"
        ry="3.2"
        fill="#111827"
        stroke="#9CA3AF"
        strokeWidth="0.8"
      />
    </svg>
  );
}
