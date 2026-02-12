export default function Loading() {
  return (
    <div className="min-h-screen px-6 pb-16 pt-10 sm:px-10">
      <div className="mx-auto grid w-full max-w-6xl gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="relative rounded-[32px] border border-border bg-card p-6 sm:p-8">
          <div className="h-3 w-24 rounded-full skeleton" />
          <div className="mt-6 h-10 w-40 rounded-full skeleton sm:h-12" />
          <div className="mt-4 space-y-2">
            <div className="h-3 w-3/4 rounded-full skeleton" />
            <div className="h-3 w-1/2 rounded-full skeleton" />
          </div>
          <div className="mt-6 flex gap-2">
            <div className="h-9 w-24 rounded-full skeleton" />
            <div className="h-9 w-24 rounded-full skeleton" />
          </div>
          <div className="mt-6 h-12 w-full rounded-2xl skeleton" />
        </div>
        <div className="grid auto-rows-[140px] grid-cols-3 gap-3">
          {Array.from({ length: 9 }).map((_, index) => (
            <div
              key={index}
              className={`rounded-[24px] skeleton ${index === 0 ? "col-span-2 row-span-2" : "h-full"}`}
            />
          ))}
        </div>
      </div>

      <div className="mx-auto mt-10 w-full max-w-6xl rounded-[32px] border border-border bg-card p-6">
        <div className="h-4 w-32 rounded-full skeleton" />
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="h-44 rounded-3xl skeleton" />
          ))}
        </div>
      </div>
    </div>
  );
}
