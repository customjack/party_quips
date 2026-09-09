import {
  BookOpen,
  Check,
  Star,
  ThumbsUp,
  X,
} from "lucide-react";
import type { ReactionId } from "../domain/types";

// Inspired by the move-classification symbols published in Chess.com's
// official brand resources. These are local, lightweight SVG renderings so
// Party Quips does not need to fetch third-party images while a game is active.
const APPEARANCE: Record<
  ReactionId,
  { background: string; glyph?: string; icon?: "book" | "check" | "star" | "thumb" | "x" }
> = {
  brilliant: { background: "#26c2aa", glyph: "!!" },
  "great-move": { background: "#78a0c5", glyph: "!" },
  "best-move": { background: "#78b84b", icon: "star" },
  excellent: { background: "#78b84b", icon: "thumb" },
  good: { background: "#7c9666", icon: "check" },
  book: { background: "#d5a479", icon: "book" },
  inaccuracy: { background: "#f4bd24", glyph: "?!" },
  mistake: { background: "#ffa45b", glyph: "?" },
  miss: { background: "#ff716a", icon: "x" },
  blunder: { background: "#f63731", glyph: "??" },
};

export function ReactionIcon({
  reaction,
  className = "",
}: {
  reaction: ReactionId;
  className?: string;
}) {
  const appearance = APPEARANCE[reaction],
    shared = { size: 28, strokeWidth: 4 };
  return (
    <span
      aria-hidden="true"
      className={`chess-reaction-icon ${className}`}
      style={{ background: appearance.background }}
    >
      {appearance.glyph && <b>{appearance.glyph}</b>}
      {appearance.icon === "star" && <Star {...shared} fill="currentColor" />}
      {appearance.icon === "thumb" && <ThumbsUp {...shared} fill="currentColor" />}
      {appearance.icon === "check" && <Check {...shared} />}
      {appearance.icon === "book" && <BookOpen {...shared} fill="currentColor" />}
      {appearance.icon === "x" && <X {...shared} />}
    </span>
  );
}
