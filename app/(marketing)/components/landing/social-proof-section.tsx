export function SocialProofSection() {
  return (
    <section className="border-y border-gray-200 dark:border-gray-700 bg-white dark:bg-background py-16">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <p className="text-center text-sm font-semibold text-gray-600 dark:text-gray-400 mb-10">
          Our users have been hired by leading companies worldwide
        </p>
        <div className="flex items-center justify-center gap-8 flex-wrap">
          {/* Google */}
          <div className="text-gray-700 dark:text-gray-300 font-bold text-2xl" style={{ fontFamily: 'Product Sans, sans-serif' }}>
            Google
          </div>
          
          {/* Microsoft */}
          <div className="text-gray-700 dark:text-gray-300 font-semibold text-2xl flex items-center gap-2">
            <svg className="size-6" viewBox="0 0 23 23" fill="none">
              <rect width="11" height="11" fill="#F25022"/>
              <rect x="12" width="11" height="11" fill="#7FBA00"/>
              <rect y="12" width="11" height="11" fill="#00A4EF"/>
              <rect x="12" y="12" width="11" height="11" fill="#FFB900"/>
            </svg>
            Microsoft
          </div>
          
          {/* Amazon */}
          <div className="text-gray-700 dark:text-gray-300 font-bold text-2xl relative">
            Amazon
            <div className="absolute -bottom-1 left-0 right-0 h-0.5 bg-gradient-to-r from-orange-400 to-yellow-300 rounded-full" />
          </div>
          
          {/* Apple */}
          <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300 font-medium text-2xl">
            <svg className="size-6" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
            </svg>
            Apple
          </div>
          
          {/* Meta */}
          <div className="text-gray-700 dark:text-gray-300 font-bold text-2xl relative">
            Meta
          </div>
          
          {/* Netflix */}
          <div className="text-red-600 font-bold text-2xl" style={{ fontFamily: 'Netflix Sans, sans-serif' }}>
            NETFLIX
          </div>
        </div>
      </div>
    </section>
  );
}
