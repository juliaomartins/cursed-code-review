import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentProps, ReactNode } from "react";
import { cx } from "./cx";
import { Spinner } from "./Spinner";

type Variant = "primary" | "outline" | "ember-outline" | "ghost" | "danger-ghost";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2.5 font-sans whitespace-nowrap select-none transition-[background,border-color,color,box-shadow,transform] duration-150 disabled:opacity-50 disabled:cursor-not-allowed active:translate-y-px no-underline";

const variants: Record<Variant, string> = {
  primary:
    "bg-ember text-ember-ink font-bold shadow-[0_0_28px_rgba(201,168,106,0.42)] hover:bg-[#ff9a55] hover:text-ember-ink hover:shadow-[0_0_36px_rgba(201,168,106,0.55)]",
  outline: "border border-line-strong text-ink font-medium hover:border-ink-4 hover:bg-white/[0.03] hover:text-ink",
  "ember-outline": "border border-ember text-ember-soft font-bold hover:bg-ember/10 hover:text-ember-pale",
  ghost: "text-ink-2 font-medium hover:bg-white/[0.05] hover:text-ink",
  "danger-ghost": "text-sev-high font-medium hover:bg-sev-high/10",
};

const sizes: Record<Size, string> = {
  sm: "min-h-10 px-3.5 text-sm rounded-[10px]",
  md: "min-h-11 px-4 text-sm rounded-[10px]",
  lg: "min-h-14 px-6 text-base rounded-xl",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  children: ReactNode;
}

export function Button({ variant = "outline", size = "md", loading, className, children, disabled, type = "button", ...rest }: ButtonProps) {
  return (
    <button type={type} className={cx(base, variants[variant], sizes[size], className)} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading && <Spinner size={16} />}
      {children}
    </button>
  );
}

export function ButtonLink({
  variant = "outline",
  size = "md",
  className,
  ...rest
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link className={cx(base, variants[variant], sizes[size], className)} {...rest} />;
}
