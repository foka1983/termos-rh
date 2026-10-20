import { LOGO_OFFWHITE, LOGO_TERRACOTA } from "./logos";

export default function Logo({ variant, height = 28 }: { variant: "claro" | "escuro"; height?: number }) {
  // "claro" = logo off-white (para fundos escuros); "escuro" = logo terracota (para fundos claros)
  const svg = variant === "claro" ? LOGO_OFFWHITE : LOGO_TERRACOTA;
  return (
    <span
      className="jfl-logo"
      role="img"
      aria-label="JFL"
      style={{ height, display: "inline-block", lineHeight: 0 }}
      dangerouslySetInnerHTML={{ __html: svg.replace("<svg ", `<svg style="height:${height}px;width:auto" `) }}
    />
  );
}
