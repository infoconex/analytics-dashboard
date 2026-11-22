import type { ComponentProps } from 'react';

type ButtonProps = ComponentProps<'button'> & {
  variant?: 'primary' | 'light' | 'quiet';
};

/** Shared action styling without obscuring the native button contract. */
export function Button({ variant = 'primary', className = '', type = 'button', ...props }: ButtonProps) {
  return <button type={type} className={`button button-${variant} ${className}`.trim()} {...props} />;
}
