export function formatDeadline(date: Date | string, now = new Date()): string {
  const d = new Date(date);
  const diffMs = d.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / 86_400_000);

  if (diffDays < 0) return 'passed';
  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'tomorrow';
  if (diffDays < 7) return `${diffDays} days`;
  if (diffDays < 14) return '1 week';
  if (diffDays < 30) return `${Math.round(diffDays / 7)} weeks`;
  if (diffDays < 60) return '1 month';
  if (diffDays < 365) return `${Math.round(diffDays / 30)} months`;

  const years = Math.floor(diffDays / 365);
  const remainingDays = diffDays - years * 365;
  const months = Math.round(remainingDays / 30);

  if (months === 0) return `${years} year${years > 1 ? 's' : ''}`;
  return `${years} year${years > 1 ? 's' : ''}, ${months} month${months > 1 ? 's' : ''}`;
}

export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString(undefined, {
    year: 'numeric', month: 'long', day: 'numeric',
  });
}
