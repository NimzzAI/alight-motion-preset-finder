type Props = { message: string; elapsed: number };

export function Status({ message, elapsed }: Props) {
  return (
    <div className="status" role="status">
      <div className="bar" />
      <p className="status-text">
        <span className="status-dot" aria-hidden="true" />
        <span>{message}</span>
        <span className="mono status-timer">{elapsed} dtk</span>
      </p>
      {elapsed >= 12 && <p className="muted status-notice">Komentar yang banyak bisa makan waktu sampai setengah menit.</p>}
    </div>
  );
}
