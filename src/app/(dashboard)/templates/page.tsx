export default function TemplatesPage() {
    return (
        <div className="flex flex-col items-center justify-center min-h-[80vh] w-full animate-fade-in">
            <div className="w-16 h-16 rounded-2xl bg-foreground/[0.02] border border-border flex items-center justify-center mb-6 shadow-soft">
                <div className="w-8 h-8 rounded-full border-[1.5px] border-foreground-muted/30 border-t-foreground-muted animate-spin" />
            </div>
            <h1 className="font-serif text-3xl text-foreground mb-2 tracking-wide">Templates Library</h1>
            <p className="text-[13px] font-medium uppercase tracking-[0.2em] text-foreground-muted">Loading Soon</p>
        </div>
    )
}
