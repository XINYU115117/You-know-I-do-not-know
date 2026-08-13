import { AiExperience } from '@/components/ai-experience'

export default function Page() {
  return (
    <div className="relative min-h-dvh">
      <div className="pointer-events-none absolute inset-0 grain-grid opacity-60" aria-hidden />
      <div className="relative">
        <AiExperience />
      </div>
    </div>
  )
}
