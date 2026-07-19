interface CollapsedContentProps {
  body: string
  isEmpty: boolean
  textColor: string
}

export function CollapsedContent({ body, isEmpty, textColor }: CollapsedContentProps) {

  return (
    <div
      className="flex flex-col justify-center overflow-hidden px-3"
      style={{ height: 'calc(100% - 28px)', minWidth: 0 }}
    >
      {(body || isEmpty) && (
        <span
          style={{
            color: textColor,
            display: '-webkit-box',
            WebkitBoxOrient: 'vertical',
            WebkitLineClamp: 2,
            overflow: 'hidden',
            fontSize: 13,
            lineHeight: 1.35,
            opacity: body ? 0.7 : 0.5,
          }}
        >
          {body || '空卡片'}
        </span>
      )}
    </div>
  )
}
