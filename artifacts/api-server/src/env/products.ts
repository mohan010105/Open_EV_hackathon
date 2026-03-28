/**
 * Simulated product catalog for the web navigation environment.
 * Products are organized by category with deterministic IDs for reproducibility.
 */

export interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
  description: string;
  rating: number;
}

export const PRODUCTS: Product[] = [
  {
    id: "prod_laptop_001",
    name: "ProBook Laptop 15",
    price: 899.99,
    category: "laptops",
    description: "High-performance 15-inch laptop with 16GB RAM and 512GB SSD",
    rating: 4.5,
  },
  {
    id: "prod_laptop_002",
    name: "UltraSlim Laptop 13",
    price: 1199.99,
    category: "laptops",
    description: "Ultra-thin 13-inch laptop, perfect for travel and productivity",
    rating: 4.2,
  },
  {
    id: "prod_laptop_003",
    name: "Budget Laptop 14",
    price: 449.99,
    category: "laptops",
    description: "Affordable 14-inch laptop for everyday computing tasks",
    rating: 3.8,
  },
  {
    id: "prod_headphones_001",
    name: "SoundWave Wireless",
    price: 49.99,
    category: "headphones",
    description: "Basic wireless headphones with 20-hour battery life",
    rating: 3.5,
  },
  {
    id: "prod_headphones_002",
    name: "BassBoost Pro Wireless",
    price: 129.99,
    category: "headphones",
    description: "Premium wireless headphones with deep bass and noise cancellation",
    rating: 4.0,
  },
  {
    id: "prod_headphones_003",
    name: "StudioMax Wireless Elite",
    price: 249.99,
    category: "headphones",
    description: "Studio-quality wireless headphones with 40mm drivers and 30-hour battery",
    rating: 4.8,
  },
  {
    id: "prod_keyboard_001",
    name: "QuietType Mechanical",
    price: 79.99,
    category: "keyboards",
    description: "Mechanical keyboard with quiet blue switches for office use",
    rating: 4.1,
  },
  {
    id: "prod_keyboard_002",
    name: "TactileRGB Mechanical Pro",
    price: 149.99,
    category: "keyboards",
    description: "Full-size mechanical keyboard with tactile switches and per-key RGB lighting",
    rating: 4.6,
  },
  {
    id: "prod_keyboard_003",
    name: "Compact65 Mechanical",
    price: 99.99,
    category: "keyboards",
    description: "65% compact mechanical keyboard with hot-swap switches",
    rating: 4.3,
  },
];

/**
 * Search products by query string (simple keyword matching).
 * Returns relevant products sorted by relevance.
 */
export function searchProducts(query: string): Product[] {
  const q = query.toLowerCase().trim();
  const scored = PRODUCTS.map((p) => {
    let score = 0;
    if (p.name.toLowerCase().includes(q)) score += 3;
    if (p.category.toLowerCase().includes(q)) score += 2;
    if (p.description.toLowerCase().includes(q)) score += 1;

    // Keyword synonyms
    if (q.includes("laptop") && p.category === "laptops") score += 2;
    if (
      (q.includes("headphone") || q.includes("headphones") || q.includes("wireless")) &&
      p.category === "headphones"
    )
      score += 2;
    if (
      (q.includes("keyboard") || q.includes("mechanical")) &&
      p.category === "keyboards"
    )
      score += 2;

    return { product: p, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((s) => s.product);
}

export function getProductById(id: string): Product | undefined {
  return PRODUCTS.find((p) => p.id === id);
}
