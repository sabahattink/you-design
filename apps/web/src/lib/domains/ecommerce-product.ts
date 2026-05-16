import type { DomainTemplate } from './general';

export const ecommerceProductDomain: DomainTemplate = {
  id: 'ecommerce-product',
  label: 'E-commerce product',
  description: 'A single product detail page. Target: add-to-cart / buy now.',
  designerAddendum: `E-COMMERCE PRODUCT RULES:
- Above the fold: product image (or gallery placeholder), product name, price, primary "Add to cart" / "Buy now" CTA
- Visible: variant selectors (size/color) if applicable, stock status, shipping summary, return policy summary
- Trust signals: rating count, review snippet, "Free returns" / "Secure checkout" badges
- Below the fold: full description, specs, reviews section, related products
- Price must be unambiguous (currency, tax-inclusive yes/no)
- No "Welcome!", no marketing fluff in the product description — concrete specs only`,
  criticRules: `E-COMMERCE SPECIFIC CHECKS:
- Critical if: price missing or ambiguous, no primary purchase CTA above the fold, no product image (or placeholder), variant selectors are unclickable, no shipping/returns info anywhere
- Warning if: only one product image, no rating/reviews section, "Add to cart" CTA below the fold, generic CTA text ("Submit"), description is marketing fluff instead of specs
- Info if: missing related products section, missing FAQ, missing stock status indicator`,
  exampleStructure: `<header> with logo + cart + search
<main>
  <section> two-column: gallery left, product info right
    info: <h1>product name</h1>, price, rating snippet, variants, qty selector, <a>Add to cart</a>, shipping/return summary, trust badges
  <section> tabs or sections: description, specs, reviews, Q&A
  <section> related products
</main>
<footer> with policies, contact, returns`,
};
