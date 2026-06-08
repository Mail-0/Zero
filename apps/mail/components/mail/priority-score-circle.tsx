import { cn } from '@/lib/utils';

function getPriorityScoreColor(score: number): string {
  const clamped = Math.max(0, Math.min(100, score));
  const hue = 120 * (1 - clamped / 100);
  return `hsl(${hue}, 65%, 42%)`;
}

function isValidPriorityScore(score: number | null | undefined): score is number {
  return typeof score === 'number' && Number.isFinite(score);
}

interface PriorityScoreCircleProps {
  score?: number | null;
  className?: string;
}

export function PriorityScoreCircle({ score, className }: PriorityScoreCircleProps) {
  const hasScore = isValidPriorityScore(score);
  const displayScore = hasScore ? Math.round(Math.max(0, Math.min(100, score))) : null;

  return (
    <div
      className={cn(
        'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold leading-none',
        hasScore ? 'text-white' : 'border border-border bg-white text-muted-foreground',
        className,
      )}
      style={hasScore && displayScore !== null ? { backgroundColor: getPriorityScoreColor(displayScore) } : undefined}
      title={hasScore ? `Priority: ${displayScore}` : 'Priority: N/A'}
    >
      {hasScore ? displayScore : 'N/A'}
    </div>
  );
}
