export default function TestNavPage() {
  return (
    <div className="space-y-8 pt-8">
      <div className="space-y-4">
        <h1 className="text-3xl font-bold">Navigation Test Page</h1>
        <p className="text-muted-foreground">
          This page tests if the navigation header is visible. You should see a glass effect header with navigation at the top of the page.
        </p>
      </div>
      
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Header Details:</h2>
        <ul className="list-disc list-inside space-y-2 text-sm">
          <li>Height: 80px fixed</li>
          <li>Position: Sticky top</li>
          <li>Glass effect: Intense mode with subtle glow</li>
          <li>Background: Semi-transparent with backdrop blur</li>
          <li>Edge glow: Bottom edge with primary color accent</li>
        </ul>
      </div>

      <div className="mt-8 p-4 border rounded-lg bg-muted/50">
        <p className="text-sm">
          If you don't see the header above, there may be a rendering issue. The header should be sticky and remain visible as you scroll.
        </p>
      </div>

      {/* Add some content to enable scrolling */}
      {Array.from({ length: 20 }, (_, i) => (
        <div key={i} className="p-4 border rounded-lg">
          <p>Scroll content item {i + 1}</p>
        </div>
      ))}
    </div>
  );
}