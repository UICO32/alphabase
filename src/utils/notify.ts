type ToastOptions = {
  duration?: number
}

export function notifyError(message: string, options?: ToastOptions): void {
  void import('sonner')
    .then(({ toast }) => toast.error(message, options))
    .catch((error) => console.error('[toast] failed to load notification UI', error))
}
