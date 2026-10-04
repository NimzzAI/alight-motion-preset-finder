type Props = { username: string; nickname: string; avatar: string | null };

export function Author({ username, nickname, avatar }: Props) {
  return (
    <div className="author">
      {avatar ? <img src={avatar} alt="" referrerPolicy="no-referrer" /> : <span className="avatar-empty" />}
      <div>
        <strong>{nickname || username || "Tanpa nama"}</strong>
        {username && <span className="mono muted">@{username}</span>}
      </div>
    </div>
  );
}
