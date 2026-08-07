/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-food-to-other-subapps',
      comment: 'Food must not import other sub-apps or Home. Only Home aggregates across sub-apps.',
      severity: 'error',
      from: { path: '^src/features/food/' },
      to: { path: '^src/features/(ecommerce|pharma|home)/' },
    },
    {
      name: 'no-ecommerce-to-other-subapps',
      comment: 'Ecommerce must not import other sub-apps or Home. Only Home aggregates across sub-apps.',
      severity: 'error',
      from: { path: '^src/features/ecommerce/' },
      to: { path: '^src/features/(food|pharma|home)/' },
    },
    {
      name: 'no-pharma-to-other-subapps',
      comment: 'Pharma must not import other sub-apps or Home. Only Home aggregates across sub-apps.',
      severity: 'error',
      from: { path: '^src/features/pharma/' },
      to: { path: '^src/features/(food|ecommerce|home)/' },
    },
    {
      name: 'no-food-cards-outside-food-or-home',
      comment: 'Food product cards belong to the Food sub-app and Home only — never another sub-app.',
      severity: 'error',
      from: { pathNot: '^src/features/(food|home)/' },
      to: { path: '^src/features/food/cards/' },
    },
    {
      name: 'no-ecommerce-cards-outside-ecommerce-or-home',
      comment: 'Mart/Grocery cards belong to ecommerce and Home only — never another sub-app.',
      severity: 'error',
      from: { pathNot: '^src/features/(ecommerce|home)/' },
      to: { path: '^src/features/ecommerce/cards/' },
    },
    {
      name: 'no-pharma-cards-outside-pharma-or-home',
      comment: 'Pharma product cards belong to the Pharma sub-app and Home only — never another sub-app.',
      severity: 'error',
      from: { pathNot: '^src/features/(pharma|home)/' },
      to: { path: '^src/features/pharma/cards/' },
    },
    {
      name: 'no-shared-primitives-depend-on-features',
      comment: 'components/shared are low-level primitives; they must not depend on feature modules.',
      severity: 'error',
      from: { path: '^src/components/shared/' },
      to: { path: '^src/features/' },
    },
  ],
  options: {
    doNotFollow: {
      path: 'node_modules',
    },
    includeOnly: '^src/',
    tsConfig: {
      fileName: 'tsconfig.json',
    },
    tsPreCompilationDeps: true,
    exclude: {
      path: '\\.swp$',
    },
  },
};
