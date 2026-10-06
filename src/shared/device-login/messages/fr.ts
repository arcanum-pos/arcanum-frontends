import type { DeviceMessages } from './nl'

export default {
  title: 'Se connecter sur cet appareil',
  description: 'Scannez le code QR avec votre téléphone, ou allez sur le lien affiché et saisissez le code.',
  starting: 'Création du code...',
  waiting: 'En attente de confirmation sur votre téléphone...',
  complete: 'Connecté ! Redirection...',
  retry: 'Réessayer',
  loginFailed: 'La connexion a échoué.',
  startFailed: 'Impossible de créer le code de l’appareil.',
} satisfies DeviceMessages
