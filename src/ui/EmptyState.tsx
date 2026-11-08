import { Link } from "react-router";

/** Leerzustand mit Hinweistext und optionaler Handlungsaufforderung. */
export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint: string;
  action?: { label: string; to: string };
}) {
  return (
    <section className="empty-state" aria-labelledby="empty-state-title">
      <h2 id="empty-state-title">{title}</h2>
      <p>{hint}</p>
      {action ? (
        <Link className="button" to={action.to}>
          {action.label}
        </Link>
      ) : null}
    </section>
  );
}
