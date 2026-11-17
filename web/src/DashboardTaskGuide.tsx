import { useEffect, useRef } from 'react';
import { ArrowDown, BookOpen } from 'lucide-react';
import { businessQuestions } from './dashboardDiscovery';
import type { Dashboard } from './model';

interface Props {
  dashboard: Dashboard;
  questionId: string;
  widgetId: string;
}

export function DashboardTaskGuide({ dashboard, questionId, widgetId }: Props) {
  const heading = useRef<HTMLHeadingElement>(null);
  const question = businessQuestions.find(item => item.id === questionId);
  const widget = dashboard.widgets.find(item => item.id === widgetId);
  useEffect(() => { heading.current?.focus(); }, []);
  if (!question || !widget || widget.datasetKey !== question.datasetKey || widget.metricKey !== question.metricKey
    || widget.dimensionKey !== question.dimensionKey) return null;

  function focusAnswer() {
    const target = document.getElementById(`widget-heading-${widgetId}`);
    target?.scrollIntoView({ block: 'center', behavior: 'instant' });
    target?.focus({ preventScroll: true });
  }

  return <section className="task-guide" aria-labelledby="task-guide-title">
    <div className="task-guide-icon"><BookOpen size={20} aria-hidden="true" /></div>
    <div className="task-guide-copy">
      <span className="eyebrow">YOUR STARTING POINT · SAMPLE DATA</span>
      <h2 id="task-guide-title" tabIndex={-1} ref={heading}>{question.question}</h2>
      <p>Start with <strong>{widget.title}</strong>. {widget.kind === 'table'
        ? 'Use the table to inspect exact fictional values.'
        : widget.kind === 'metric' ? 'Review the displayed total for the selected period.'
          : 'Read the “At a glance” summary and open “View data table” for exact fictional values.'} Available filters can help you compare results.</p>
    </div>
    <button type="button" className="button button-primary" onClick={focusAnswer}>Go to {widget.title} <ArrowDown size={16} aria-hidden="true" /></button>
  </section>;
}
