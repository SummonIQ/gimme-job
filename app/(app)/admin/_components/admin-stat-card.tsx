interface AdminStatCardProps {
  helperText?: string;
  title: string;
  value: string;
}

const AdminStatCard = ({ helperText, title, value }: AdminStatCardProps) => {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-3 backdrop-blur-md">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {title}
      </p>
      <p className="font-mono text-xl font-semibold">{value}</p>
      {helperText ? (
        <p className="text-xs text-muted-foreground">{helperText}</p>
      ) : null}
    </div>
  );
};

export { AdminStatCard };
