import { Glass } from '@/components/ui/glass';

export default function TestGlassPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-950 dark:to-gray-900">
      {/* Test the enhanced header glass effect */}
      <div className="space-y-8 p-8">
        <div className="space-y-4">
          <h1 className="text-3xl font-bold">Enhanced Glass Effect Showcase</h1>
          <p className="text-muted-foreground">
            The header now has a subtle but prominent glow effect with proper
            height containment. This demonstrates the final implementation with
            toned-down gradients.
          </p>
        </div>

        {/* Header Implementation Status */}
        <div className="p-4 border rounded-lg bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <h3 className="font-semibold text-green-800 dark:text-green-200">
              Header Status: Fixed
            </h3>
          </div>
          <p className="text-sm text-green-700 dark:text-green-300 mt-2">
            Fixed import issues with cn utility function. The navigation header
            should now be visible on all pages.
          </p>
        </div>

        {/* Showcase different glass intensities */}
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2">
            <h3 className="font-semibold">Subtle Glass</h3>
            <Glass
              intensity="subtle"
              blur="xl"
              edge="bottom"
              showGlow={true}
              glowIntensity="subtle"
              edgeGlow="subtle"
              className="h-48 p-6 rounded-lg bg-white/10 border border-white/20"
            >
              <div className="space-y-2">
                <p className="text-sm font-medium">Subtle Effect</p>
                <p className="text-xs opacity-80">
                  Minimal glow with 60% opacity and subtle backdrop effects.
                </p>
              </div>
            </Glass>
          </div>

          <div className="space-y-2">
            <h3 className="font-semibold">Normal Glass</h3>
            <Glass
              intensity="normal"
              blur="xl"
              edge="bottom"
              showGlow={true}
              glowIntensity="normal"
              edgeGlow="normal"
              className="h-48 p-6 rounded-lg bg-white/10 border border-white/20"
            >
              <div className="space-y-2">
                <p className="text-sm font-medium">Standard Effect</p>
                <p className="text-xs opacity-80">
                  Balanced glass effect with 80% opacity and moderate glow.
                </p>
              </div>
            </Glass>
          </div>

          <div className="space-y-2">
            <h3 className="font-semibold">Intense Glass (Header Style)</h3>
            <Glass
              intensity="intense"
              blur="2xl"
              edge="bottom"
              showGlow={true}
              glowIntensity="intense"
              edgeGlow="intense"
              className="h-48 p-6 rounded-lg bg-white/10 border border-white/20"
            >
              <div className="space-y-2">
                <p className="text-sm font-medium">Intense Effect</p>
                <p className="text-xs opacity-80">
                  Maximum glass effect with subtle pulse animation and
                  multi-layer glow. This is the same effect used in the
                  navigation header.
                </p>
              </div>
            </Glass>
          </div>
        </div>

        {/* Full width header demonstration */}
        <div className="space-y-2">
          <h3 className="font-semibold">Navigation Header Demonstration</h3>
          <div className="relative -mx-8 overflow-hidden h-[80px] border border-dashed border-primary/30">
            <Glass
              intensity="intense"
              blur="2xl"
              edge="bottom"
              showGlow={true}
              glowIntensity="intense"
              edgeGlow="intense"
              className="h-full bg-background/30 backdrop-saturate-150 border-b border-border/20"
            >
              <div className="flex items-center justify-between h-full px-8 py-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                    <span className="text-primary-foreground text-xs font-bold">
                      G
                    </span>
                  </div>
                  <div>
                    <div className="text-sm font-semibold">Gimme Job</div>
                    <div className="text-xs text-muted-foreground">Beta</div>
                  </div>
                </div>
                <div className="flex gap-6 text-sm">
                  <span className="opacity-80">Dashboard</span>
                  <span className="opacity-80">Jobs</span>
                  <span className="opacity-80">Profile</span>
                  <span className="opacity-80">Settings</span>
                </div>
              </div>
            </Glass>
          </div>
        </div>

        {/* Technical Details */}
        <div className="space-y-4 mt-12">
          <h2 className="text-2xl font-bold">Final Implementation Details</h2>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-3">
              <h3 className="text-lg font-semibold">Visual Enhancements</h3>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-1">✓</span>
                  <span>
                    <strong>Toned-down gradients:</strong> Reduced opacity from
                    40% to 15% for professional look
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-1">✓</span>
                  <span>
                    <strong>Subtle glow layers:</strong> Multiple layers with
                    reduced intensity (80px max spread)
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-1">✓</span>
                  <span>
                    <strong>Revised edge line:</strong> 2px thickness with
                    primary color accent
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-1">✓</span>
                  <span>
                    <strong>Subtle animations:</strong> Gentle pulse and shimmer
                    effects
                  </span>
                </li>
              </ul>
            </div>

            <div className="space-y-3">
              <h3 className="text-lg font-semibold">Technical Fixes</h3>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-1">✓</span>
                  <span>
                    <strong>Fixed imports:</strong> Corrected cn utility
                    function imports
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-1">✓</span>
                  <span>
                    <strong>Fixed height:</strong> 80px container prevents glow
                    overflow
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-1">✓</span>
                  <span>
                    <strong>Improved visibility:</strong> Added white tint and
                    better contrast
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-1">✓</span>
                  <span>
                    <strong>Z-index fix:</strong> Increased to 50 for proper
                    layering
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Performance Notes */}
        <div className="p-4 border rounded-lg bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
          <h3 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">
            Performance Optimizations
          </h3>
          <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
            <li>• Reduced animation complexity for better performance</li>
            <li>• Optimized CSS variables for consistent theming</li>
            <li>• Maintained accessibility with proper contrast ratios</li>
            <li>• Responsive design works on all screen sizes</li>
          </ul>
        </div>

        {/* Add some content to test scrolling */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Scroll Test Content</h3>
          {Array.from({ length: 10 }, (_, i) => (
            <div key={i} className="p-4 border rounded-lg bg-muted/30">
              <p className="text-sm">
                Scroll content item {i + 1}. The header should remain sticky and
                visible as you scroll through this content.
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
