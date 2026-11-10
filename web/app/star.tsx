// The six-pointed star from the Chicago flag; marks today on the line.
export function Star({ size = 22, title }: { size?: number; title?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" role={title ? "img" : undefined} aria-hidden={title ? undefined : true}>
      {title ? <title>{title}</title> : null}
      <path fill="currentColor" d="M24 1.5l5.3 12.3 13.3-1.5-8 10.7 8 10.7-13.3-1.5L24 46.5l-5.3-12.3-13.3 1.5 8-10.7-8-10.7 13.3 1.5z" />
    </svg>
  );
}
