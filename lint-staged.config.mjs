/** @type {import("lint-staged").Configuration} */
const config = {
  "*.{ts,tsx,js,mjs,cjs}": ["eslint --fix", "prettier --write"],
  "*.{json,md,css,yml,yaml}": "prettier --write",
};

export default config;
