import { Skeleton, SkeletonGroup } from '@/components/ui/Skeleton'

export default function ExamLoading() {
  return (
    <SkeletonGroup className="max-w-3xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <Skeleton h="h-4" w="w-32" />
        <Skeleton h="h-8" w="w-20" className="rounded-full" />
      </div>
      <Skeleton h="h-1.5" className="w-full rounded-full mb-8" />
      <Skeleton h="h-6" w="w-3/4" className="mb-6" />
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} h="h-14" className="rounded-lg border border-slate-200 dark:border-slate-700" />
        ))}
      </div>
    </SkeletonGroup>
  )
}
