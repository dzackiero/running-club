import {
  Footprints,
  Mountain,
  SportShoe,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import { activityTypes, type ActivityType } from "@running-club/shared";

export const ACTIVITY_LABELS: Record<ActivityType, string> = {
  run: "Run",
  walk: "Walk",
  trail: "Trail",
  treadmill: "Treadmill",
  race: "Race",
};

export function activityLabel(type: string): string {
  if (activityTypes.includes(type as ActivityType)) {
    return ACTIVITY_LABELS[type as ActivityType];
  }
  return type;
}

const ACTIVITY_ICONS: Record<ActivityType, LucideIcon> = {
  run: SportShoe,
  walk: Footprints,
  trail: Mountain,
  treadmill: SportShoe,
  race: Trophy,
};

export function ActivityIcon({
  type,
  className = "size-4 text-primary",
}: {
  type: string;
  className?: string;
}) {
  const Icon =
    activityTypes.includes(type as ActivityType)
      ? ACTIVITY_ICONS[type as ActivityType]
      : SportShoe;
  return <Icon className={className} aria-hidden />;
}
