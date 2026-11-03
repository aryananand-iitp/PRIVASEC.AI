import { ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Logo({ className, size = 28 }: { className?: string; size?: number }) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <div className="relative">
        <div
          className="flex items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm"
          style={{ width: size + 6, height: size + 6 }}
        >
          <ShieldCheck style={{ width: size - 6, height: size - 6 }} strokeWidth={2.2} />
        </div>
        <span
          className="absolute -bottom-0.5 -right-0.5 block rounded-full bg-accent ring-2 ring-card"
          style={{ width: size / 3, height: size / 3 }}
        />
      </div>
      <div className="leading-none">
        <span className="font-display text-lg font-bold tracking-tight text-foreground">
          PRIVASEC
        </span>
        <span className="ml-1 font-display text-lg font-bold tracking-tight text-accent">AI</span>
      </div>
    </div>
  );
}
