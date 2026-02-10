const { defineConfig } = require('cypress');

module.exports = defineConfig({
  e2e: {
    baseUrl: 'http://localhost:8080/linen',
    supportFile: false,
    specPattern: 'cypress/e2e/**/*.cy.js',
  },
});
