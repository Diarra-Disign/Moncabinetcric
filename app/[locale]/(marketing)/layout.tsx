export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-blue-50">
      {/* Subtle cloud-like radial background for the whole marketing section */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-1/2 -right-1/4 w-[1000px] h-[1000px] rounded-full bg-blue-100/50 blur-[120px] mix-blend-multiply" />
        <div className="absolute -bottom-1/2 -left-1/4 w-[800px] h-[800px] rounded-full bg-purple-100/40 blur-[100px] mix-blend-multiply" />
      </div>
      <main className="relative z-10 w-full h-full">
        {children}
      </main>
    </div>
  )
}
