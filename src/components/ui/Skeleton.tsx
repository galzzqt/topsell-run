
import { clsx } from 'clsx';

interface SkeletonProps {
  className?: string;
  variant?: 'rect' | 'circle' | 'text' | 'badge' | 'button';
  count?: number;
  gap?: string;
}

export function Skeleton({ className, variant = 'rect', count = 1, gap = 'gap-2' }: SkeletonProps) {
  const baseClass = 'animate-pulse bg-brand-gray/50';

  const variants = {
    rect: 'rounded-lg',
    circle: 'rounded-full',
    text: 'h-4 rounded',
    badge: 'h-5 w-16 rounded-full',
    button: 'h-10 rounded-lg',
  };

  const skeleton = (
    <div
      className={clsx(
        baseClass,
        variants[variant],
        className
      )}
    />
  );

  if (count === 1) {
    return skeleton;
  }

  return (
    <div className={clsx('flex flex-col', gap)}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i}>{skeleton}</div>
      ))}
    </div>
  );
}

// Skeleton untuk stat tiles
export function StatTileSkeleton() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="bg-card-bg border border-card-border rounded-xl p-4 flex items-center justify-between gap-3">
          <div className="space-y-2">
            <Skeleton variant="text" className="w-20" />
            <Skeleton variant="text" className="w-28" />
          </div>
          <Skeleton variant="circle" className="w-10 h-10" />
        </div>
      ))}
    </div>
  );
}

// Skeleton untuk event info strip
export function EventInfoStripSkeleton() {
  return (
    <div className="bg-card-bg border border-card-border rounded-xl p-4 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
      <div className="flex items-center gap-3">
        <Skeleton variant="circle" className="w-10 h-10" />
        <div className="space-y-2">
          <Skeleton variant="text" className="w-24" />
          <Skeleton variant="text" className="w-40" />
          <Skeleton variant="text" className="w-32" />
        </div>
      </div>
      <div className="text-left sm:text-right shrink-0 space-y-1">
        <Skeleton variant="text" className="w-24" />
        <Skeleton variant="text" className="w-20" />
      </div>
    </div>
  );
}

// Skeleton untuk payment section
export function PaymentSectionSkeleton() {
  return (
    <div className="bg-card-bg border border-card-border rounded-xl p-4 flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
      <div className="flex items-start gap-3">
        <Skeleton variant="circle" className="w-10 h-10" />
        <div className="space-y-2">
          <Skeleton variant="text" className="w-32" />
          <Skeleton variant="text" className="w-48" />
          <Skeleton variant="text" className="w-56" />
        </div>
      </div>
      <div className="w-full lg:w-auto flex flex-col sm:flex-row lg:flex-col xl:flex-row gap-3 sm:items-center lg:items-end xl:items-center">
        <div className="text-left sm:text-right space-y-1">
          <Skeleton variant="text" className="w-24" />
          <Skeleton variant="text" className="w-28" />
        </div>
        <Skeleton variant="button" className="w-48" />
      </div>
    </div>
  );
}

// Skeleton untuk tabel peserta
export function ParticipantTableSkeleton() {
  return (
    <div className="bg-card-bg border border-card-border rounded-xl overflow-hidden shadow-lg flex flex-col">
      <div className="px-4 sm:px-6 py-4 border-b border-card-border flex flex-wrap gap-3 items-center justify-between">
        <div className="flex items-center gap-2">
          <Skeleton variant="badge" />
          <Skeleton variant="badge" />
          <Skeleton variant="badge" />
          <Skeleton variant="badge" />
        </div>
        <Skeleton variant="text" className="w-40" />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-card-border bg-brand-dark/20">
              <th className="px-4 py-3"><Skeleton variant="text" className="w-8" /></th>
              <th className="px-4 py-3"><Skeleton variant="text" className="w-32" /></th>
              <th className="px-4 py-3 hidden md:table-cell"><Skeleton variant="text" className="w-16" /></th>
              <th className="px-4 py-3 text-center"><Skeleton variant="text" className="w-12" /></th>
              <th className="px-4 py-3 hidden lg:table-cell"><Skeleton variant="text" className="w-20" /></th>
              <th className="px-4 py-3 text-center"><Skeleton variant="text" className="w-16" /></th>
              <th className="px-4 py-3 text-center"><Skeleton variant="text" className="w-16" /></th>
            </tr>
          </thead>
          <tbody>
            {[1, 2, 3, 4, 5].map((i) => (
              <tr key={i} className="border-b border-card-border">
                <td className="px-4 py-3.5"><Skeleton variant="text" className="w-8" /></td>
                <td className="px-4 py-3.5 space-y-1">
                  <Skeleton variant="text" className="w-32" />
                  <Skeleton variant="text" className="w-24" />
                  <Skeleton variant="text" className="w-20" />
                </td>
                <td className="px-4 py-3.5 hidden md:table-cell"><Skeleton variant="text" className="w-12" /></td>
                <td className="px-4 py-3.5 text-center"><Skeleton variant="badge" className="w-12" /></td>
                <td className="px-4 py-3.5 hidden lg:table-cell space-y-1">
                  <Skeleton variant="text" className="w-16" />
                  <Skeleton variant="text" className="w-28" />
                  <Skeleton variant="text" className="w-32" />
                </td>
                <td className="px-4 py-3.5 text-center"><Skeleton variant="badge" className="w-16" /></td>
                <td className="px-4 py-3.5 text-center"><Skeleton variant="badge" className="w-20" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Skeleton full dashboard
export function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-brand-dark flex flex-col text-foreground">
      <div className="fixed top-0 right-0 w-96 h-96 bg-sport-orange/5 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed bottom-0 left-0 w-96 h-96 bg-sport-red/5 rounded-full blur-3xl pointer-events-none" />

      <header className="sports-glass sticky top-0 z-30 w-full border-b border-card-border px-4 sm:px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Skeleton variant="circle" className="w-10 h-10" />
            <div className="space-y-1">
              <Skeleton variant="text" className="w-20" />
              <Skeleton variant="text" className="w-32" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Skeleton variant="badge" className="w-24" />
            <Skeleton variant="button" className="w-40" />
            <Skeleton variant="circle" className="w-10 h-10" />
            <Skeleton variant="circle" className="w-10 h-10" />
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 py-6 w-full flex flex-col gap-6 relative z-10">
        <StatTileSkeleton />
        <EventInfoStripSkeleton />
        <PaymentSectionSkeleton />
        <ParticipantTableSkeleton />
      </main>
    </div>
  );
}
