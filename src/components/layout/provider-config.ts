import type { AiProvider } from '@/stores/ai-provider-store'

export const PROVIDER_CONFIG: Record<AiProvider, { label: string; shortLabel: string; dotClass: string }> = {
    claude: {
        label: 'Claude',
        shortLabel: 'C',
        dotClass: 'bg-foreground dark:bg-white',
    },
    gemini: {
        label: 'Gemini',
        shortLabel: 'G',
        // DECISION: brand color for Gemini, not a semantic info state.
        dotClass: 'bg-blue-500 dark:bg-blue-400',
    },
}
