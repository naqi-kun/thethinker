import { cn } from '../utils/cn';

type BrandLogoProps = {
  className?: string;
};

export default function BrandLogo({ className }: BrandLogoProps) {
  return (
    <img
      src="/the-thinker-logo.svg"
      alt="The Thinker"
      className={cn('block h-auto w-full', className)}
      draggable={false}
    />
  );
}
