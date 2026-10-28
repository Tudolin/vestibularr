/**
 * "Esqueci minha senha": o link do e-mail abre uma sessão (verifyOtp type=recovery) e marca este cookie.
 * Só com ele a página /redefinir-senha troca a senha sem pedir a atual, e só por alguns minutos.
 */
export const RECOVERY_COOKIE = "vr_recuperacao";
export const RECOVERY_MAX_AGE = 15 * 60;
export const RECOVERY_PATH = "/redefinir-senha";
