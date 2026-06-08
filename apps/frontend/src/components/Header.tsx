interface HeaderProps {
  title?: string;
  children?: React.ReactNode;
}

export default function Header({ title, children }: HeaderProps) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-2">
      <div className="flex items-center gap-2 px-4">
        {title && (
          <h1 className="text-lg font-semibold text-foreground">{title}</h1>
        )}
      </div>
      {children && <div className="ml-auto pr-4">{children}</div>}
    </header>
  );
}
