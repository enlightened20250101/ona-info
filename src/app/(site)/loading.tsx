export default function Loading() {
  return (
    <div className="min-h-screen px-6 pb-16 pt-12 sm:px-10">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <div className="flex items-center gap-2 text-xs text-muted">
          <div className="h-3 w-12 rounded-full skeleton" />
          <div className="h-3 w-8 rounded-full skeleton" />
          <div className="h-3 w-16 rounded-full skeleton" />
        </div>
        <div className="rounded-3xl border border-border bg-card p-6">
          <div className="h-3 w-20 rounded-full skeleton" />
          <div className="mt-3 h-8 w-56 rounded-full skeleton" />
          <div className="mt-3 space-y-2">
            <div className="h-3 w-2/3 rounded-full skeleton" />
            <div className="h-3 w-1/2 rounded-full skeleton" />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-40 rounded-2xl skeleton" />
          ))}
        </div>
      </div>
    </div>
  );
}
