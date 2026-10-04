type Props = { message: string; elapsed: number };

export function Status({ message, elapsed }: Props) {
  return (
    <div className="status" role="status">
      <div className="bar" />
      <p>
        {message} <span className="mono">{elapsed} dtk</span>
      </p>
      {elapsed >= 12 && <p className="muted">Komentar yang banyak bisa makan waktu sampai setengah menit.</p>}
    </div>
  );
}
