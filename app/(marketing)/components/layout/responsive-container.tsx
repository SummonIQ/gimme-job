const ResponsiveContainer = ({
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => {
  return (
    <div
      {...props}
      className={`mx-auto w-full max-w-7xl px-6 lg:px-8 ${
        props.className || ''
      }`}
    >
      {children}
    </div>
  );
};

export { ResponsiveContainer };
