module.exports = {
  ci: {
    collect: {
      startServerCommand: 'npm run start',
      startServerReadyPattern: 'started server',
      startServerReadyTimeout: 120000,

      numberOfRuns: 3,

      url: [
        'http://localhost:3000/',
      ],
    },

    assert: {
      preset: 'lighthouse:recommended',

      assertions: {
        // Core Web Vitals
        'largest-contentful-paint': [
          'error',
          {
            maxNumericValue: 2500,
          },
        ],

        'cumulative-layout-shift': [
          'error',
          {
            maxNumericValue: 0.1,
          },
        ],

        // FID is no longer measured by modern Lighthouse.
        // INP is its modern replacement.
        'interaction-to-next-paint': [
          'error',
          {
            maxNumericValue: 200,
          },
        ],

        // Performance score
        'categories:performance': [
          'error',
          {
            minScore: 0.8,
          },
        ],
      },
    },

    upload: {
      target: 'filesystem',
      outputDir: './lhci-reports',
    },
  },
};