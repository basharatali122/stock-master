import React, { memo } from 'react';
import { cn } from '@/lib/utils';

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Variant of the skeleton
   * - text: For text content (shorter height)
   * - title: For headings (medium height)
   * - card: For card placeholders (full height block)
   * - avatar: Circular skeleton for avatars
   * - button: Button-sized skeleton
   */
  variant?: 'text' | 'title' | 'card' | 'avatar' | 'button';
  /**
   * Width of the skeleton
   */
  width?: string | number;
  /**
   * Height of the skeleton
   */
  height?: string | number;
  /**
   * Whether to animate the skeleton
   */
  animate?: boolean;
}

const Skeleton = memo(function Skeleton({
  className,
  variant = 'text',
  width,
  height,
  animate = true,
  ...props
}: SkeletonProps) {
  const variantStyles = {
    text: 'h-4 rounded',
    title: 'h-6 rounded',
    card: 'h-32 rounded-lg',
    avatar: 'h-10 w-10 rounded-full',
    button: 'h-9 w-24 rounded-md',
  };

  return (
    <div
      className={cn(
        'bg-muted',
        animate && 'animate-pulse',
        variantStyles[variant],
        className
      )}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
      }}
      {...props}
    />
  );
});

// Pre-built skeleton layouts for common patterns
export const StatCardSkeleton = memo(function StatCardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card p-6 animate-pulse">
      <div className="flex items-center justify-between mb-4">
        <Skeleton variant="text" width="60%" animate={false} />
        <Skeleton variant="avatar" className="h-8 w-8" animate={false} />
      </div>
      <Skeleton variant="title" width="80%" className="mb-2" animate={false} />
      <Skeleton variant="text" width="40%" animate={false} />
    </div>
  );
});

export const TableRowSkeleton = memo(function TableRowSkeleton({ columns = 4 }: { columns?: number }) {
  return (
    <tr className="animate-pulse">
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="p-3">
          <Skeleton variant="text" width={`${60 + Math.random() * 30}%`} animate={false} />
        </td>
      ))}
    </tr>
  );
});

export const DashboardSkeleton = memo(function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <Skeleton variant="title" width={200} className="mb-2" animate={false} />
          <Skeleton variant="text" width={300} animate={false} />
        </div>
        <Skeleton variant="button" animate={false} />
      </div>

      {/* Daily stats card */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center gap-3 mb-4">
          <Skeleton variant="avatar" className="h-12 w-12" animate={false} />
          <div>
            <Skeleton variant="text" width={120} className="mb-1" animate={false} />
            <Skeleton variant="text" width={180} animate={false} />
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-lg bg-muted/50 p-4">
              <Skeleton variant="text" width="60%" className="mb-2" animate={false} />
              <Skeleton variant="title" width="80%" animate={false} />
            </div>
          ))}
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
});

export { Skeleton };
export default Skeleton;