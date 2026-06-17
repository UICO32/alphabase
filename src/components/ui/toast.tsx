import { toast } from 'sonner'
export { toast }
/** 兼容旧 API */
export function showToast(message: string, duration = 1500) {
  toast(message, { duration })
}
