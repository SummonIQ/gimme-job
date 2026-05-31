export default {
  name: "gimme-job",
  description: "AI-powered job search and application automation platform",
  type: "monorepo",
  apps: [
    {
      description: "",
      dev: {
        command: "bun dev",
        port: 10100
      },
      name: "gimme-job",
      path: ".",
      type: "web-app"
    },
    {
      description: "",
      name: "analytics",
      path: "packages/analytics",
      type: "library"
    }
  ]
};
