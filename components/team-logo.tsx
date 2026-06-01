import { teamLogo, teamName } from "@/lib/teams";

// Small team logo + (optional) name. Uses a plain <img> against ESPN's CDN so
// we don't need next/image remote config. Sized in px so it stays crisp on
// mobile retina screens.
export function TeamLogo({
  abbr,
  size = 20,
  withName = false,
  className = "",
}: {
  abbr: string;
  size?: number;
  withName?: boolean;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={teamLogo(abbr)}
        alt=""
        width={size}
        height={size}
        loading="lazy"
        className="inline-block object-contain"
        style={{ width: size, height: size }}
      />
      {withName && <span>{teamName(abbr)}</span>}
    </span>
  );
}
