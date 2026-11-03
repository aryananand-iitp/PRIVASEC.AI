'use client';

import { Check } from 'lucide-react';
import { scannerSteps, type StepStatus } from './steps';
import { cn } from '@/lib/utils';

export function StepIndicator({ current, statuses }: { current: number; statuses: StepStatus[] }) {
  return (
    <nav aria-label="Scanner progress" className="w-full overflow-x-auto">
      <ol className="flex min-w-max items-center gap-1 px-1">
        {scannerSteps.map((step, idx) => {
          const status = statuses[idx];
          return (
            <li key={step.key} className="flex flex-1 items-center gap-1">
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className={cn(
                    'flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-semibold transition-all duration-300',
                    status === 'complete' && 'border-success bg-success text-success-foreground',
                    status === 'active' && 'border-primary bg-primary text-primary-foreground ring-4 ring-primary/20',
                    status === 'pending' && 'border-border bg-card text-muted-foreground',
                  )}
                >
                  {status === 'complete' ? <Check className="h-4 w-4" /> : idx + 1}
                </div>
                <div className="text-center">
                  <p className={cn('text-xs font-medium whitespace-nowrap', status === 'active' ? 'text-foreground' : 'text-muted-foreground')}>
                    {step.label}
                  </p>
                </div>
              </div>
              {idx < scannerSteps.length - 1 && (
                <div className={cn('mx-2 h-0.5 flex-1 rounded-full transition-colors duration-300', status === 'complete' ? 'bg-success' : 'bg-border')} />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}