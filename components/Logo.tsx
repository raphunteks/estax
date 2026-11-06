/** Estaka mark: an E and a tooth sliced by a scan beam. Uses currentColor so it follows the theme. */
export default function Logo({ size = 32, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 256 256" className={className} role="img" aria-label="Estaka Dental Clinic" fill="currentColor">
      <mask id="es" maskUnits="userSpaceOnUse" x="0" y="0" width="256" height="256">
        <rect width="256" height="256" fill="#fff" />
        <rect x="130" y="112" width="120" height="9" rx="4.5" fill="#000" transform="rotate(-6 190 116)" />
      </mask>
      <rect x="32" y="36" width="28" height="184" rx="14" />
      <rect x="32" y="36" width="92" height="28" rx="14" />
      <rect x="32" y="114" width="72" height="28" rx="14" />
      <rect x="32" y="192" width="92" height="28" rx="14" />
      <g mask="url(#es)">
        <path transform="translate(142 46)" d="M16 30C16 10 34 4 48 14C54 18 58 18 64 14C78 4 96 10 96 30C96 52 88 70 86 100L82 150C81 162 70 166 66 154L58 112C57 106 51 106 50 112L44 154C40 166 29 162 28 150L24 100C22 70 16 52 16 30Z" />
      </g>
    </svg>
  );
}
