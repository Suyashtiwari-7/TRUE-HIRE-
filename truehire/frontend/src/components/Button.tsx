import React from 'react'

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary'
}

export default function Button({ variant = 'primary', className = '', children, ...props }: ButtonProps){
  const base = 'inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2'
  const styles = variant === 'primary'
    ? 'bg-slate-900 text-white hover:bg-slate-700 focus:ring-slate-400'
    : 'bg-white text-slate-900 ring-1 ring-slate-200 hover:bg-slate-50 focus:ring-slate-300'
  return (
    <button className={`${base} ${styles} ${className}`} {...props}>
      {children}
    </button>
  )
}
