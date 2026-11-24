import React from 'react';
import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  variant?: 'default' | 'primary' | 'accent' | 'success' | 'warning';
}

const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  icon: Icon,
  trend,
  variant = 'default',
}) => {
  const variantClasses = {
    default: 'stat-card',
    primary: 'stat-card-primary',
    accent: 'stat-card-accent',
    success: 'stat-card-success',
    warning: 'stat-card bg-warning/10 border-warning/20',
  };

  const iconBgClasses = {
    default: 'bg-primary/10 text-primary',
    primary: 'bg-primary/10 text-primary',
    accent: 'bg-info/10 text-info',
    success: 'bg-success/10 text-success',
    warning: 'bg-warning/20 text-warning',
  };

  const textClasses = {
    default: 'text-foreground',
    primary: 'text-foreground',
    accent: 'text-foreground',
    success: 'text-foreground',
    warning: 'text-foreground',
  };

  const subtextClasses = {
    default: 'text-muted-foreground',
    primary: 'text-muted-foreground',
    accent: 'text-muted-foreground',
    success: 'text-muted-foreground',
    warning: 'text-muted-foreground',
  };

  return (
    <div className={`${variantClasses[variant]} animate-fade-in`}>
      <div className="flex items-start justify-between">
        <div className={`rounded-lg p-2.5 ${iconBgClasses[variant]}`}>
          <Icon className="h-5 w-5" />
        </div>
        {trend && (
          <div
            className={`flex items-center gap-1 text-sm font-medium ${
              trend.isPositive ? 'text-success' : 'text-destructive'
            }`}
          >
            {trend.isPositive ? (
              <TrendingUp className="h-4 w-4" />
            ) : (
              <TrendingDown className="h-4 w-4" />
            )}
            <span>{Math.abs(trend.value)}%</span>
          </div>
        )}
      </div>
      <div className="mt-4">
        <p className={`text-sm font-medium ${subtextClasses[variant]}`}>{title}</p>
        <p className={`mt-1 text-2xl font-bold ${textClasses[variant]}`}>{value}</p>
      </div>
    </div>
  );
};

export default StatCard;
