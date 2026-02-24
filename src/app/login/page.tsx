'use client'

import React, { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Building2, AlertCircle, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils/cn'

export default function LoginPage() {
    const router = useRouter()
    // Ensure we safely handle useSearchParams missing on server render or when wrapped without Suspense
    // We'll just read returnUrl dynamically if possible or in effect
    const [returnUrl, setReturnUrl] = useState('/')

    useEffect(() => {
        const searchParams = new URLSearchParams(window.location.search)
        setReturnUrl(searchParams.get('returnUrl') || '/')
    }, [])

    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const [shake, setShake] = useState(false)
    const emailInputRef = useRef<HTMLInputElement>(null)
    const supabase = createClient()

    const validateForm = () => {
        if (!email.trim()) {
            setError('Email is required')
            return false
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            setError('Enter a valid email address')
            return false
        }
        if (email.length > 254) {
            setError('Email is too long')
            return false
        }
        if (!password) {
            setError('Password is required')
            return false
        }
        if (password.length < 8) {
            setError('Password must be at least 8 characters')
            return false
        }
        if (password.length > 128) {
            setError('Password is too long')
            return false
        }
        return true
    }

    const triggerShake = () => {
        setShake(false)
        // Force reflow
        void document.documentElement.offsetWidth
        setShake(true)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!validateForm()) {
            triggerShake()
            return
        }

        setIsLoading(true)
        setError(null)

        try {
            const { error: authError } = await supabase.auth.signInWithPassword({
                email: email.trim().toLowerCase(),
                password,
            })

            if (authError) {
                setIsLoading(false)
                triggerShake()

                let msg = 'Invalid email or password.'
                if (authError.status === 400 && authError.message.includes('Email not confirmed')) {
                    msg = 'Your account has not been activated. Contact your administrator.'
                } else if (authError.status === 403) {
                    msg = 'This account has been deactivated. Contact your administrator.'
                } else if (authError.status === 429) {
                    msg = 'Too many attempts. Please wait a few minutes and try again.'
                }
                setError(msg)
                emailInputRef.current?.focus()
                return
            }

            // Successful auth -> wait a bit to give a smooth transition, but usually we just push immediately
            const safeReturnUrl = returnUrl && returnUrl.startsWith('/') && !returnUrl.startsWith('//') ? returnUrl : '/'
            router.push(safeReturnUrl)
            router.refresh()

        } catch {
            setIsLoading(false)
            triggerShake()
            setError('Unable to connect to the server. Check your internet connection and try again.')
            emailInputRef.current?.focus()
        }
    }

    return (
        <div className="min-h-screen min-h-[100dvh] grid place-items-center bg-background relative overflow-hidden text-foreground antialiased">
            {/* Dot pattern overlay */}
            <div
                className="absolute inset-0 pointer-events-none opacity-20"
                style={{
                    backgroundImage: 'radial-gradient(circle at center, #ffffff 1px, transparent 1px)',
                    backgroundSize: '24px 24px',
                }}
            />

            <div className={cn(
                "relative w-full max-w-[420px] lg:max-w-[480px] bg-surface border border-white/10 rounded-xl shadow-soft px-8 py-12 lg:px-10 z-10",
                shake && "animate-shake"
            )}>

                <div className="flex flex-col items-center mb-10">
                    <Building2 className="w-8 h-8 text-accent mb-4" />
                    <h1 className="font-serif text-[36px] font-semibold text-foreground leading-[1.2] tracking-[-0.01em] mb-2 text-center">
                        Dream Reality
                    </h1>
                    <h2 className="font-sans text-label uppercase tracking-label text-foreground-muted leading-[1.4] text-center">
                        AI ARCHITECTURE SUITE
                    </h2>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col space-y-6">

                    <div className="group space-y-2">
                        <label className="block text-label uppercase tracking-label text-foreground-muted group-focus-within:text-accent transition-colors duration-200">
                            EMAIL
                        </label>
                        <div className="relative">
                            <input
                                ref={emailInputRef}
                                type="email"
                                id="login-email"
                                name="email"
                                autoComplete="email"
                                required
                                disabled={isLoading}
                                value={email}
                                onChange={(e) => { setEmail(e.target.value); setError(null) }}
                                placeholder="admin@dreamreality.com"
                                className="h-12 w-full bg-transparent border-b border-white/20 px-0 py-2 text-sm text-foreground placeholder:text-foreground-muted/50 focus:outline-none transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                            />
                            <div className="absolute bottom-0 left-0 h-[1px] w-0 bg-accent transition-all duration-500 ease-out group-focus-within:w-full" />
                        </div>
                    </div>

                    <div className="group space-y-2 pt-2 mb-8">
                        <label className="block text-label uppercase tracking-label text-foreground-muted group-focus-within:text-accent transition-colors duration-200">
                            PASSWORD
                        </label>
                        <div className="relative">
                            <input
                                type="password"
                                id="login-password"
                                name="password"
                                autoComplete="current-password"
                                required
                                disabled={isLoading}
                                value={password}
                                onChange={(e) => { setPassword(e.target.value); setError(null) }}
                                className="h-12 w-full bg-transparent border-b border-white/20 px-0 py-2 text-sm text-foreground focus:outline-none transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                            />
                            <div className="absolute bottom-0 left-0 h-[1px] w-0 bg-accent transition-all duration-500 ease-out group-focus-within:w-full" />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full h-12 bg-foreground text-foreground-inverse hover:bg-white/90 disabled:bg-foreground disabled:opacity-90 disabled:cursor-not-allowed rounded-none font-medium text-sm tracking-wide transition-all duration-200 flex items-center justify-center mt-2 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-surface active:scale-[0.98]"
                    >
                        {isLoading ? (
                            <Loader2 className="w-4 h-4 animate-spin text-foreground-inverse" />
                        ) : (
                            'Sign In'
                        )}
                    </button>

                    {error && (
                        <div className="mt-4 flex items-start gap-3 rounded-md border border-red-500/20 bg-red-500/10 p-3 px-4 text-[13px] text-red-500 animate-fade-in duration-300">
                            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}
                </form>

            </div>
        </div>
    )
}
