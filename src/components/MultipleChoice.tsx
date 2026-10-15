import { Check, X } from 'lucide-react';

interface MultipleChoiceProps {
  choices: string[];
  selected: number | null;
  onSelect: (index: number) => void;
  /** Once answered, choices lock and the correct / chosen ones are marked */
  result?: { chosen: number; correct: number } | null;
}

const MARKS = ['1', '2', '3', '4', '5', '6'];

export default function MultipleChoice({ choices, selected, onSelect, result }: MultipleChoiceProps) {
  return (
    <div className="choice-list" role="radiogroup">
      {choices.map((choice, i) => {
        const state = result
          ? i === result.correct
            ? 'correct'
            : i === result.chosen
              ? 'wrong'
              : 'dimmed'
          : selected === i
            ? 'selected'
            : '';
        return (
          <button
            key={i}
            role="radio"
            aria-checked={selected === i}
            className={`choice-item ${state}`}
            onClick={() => onSelect(i)}
            disabled={!!result}
          >
            <span className="choice-mark">{MARKS[i] ?? i + 1}</span>
            <span className="choice-text">{choice}</span>
            {state === 'correct' && <Check size={18} />}
            {state === 'wrong' && <X size={18} />}
          </button>
        );
      })}
    </div>
  );
}
