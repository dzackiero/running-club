import { decodePolyline } from "@/lib/polyline";

export function RunRouteScribble({ polyline }: { polyline: string }) {
  const points = decodePolyline(polyline);
  if (points.length < 2) return null;

  const lats = points.map((point) => point.lat);
  const lngs = points.map((point) => point.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const width = Math.max(maxLng - minLng, 0.0001);
  const height = Math.max(maxLat - minLat, 0.0001);
  const pad = 8;
  const vbWidth = 320;
  const vbHeight = 160;
  const scale = Math.min(
    (vbWidth - pad * 2) / width,
    (vbHeight - pad * 2) / height,
  );
  const offsetX = (vbWidth - width * scale) / 2;
  const offsetY = (vbHeight - height * scale) / 2;

  const d = points
    .map((point, index) => {
      const x = offsetX + (point.lng - minLng) * scale;
      const y = offsetY + (maxLat - point.lat) * scale;
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <div className="space-y-2">
      <h2 className="text-xs font-semibold tracking-wide text-primary uppercase">
        Route
      </h2>
      <svg
        viewBox={`0 0 ${vbWidth} ${vbHeight}`}
        className="h-40 w-full text-primary"
        aria-hidden="true"
      >
        <path
          d={d}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
