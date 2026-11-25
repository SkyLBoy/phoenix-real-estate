import Image from 'next/image';

export function LogoMarca() {
  return <span className="brand-mark brand-mark-logo" aria-hidden="true">
    <Image src="/branding/logo-sergio-orantes.webp" alt="" width={48} height={48} unoptimized />
  </span>;
}
