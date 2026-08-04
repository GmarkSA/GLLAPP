import api from './axios'

/** Activa una cuenta invitada definiendo la contraseña (token del correo). */
export const acceptInvitation = (token: string, password: string): Promise<void> =>
  api.post('/auth/accept-invitation', { token, password }).then(() => undefined)

/** Solicita el correo de recuperación de contraseña. Siempre resuelve (no revela si el email existe). */
export const forgotPassword = (email: string): Promise<void> =>
  api.post('/auth/forgot-password', { email }).then(() => undefined)

/** Restablece la contraseña con el token del correo. */
export const resetPassword = (token: string, password: string): Promise<void> =>
  api.post('/auth/reset-password', { token, password }).then(() => undefined)
