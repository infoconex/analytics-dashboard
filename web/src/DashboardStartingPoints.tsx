import { ArrowRight, Compass, Lightbulb } from 'lucide-react';
import { businessQuestions, findQuestionMatches, type QuestionMatch } from './dashboardDiscovery';
import type { Dashboard } from './model';

interface Props {
  dashboards: Dashboard[];
  organizationId: string;
  onOpen: (match: QuestionMatch, questionId: string) => void;
  onBrowse: () => void;
}

export function DashboardStartingPoints({ dashboards, organizationId, onOpen, onBrowse }: Props) {
  const suggestions = businessQuestions.map(question => ({
    question, match: findQuestionMatches(dashboards, organizationId, question.id)[0] ?? null,
  }));
  return <section className="starting-points" aria-labelledby="starting-points-title">
    <div className="starting-points-heading">
      <div className="starting-points-icon"><Compass size={21} aria-hidden="true" /></div>
      <div><div className="eyebrow">A GOOD PLACE TO START</div>
        <h2 id="starting-points-title">What would you like to understand?</h2>
        <p>Choose a question to open a matching dashboard using fictional sample data.</p></div>
    </div>
    <div className="question-cards">
      {suggestions.map(({ question, match }) => <article className="question-card" key={question.id}>
        <div className="question-icon"><Lightbulb size={18} aria-hidden="true" /></div>
        <h3>{question.question}</h3>
        <p>{question.description}</p>
        {match ? <button type="button" onClick={() => onOpen(match, question.id)}
          aria-label={`Explore: ${question.question} in ${match.dashboard.name}`}>
          Explore answer <ArrowRight size={16} aria-hidden="true" />
        </button> : <span className="question-unavailable">No matching dashboard here yet</span>}
      </article>)}
    </div>
    <div className="starting-points-footer">Looking for something else? <button type="button" className="text-link" onClick={onBrowse}>Browse all dashboards <ArrowRight size={16} aria-hidden="true" /></button></div>
  </section>;
}
