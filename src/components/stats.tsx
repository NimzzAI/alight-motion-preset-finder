import { fmtNum } from "../lib/validate";

type Props = { items: [label: string, value: number | null][] };

export function Stats({ items }: Props) {
  const shown = items.filter(([, v]) => v != null);
  if (!shown.length) return null;
  return (
    <dl className="stats">
      {shown.map(([label, value]) => (
        <div key={label}>
          <dd>{fmtNum(value as number)}</dd>
          <dt>{label}</dt>
        </div>
      ))}
    </dl>
  );
}
