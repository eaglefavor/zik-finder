export function Skeleton({ className }: { className: string }) {
  return (
    <div className={`animate-shimmer bg-gray-200 rounded-2xl ${className}`} />
  );
}

export function LodgeSkeleton() {
  return (
    <div className="bg-white rounded-3xl overflow-hidden shadow-sm border border-gray-100 relative mb-6">
      {/* Image area */}
      <Skeleton className="h-56 w-full rounded-none" />
      
      <div className="p-5">
        <div className="flex justify-between items-start mb-2">
          {/* Title */}
          <Skeleton className="h-6 w-3/4" />
          {/* Price */}
          <Skeleton className="h-6 w-1/4" />
        </div>
        
        {/* Description lines */}
        <Skeleton className="h-4 w-full mb-2" />
        <Skeleton className="h-4 w-2/3 mb-4" />
        
        {/* Buttons */}
        <div className="flex gap-2">
          <Skeleton className="h-12 flex-1 rounded-xl" />
          <Skeleton className="h-12 flex-1 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

export function RequestSkeleton() {
  return (
    <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100 space-y-4 mb-4">
      <div className="flex items-center gap-3">
        <Skeleton className="w-10 h-10 rounded-full" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-3 w-1/4" />
        </div>
      </div>
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-12 w-full rounded-xl mt-4" />
    </div>
  );
}
