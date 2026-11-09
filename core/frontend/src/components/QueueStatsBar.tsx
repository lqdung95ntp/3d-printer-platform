import { Play, Clock, Timer, Weight, CheckCircle } from 'lucide-react';
import { formatDuration } from '../utils/date';

function formatWeight(g: number): string {
  if (g >= 1000) return `${(g / 1000).toFixed(1)}kg`;
  return `${Math.round(g)}g`;
}

export function QueueStatsBar({
  activeCount,
  pendingCount,
  totalTime,
  totalWeight,
  historyCount,
  t,
}: {
  activeCount: number;
  pendingCount: number;
  totalTime: number;
  totalWeight: number;
  historyCount?: number;
  t: (key: string) => string;
}) {
  const stats = [
    { icon: Play, value: activeCount, label: t('queue.summary.printing'), color: 'text-blue-500 dark:text-blue-400' },
    { icon: Clock, value: pendingCount, label: t('queue.summary.queued'), color: 'text-yellow-500 dark:text-yellow-400' },
    { icon: Timer, value: formatDuration(totalTime), label: t('queue.summary.totalTime'), color: 'text-bambu-green' },
    { icon: Weight, value: formatWeight(totalWeight), label: t('queue.summary.totalWeight'), color: 'text-purple-500 dark:text-purple-400' },
    ...(historyCount !== undefined && historyCount > 0
      ? [{ icon: CheckCircle, value: historyCount, label: t('queue.summary.history'), color: 'text-bambu-gray' }]
      : []),
  ];

  return (
    <div className="flex items-center gap-2 sm:gap-4 flex-wrap px-3 py-1.5 sm:py-2 bg-bambu-dark-secondary/70 rounded-lg border border-bambu-dark-tertiary mb-3 sm:mb-4 text-xs">
      {stats.map((stat, i) => (
        <div key={i} className="flex items-center gap-2 sm:gap-3">
          {i > 0 && <span className="text-bambu-dark-tertiary">|</span>}
          <div className="flex items-center gap-1.5 whitespace-nowrap">
            <stat.icon className={`w-3.5 h-3.5 ${stat.color} flex-shrink-0`} />
            <span className="font-semibold text-white">{stat.value}</span>
            <span className="text-[11px] sm:text-xs text-bambu-gray">{stat.label}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
