// app/page.tsx
import { MotionGeneratorForm } from "@/components/MotionGeneratorForm"

export default function Page() {
  return (
    <main className="min-h-screen bg-background px-4 py-12 max-w-3xl mx-auto">
      <MotionGeneratorForm />
    </main>
  )
}