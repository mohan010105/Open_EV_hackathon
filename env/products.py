"""
Simulated product catalog for the web navigation environment.
"""

from dataclasses import dataclass
from typing import List, Optional, Dict


@dataclass
class Product:
    id: str
    name: str
    price: float
    category: str
    description: str
    rating: float

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "price": self.price,
            "category": self.category,
            "description": self.description,
            "rating": self.rating,
        }


PRODUCTS: List[Product] = [
    Product("prod_laptop_001", "ProBook Laptop 15", 899.99, "laptops",
            "High-performance 15-inch laptop with 16GB RAM and 512GB SSD", 4.5),
    Product("prod_laptop_002", "UltraSlim Laptop 13", 1199.99, "laptops",
            "Ultra-thin 13-inch laptop, perfect for travel and productivity", 4.2),
    Product("prod_laptop_003", "Budget Laptop 14", 449.99, "laptops",
            "Affordable 14-inch laptop for everyday computing tasks", 3.8),
    Product("prod_headphones_001", "SoundWave Wireless", 49.99, "headphones",
            "Basic wireless headphones with 20-hour battery life", 3.5),
    Product("prod_headphones_002", "BassBoost Pro Wireless", 129.99, "headphones",
            "Premium wireless headphones with deep bass and noise cancellation", 4.0),
    Product("prod_headphones_003", "StudioMax Wireless Elite", 249.99, "headphones",
            "Studio-quality wireless headphones with 40mm drivers and 30-hour battery", 4.8),
    Product("prod_keyboard_001", "QuietType Mechanical", 79.99, "keyboards",
            "Mechanical keyboard with quiet blue switches for office use", 4.1),
    Product("prod_keyboard_002", "TactileRGB Mechanical Pro", 149.99, "keyboards",
            "Full-size mechanical keyboard with tactile switches and per-key RGB lighting", 4.6),
    Product("prod_keyboard_003", "Compact65 Mechanical", 99.99, "keyboards",
            "65% compact mechanical keyboard with hot-swap switches", 4.3),
]

PRODUCTS_BY_ID: Dict[str, Product] = {p.id: p for p in PRODUCTS}


def search_products(query: str) -> List[Product]:
    """Search products by query string with simple scoring."""
    q = query.lower().strip()
    scored = []
    for p in PRODUCTS:
        score = 0
        if q in p.name.lower():
            score += 3
        if q in p.category.lower():
            score += 2
        if q in p.description.lower():
            score += 1
        # Keyword synonyms
        if any(w in q for w in ["laptop", "notebook"]) and p.category == "laptops":
            score += 2
        if any(w in q for w in ["headphone", "headphones", "wireless"]) and p.category == "headphones":
            score += 2
        if any(w in q for w in ["keyboard", "mechanical"]) and p.category == "keyboards":
            score += 2
        if score > 0:
            scored.append((score, p))

    scored.sort(key=lambda x: x[0], reverse=True)
    return [p for _, p in scored]


def get_product_by_id(product_id: str) -> Optional[Product]:
    return PRODUCTS_BY_ID.get(product_id)
