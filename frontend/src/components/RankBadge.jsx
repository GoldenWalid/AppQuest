export const RankBadge = ({ rank, className = "" }) => {
  const r = (rank || "E").toUpperCase();
  return (
    <span data-testid={`rank-badge-${r}`} className={`rank-badge rank-${r} ${className}`}>
      {r}-RANK
    </span>
  );
};
