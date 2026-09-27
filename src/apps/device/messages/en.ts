import type { DeviceMessages } from './nl'

export default {
  title: 'Sign in on this device',
  description: 'Scan the QR code with your phone, or go to the link shown and enter the code.',
  starting: 'Creating code...',
  waiting: 'Waiting for confirmation on your phone...',
  complete: 'Signed in! Redirecting...',
  retry: 'Try again',
  loginFailed: 'Sign-in failed.',
  startFailed: 'Could not create a device code.',
} satisfies DeviceMessages
