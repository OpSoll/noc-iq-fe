
import { useMemo } from "react";
import {
  calculateDowntimeBudget,
  calculateNines,
  classifySla,
} from "../../utils/slaAvailability";
import "./SlaAvailabilityCard.css";

type Props = {
  availability: number;
  windowLabel?: string;
};

function formatDowntime(minutes: number): string {
  const totalSeconds = Math.round(minutes * 60);

  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const mins = Math.floor((totalSeconds % 3_600) / 60);
  const secs = totalSeconds % 60;

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  if (mins > 0) return `${mins}m ${secs}s`;

  return `${secs}s`;
}

export default function SlaAvailabilityCard({
  availability,
  windowLabel = "Last 30 days",
}: Props) {
  const safeAvailability = Number.isFinite(availability)
    ? Math.max(0, Math.min(100, availability))
    : 0;

  const nines = useMemo(
    () => calculateNines(safeAvailability),
    [safeAvailability],
  );

  const classification = useMemo(
    () => classifySla(safeAvailability),
    [safeAvailability],
  );

  const downtime = useMemo(
    () => calculateDowntimeBudget(safeAvailability),
    [safeAvailability],
  );

  const ninesLabel = Number.isFinite(nines)
    ? `${nines.toFixed(2)} Nines`
    : "Perfect Availability";

  return (
    <section
      className="sla-card"
      aria-label="Service level availability"
    >
      <header className="sla-card__header">
        <span className="sla-card__title">
          SLA Availability
        </span>

        <span className="sla-card__window">
          {windowLabel}
        </span>
      </header>

      <div className="sla-card__main">
        <strong className="sla-card__percentage">
          {safeAvailability.toFixed(4)}%
        </strong>

        <span
          className={`sla-card__badge sla-card__badge--${classification.color}`}
          title={classification.description}
        >
          {ninesLabel}
        </span>
      </div>

      <div className="sla-card__downtime">
        <div className="sla-card__downtime-item">
          <span>Monthly downtime budget</span>
          <strong>{formatDowntime(downtime.monthlyMinutes)}</strong>
        </div>

        <div className="sla-card__downtime-item">
          <span>Annual downtime budget</span>
          <strong>{formatDowntime(downtime.yearlyMinutes)}</strong>
        </div>
      </div>

      <button
        type="button"
        className="sla-card__info"
        aria-label="Explain SLA downtime budget"
        title={`At ${safeAvailability.toFixed(4)}% availability, allowed downtime is ${formatDowntime(downtime.monthlyMinutes)} per 30-day month and ${formatDowntime(downtime.yearlyMinutes)} per year.`}
      >
        ⓘ Downtime budget
      </button>
    </section>
  );
}
