import { SalesStage, ProductionStage } from '../types';

export function formatCurrency(amount: number | null | undefined): string {
  if (amount == null) return '$0.00';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatDateShort(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function timeAgo(dateStr: string): string {
  const now = new Date();
  const d = new Date(dateStr);
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return `${Math.floor(diffDays / 30)}mo ago`;
}

export function salesStageColor(stage: SalesStage): string {
  const colors: Record<SalesStage, string> = {
    'New Lead': 'badge-info',
    'Contacted': 'badge-primary',
    'Qualified Lead': 'badge-secondary',
    'Quoted': 'badge-warning',
    'Negotiation': 'badge-warning',
    'Deposit Received': 'badge-success',
    'Project Started': 'badge-success',
  };
  return colors[stage] || 'badge-ghost';
}

export function productionStageColor(stage: ProductionStage): string {
  const earlyStages: ProductionStage[] = ['Deposit Received', 'Purchasing Ingredients', 'Ingredients Ordered', 'Ingredients Received'];
  const midStages: ProductionStage[] = ['Sample Batching', 'Samples Sent to Customer', 'Sample Revision Required', 'Sample Approved'];
  const lateStages: ProductionStage[] = ['Production Scheduled', 'Production In Progress', 'Quality Control', 'Packaging'];
  const finalStages: ProductionStage[] = ['Ready to Ship', 'Payment Pending', 'Shipped', 'Completed'];

  if (earlyStages.includes(stage)) return 'badge-info';
  if (midStages.includes(stage)) return 'badge-warning';
  if (lateStages.includes(stage)) return 'badge-primary';
  if (finalStages.includes(stage)) return 'badge-success';
  return 'badge-ghost';
}

export function priorityColor(priority: string): string {
  if (priority === 'vip') return 'badge-error';
  if (priority === 'high') return 'badge-warning';
  return 'badge-ghost';
}

export function productionProgress(stage: ProductionStage): number {
  const stages: ProductionStage[] = [
    'Deposit Received', 'Purchasing Ingredients', 'Ingredients Ordered', 'Ingredients Received',
    'Sample Batching', 'Samples Sent to Customer', 'Sample Revision Required', 'Sample Approved',
    'Production Scheduled', 'Production In Progress', 'Quality Control', 'Packaging',
    'Ready to Ship', 'Payment Pending', 'Shipped', 'Completed',
  ];
  const idx = stages.indexOf(stage);
  if (idx === -1) return 0;
  return Math.round(((idx + 1) / stages.length) * 100);
}

export function escSql(val: string | null | undefined): string {
  if (val == null) return 'NULL';
  return "'" + String(val).replace(/'/g, "''") + "'";
}
