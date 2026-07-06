import { PLOT_CENTER_DESIGN_TOOLS } from '../../constants/plotCenterDesignTools'
import './PlotCenterDesignToolsGrid.css'

type PlotCenterDesignToolsGridProps = {
  className?: string
  compact?: boolean
}

export default function PlotCenterDesignToolsGrid({
  className = '',
  compact = false
}: PlotCenterDesignToolsGridProps) {
  return (
    <div className={`pc-design-tools${compact ? ' pc-design-tools--compact' : ''} ${className}`.trim()}>
      {PLOT_CENTER_DESIGN_TOOLS.map((tool) => (
        <a
          key={tool.id}
          href={tool.url}
          target="_blank"
          rel="noopener noreferrer"
          className="pc-design-tools-card"
        >
          <span className="pc-design-tools-icon" aria-hidden>
            {tool.icon}
          </span>
          <span className="pc-design-tools-body">
            <strong>{tool.title}</strong>
            <span>{tool.description}</span>
            <small>{tool.host}</small>
          </span>
        </a>
      ))}
    </div>
  )
}
