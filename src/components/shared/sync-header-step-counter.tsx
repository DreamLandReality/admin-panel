'use client'

import { useEffect } from 'react'

import { useHeaderStore } from '@/stores/header-store'

interface SyncHeaderStepCounterProps {
  currentStep: number
  totalSteps: number
  label: string
}

export function SyncHeaderStepCounter({ currentStep, totalSteps, label }: SyncHeaderStepCounterProps) {
  const setHeaderStepCounter = useHeaderStore((s) => s.setHeaderStepCounter)
  const clearHeaderRight = useHeaderStore((s) => s.clearHeaderRight)

  useEffect(() => {
    setHeaderStepCounter({ currentStep, totalSteps, label })
    return () => clearHeaderRight()
  }, [currentStep, totalSteps, label, setHeaderStepCounter, clearHeaderRight])

  return null
}
