interface CardLibrarySkeletonProps {
  compact?: boolean
}

const SKELETON_LINE_WIDTHS = ['72%', '88%', '64%']

export function CardLibrarySkeleton({ compact = false }: CardLibrarySkeletonProps) {
  return (
    <div
      role="status"
      aria-label="正在加载卡片库"
      className="h-full w-full overflow-hidden"
    >
      <span className="sr-only">正在加载卡片库</span>
      <div
        aria-hidden="true"
        className={`mx-auto max-w-3xl ${compact ? 'px-3 pb-3 pt-1' : 'p-6'}`}
      >
        <div className={`card-library-skeleton-block w-20 ${compact ? 'h-6 mb-2' : 'h-7 mb-3'}`} />
        <div className={`card-library-skeleton-block h-9 w-full ${compact ? 'mb-3' : 'mb-4'}`} />

        <div
          data-testid="card-library-skeleton-toolbar"
          className={`flex items-center gap-2 ${compact ? 'mb-3' : 'mb-4'}`}
        >
          <div className="card-library-skeleton-block h-7 w-20" />
          {compact && <div className="card-library-skeleton-block h-7 w-20" />}
          <div className="card-library-skeleton-block h-7 w-[72px]" />
          <div className="card-library-skeleton-block ml-auto h-7 w-20" />
        </div>

        <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))' }}>
          {Array.from({ length: 6 }, (_, index) => (
            <div
              key={index}
              data-testid="card-library-skeleton-card"
              className="card-library-skeleton-card rounded-lg border border-line-default p-2.5"
              style={{ aspectRatio: '1/1', animationDelay: `${index * 55}ms` }}
            >
              <div className="card-library-skeleton-block mb-3 h-3 w-2/3" />
              {SKELETON_LINE_WIDTHS.map((width, lineIndex) => (
                <div
                  key={width}
                  className="card-library-skeleton-block mb-2 h-2.5"
                  style={{ width, opacity: 0.78 - lineIndex * 0.14 }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
