import { MotionGeneratorForm } from "@/components/motion-generator-form"

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-blue-950 dark:to-indigo-950">
      <div className="container mx-auto px-4 py-12 md:py-20">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Header Section */}
          <div className="text-center space-y-4">
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent">
              Daily report generator
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
              Daily report for company A and B
            </p>
          </div>

          {/* Main Form */}
          <MotionGeneratorForm />

          {/* Footer */}
          <div className="text-center pt-8 text-sm text-muted-foreground">
            <p>Powered by Perplexity AI • Real-time web search for current events</p>
          </div>
        </div>
      </div>
    </main>
  )
}

