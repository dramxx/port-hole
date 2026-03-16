import { Wifi, WifiOff, AlertCircle, Loader2 } from 'lucide-react'
import { clsx } from 'clsx'
import { useAppStore } from '../stores/appStore'

export const StatusIndicator = () => {
  const { isConnected, status } = useAppStore()

  const getStatusConfig = () => {
    switch (status) {
      case 'connected':
        return {
          icon: Wifi,
          color: 'text-green-500',
          bgColor: 'bg-green-500',
          text: 'Connected'
        }
      case 'reconnecting':
        return {
          icon: Loader2,
          color: 'text-yellow-500',
          bgColor: 'bg-yellow-500',
          text: 'Reconnecting',
          animate: true
        }
      case 'error':
        return {
          icon: AlertCircle,
          color: 'text-red-500',
          bgColor: 'bg-red-500',
          text: 'Error'
        }
      default:
        return {
          icon: WifiOff,
          color: 'text-gray-500',
          bgColor: 'bg-gray-500',
          text: 'Disconnected'
        }
    }
  }

  const config = getStatusConfig()
  const Icon = config.icon

  return (
    <div className="flex items-center gap-2">
      <div className={clsx('relative', config.animate && 'animate-pulse')}>
        <Icon className={clsx('w-5 h-5', config.color)} />
      </div>
      <span className="text-sm text-dark-muted">{config.text}</span>
    </div>
  )
}
