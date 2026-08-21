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
