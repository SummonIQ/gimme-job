# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e5]:
    - generic [ref=e6]:
      - generic [ref=e8]: "404"
      - generic [ref=e9]: Page not found
      - generic [ref=e10]: The page you are looking for doesn't exist or has been moved.
    - generic [ref=e12]:
      - paragraph [ref=e14]: "Here are some helpful links to get you back on track:"
      - generic [ref=e15]:
        - link "Go to Dashboard" [ref=e16] [cursor=pointer]:
          - /url: /dashboard
          - img
          - text: Go to Dashboard
        - link "Go Back" [ref=e17] [cursor=pointer]:
          - /url: "javascript:throw new Error('React has blocked a javascript: URL as a security precaution.')"
          - img
          - text: Go Back
    - generic [ref=e19]:
      - link "Settings" [ref=e20] [cursor=pointer]:
        - /url: /settings
        - img
        - text: Settings
      - link "Search" [ref=e21] [cursor=pointer]:
        - /url: /tools
        - img
        - text: Search
  - generic [ref=e22]:
    - generic:
      - button "Tools":
        - generic: Tools
    - generic:
      - generic: xl
    - img [ref=e24]
  - button "Open Next.js Dev Tools" [ref=e32] [cursor=pointer]:
    - img [ref=e33]
  - alert [ref=e36]
```