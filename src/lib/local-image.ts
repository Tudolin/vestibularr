/** Figura hospedada no próprio app (public/questoes/…, recortada do PDF oficial do INEP). */
export const LOCAL_IMAGE = /^\/questoes\/[\w./-]+\.(png|jpe?g|webp|gif)$/i;

export const isLocalImage = (u: string) => LOCAL_IMAGE.test(u) && !u.includes("..");
