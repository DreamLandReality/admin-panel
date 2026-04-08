'use client'

interface WizardShellProps {
  currentStep: 1 | 2 | 3 | 4
  children: React.ReactNode
}

export function WizardShell({ children }: WizardShellProps) {
  return (
    <div className="flex-1 flex flex-col">
      {children}
    </div>
  )
}
