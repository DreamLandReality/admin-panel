'use client'

import { useEffect } from 'react'
import { useHeaderStore } from '@/stores/header-store'
import type { StatItemData } from '@/types'

export function SyncHeaderStats({ stats }: { stats: StatItemData[] }) {
    const setStats = useHeaderStore((s) => s.setStats)
    const clearStats = useHeaderStore((s) => s.clearStats)

    useEffect(() => {
        setStats(stats)
        return () => clearStats()
    }, [stats, setStats, clearStats])

    return null
}
