interface ToastOptions {
  title: string;
  variant?: 'default' | 'destructive';
}

export function toast({ title, variant = 'default' }: ToastOptions) {
  // Simple implementation using browser alert for now
  // Can be replaced with a more sophisticated toast library later
  if (variant === 'destructive') {
    alert(`Error: ${title}`);
  } else {
    alert(title);
  }
}

export function useToast() {
  return { toast };
}
