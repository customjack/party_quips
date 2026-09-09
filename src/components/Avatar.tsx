import type { Avatar as AvatarName } from "../domain/types";
export function Avatar({
  name,
  color = "#ffc83d",
  size = "md",
}: {
  name: AvatarName;
  color?: string;
  size?: "sm" | "md" | "lg";
}) {
  return (
    <span
      className={`avatar avatar-${size}`}
      style={{ backgroundColor: color }}
      aria-hidden
    >
      {name}
    </span>
  );
}
