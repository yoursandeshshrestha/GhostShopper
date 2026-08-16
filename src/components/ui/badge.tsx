import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-lg border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-all focus-visible:ring-0 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:ring-destructive/20 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default:
          "bg-foreground/6 text-foreground [a]:hover:bg-foreground/10 dark:bg-white/8 dark:text-foreground [a]:hover:dark:bg-white/12",
        secondary:
          "bg-foreground/5 text-muted-foreground [a]:hover:bg-foreground/8 dark:bg-white/6 dark:text-foreground/75 [a]:hover:dark:bg-white/10",
        destructive:
          "bg-destructive/12 text-red-600 [a]:hover:bg-destructive/18 dark:bg-destructive/20 dark:text-red-500 [a]:hover:dark:bg-destructive/28",
        success:
          "bg-emerald-600/10 text-emerald-800 [a]:hover:bg-emerald-600/15 dark:bg-emerald-400/10 dark:text-emerald-300 [a]:hover:dark:bg-emerald-400/15",
        warning:
          "bg-yellow-500/10 text-yellow-900 [a]:hover:bg-yellow-500/15 dark:bg-yellow-500/10 dark:text-yellow-300 [a]:hover:dark:bg-yellow-500/15",
        superadmin:
          "bg-violet-600/12 text-violet-800 [a]:hover:bg-violet-600/18 dark:bg-violet-400/15 dark:text-violet-300 [a]:hover:dark:bg-violet-400/22",
        owner:
          "bg-indigo-600/12 text-indigo-800 [a]:hover:bg-indigo-600/18 dark:bg-indigo-400/15 dark:text-indigo-300 [a]:hover:dark:bg-indigo-400/22",
        admin:
          "bg-sky-600/12 text-sky-800 [a]:hover:bg-sky-600/18 dark:bg-sky-400/15 dark:text-sky-300 [a]:hover:dark:bg-sky-400/22",
        coach:
          "bg-teal-600/12 text-teal-800 [a]:hover:bg-teal-600/18 dark:bg-teal-400/15 dark:text-teal-300 [a]:hover:dark:bg-teal-400/22",
        viewer:
          "bg-foreground/6 text-muted-foreground [a]:hover:bg-foreground/10 dark:bg-white/8 dark:text-foreground/70 [a]:hover:dark:bg-white/12",
        outline:
          "bg-foreground/4 text-muted-foreground [a]:hover:bg-foreground/8 [a]:hover:text-foreground dark:bg-white/5 dark:text-foreground/70 [a]:hover:dark:bg-white/8 [a]:hover:dark:text-foreground",
        ghost:
          "bg-transparent hover:bg-foreground/6 hover:text-muted-foreground dark:hover:bg-white/6 dark:hover:text-foreground/80",
        link: "bg-transparent text-primary underline-offset-4 hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
