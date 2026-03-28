import React from "react";
import { Observation, Product } from "@workspace/api-client-react";
import { Search, ShoppingCart, Home as HomeIcon, ChevronRight, Star } from "lucide-react";
import { Button, Input, Card } from "./ui";

interface BrowserMockupProps {
  observation?: Observation;
  onAction: (action: string, params?: any) => void;
}

export function BrowserMockup({ observation, onAction }: BrowserMockupProps) {
  if (!observation) {
    return (
      <div className="w-full h-full flex items-center justify-center text-muted-foreground flex-col">
        <div className="w-16 h-16 border-4 border-muted border-t-primary rounded-full animate-spin mb-4" />
        <p>Awaiting environment state...</p>
      </div>
    );
  }

  const { page, search_results, current_product, cart_items } = observation;

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const q = fd.get("q") as string;
    if (q) onAction("search_product", { product_name: q });
  };

  return (
    <div className="w-full h-full flex flex-col bg-white text-slate-900 rounded-b-xl overflow-hidden shadow-inner">
      {/* Fake Browser Navbar */}
      <div className="bg-slate-100 border-b border-slate-200 px-4 py-3 flex items-center gap-4">
        <div className="flex gap-2">
          <div className="w-3 h-3 rounded-full bg-red-400" />
          <div className="w-3 h-3 rounded-full bg-amber-400" />
          <div className="w-3 h-3 rounded-full bg-green-400" />
        </div>
        
        <div className="flex gap-2">
          <button onClick={() => onAction("open_home")} className="p-1.5 hover:bg-slate-200 rounded text-slate-600">
            <HomeIcon className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSearch} className="flex-1 flex items-center bg-white border border-slate-300 rounded-lg px-3 focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 transition-all">
          <Search className="w-4 h-4 text-slate-400 mr-2" />
          <input 
            name="q"
            placeholder="Search products..." 
            className="flex-1 py-1.5 bg-transparent border-none focus:outline-none text-sm"
          />
        </form>

        <div className="relative p-2 text-slate-600">
          <ShoppingCart className="w-5 h-5" />
          {(cart_items?.length ?? 0) > 0 && (
            <span className="absolute top-0 right-0 w-4 h-4 bg-blue-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
              {cart_items?.length}
            </span>
          )}
        </div>
      </div>

      {/* Page Content Area */}
      <div className="flex-1 overflow-auto bg-slate-50 relative p-6">
        
        {/* Render logic based on page type */}
        {page === "home" && (
          <div className="flex flex-col items-center justify-center h-full max-w-2xl mx-auto text-center space-y-6">
            <div className="w-20 h-20 bg-blue-100 rounded-2xl flex items-center justify-center mb-4">
              <ShoppingBagIcon className="w-10 h-10 text-blue-600" />
            </div>
            <h1 className="text-4xl font-bold text-slate-900 tracking-tight">Welcome to FakeStore</h1>
            <p className="text-lg text-slate-500">Find exactly what you're looking for.</p>
            <div className="w-full max-w-md relative mt-8">
               <form onSubmit={handleSearch}>
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input 
                      name="q"
                      className="w-full py-4 pl-12 pr-4 rounded-full border-2 border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 transition-all outline-none text-lg shadow-sm"
                      placeholder="Try searching for something..."
                    />
                  </div>
               </form>
            </div>
          </div>
        )}

        {page === "search_results" && (
          <div className="max-w-5xl mx-auto">
            <div className="flex items-center text-sm text-slate-500 mb-6">
              <span>Home</span>
              <ChevronRight className="w-4 h-4 mx-1" />
              <span className="text-slate-900 font-medium">Search Results</span>
            </div>
            
            <h2 className="text-2xl font-bold mb-6">Results</h2>
            
            {(!search_results || search_results.length === 0) ? (
              <div className="text-center py-20 text-slate-500">
                <Search className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                <p>No products found.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {search_results.map((p) => (
                  <div 
                    key={p.id} 
                    className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-300 transition-all cursor-pointer group"
                    onClick={() => onAction("click_product", { product_id: p.id })}
                  >
                    <div className="w-full aspect-square bg-slate-100 rounded-xl mb-4 flex items-center justify-center group-hover:scale-[1.02] transition-transform">
                       {/* Unsplash placeholder image based on category if possible, or generic */}
                       <img src={`https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&h=400&fit=crop&q=80`} alt={p.name} className="w-full h-full object-cover rounded-xl opacity-80 mix-blend-multiply" />
                    </div>
                    <div className="text-xs font-medium text-blue-600 mb-1">{p.category}</div>
                    <h3 className="font-semibold text-slate-900 line-clamp-1 mb-1">{p.name}</h3>
                    <div className="flex items-center gap-1 mb-3">
                      {Array.from({length: 5}).map((_, i) => (
                        <Star key={i} className={`w-3 h-3 ${i < (p.rating || 0) ? "text-amber-400 fill-amber-400" : "text-slate-200"}`} />
                      ))}
                      <span className="text-xs text-slate-500 ml-1">({p.rating})</span>
                    </div>
                    <div className="font-bold text-lg">${p.price.toFixed(2)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {page === "product_detail" && current_product && (
          <div className="max-w-4xl mx-auto bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden flex flex-col md:flex-row">
            <div className="md:w-1/2 bg-slate-100 p-8 flex items-center justify-center">
              <img src={`https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&h=800&fit=crop&q=80`} alt={current_product.name} className="w-full max-w-sm rounded-2xl shadow-lg" />
            </div>
            <div className="md:w-1/2 p-8 flex flex-col">
              <div className="text-sm font-medium text-blue-600 mb-2 uppercase tracking-wider">{current_product.category}</div>
              <h1 className="text-3xl font-bold text-slate-900 mb-2">{current_product.name}</h1>
              
              <div className="flex items-center gap-1 mb-6">
                {Array.from({length: 5}).map((_, i) => (
                  <Star key={i} className={`w-4 h-4 ${i < (current_product.rating || 0) ? "text-amber-400 fill-amber-400" : "text-slate-200"}`} />
                ))}
                <span className="text-sm text-slate-500 ml-2">42 Reviews</span>
              </div>

              <div className="text-4xl font-bold text-slate-900 mb-6">${current_product.price.toFixed(2)}</div>
              
              <p className="text-slate-600 leading-relaxed mb-8 flex-1">
                {current_product.description || "No description available for this product. It's a great item with many features you will love."}
              </p>

              <button 
                onClick={() => onAction("add_to_cart")}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-600/30 transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <ShoppingCart className="w-5 h-5" />
                Add to Cart
              </button>
            </div>
          </div>
        )}

        {page === "cart" && (
          <div className="max-w-3xl mx-auto">
             <h2 className="text-3xl font-bold text-slate-900 mb-8">Shopping Cart</h2>
             
             {(!cart_items || cart_items.length === 0) ? (
               <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm">
                 <ShoppingCart className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                 <h3 className="text-xl font-bold text-slate-900 mb-2">Your cart is empty</h3>
                 <p className="text-slate-500 mb-6">Looks like you haven't added anything yet.</p>
                 <Button onClick={() => onAction("open_home")} variant="default" className="bg-blue-600 hover:bg-blue-700">
                   Start Shopping
                 </Button>
               </div>
             ) : (
               <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                 <ul className="divide-y divide-slate-100">
                   {cart_items.map((item, idx) => (
                     <li key={`${item.id}-${idx}`} className="p-6 flex items-center gap-6">
                       <div className="w-20 h-20 bg-slate-100 rounded-lg shrink-0">
                         <img src={`https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=200&h=200&fit=crop&q=80`} alt={item.name} className="w-full h-full object-cover rounded-lg opacity-80 mix-blend-multiply" />
                       </div>
                       <div className="flex-1">
                         <h4 className="font-semibold text-slate-900 text-lg">{item.name}</h4>
                         <p className="text-slate-500 text-sm">{item.category}</p>
                       </div>
                       <div className="font-bold text-xl text-slate-900">
                         ${item.price.toFixed(2)}
                       </div>
                     </li>
                   ))}
                 </ul>
                 <div className="bg-slate-50 p-6 border-t border-slate-200 flex justify-between items-center">
                   <span className="text-slate-500 font-medium">Subtotal</span>
                   <span className="text-3xl font-bold text-slate-900">
                     ${cart_items.reduce((sum, item) => sum + item.price, 0).toFixed(2)}
                   </span>
                 </div>
               </div>
             )}
          </div>
        )}

      </div>
    </div>
  );
}

// Just an icon wrapper for the home page
function ShoppingBagIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
      <line x1="3" x2="21" y1="6" y2="6" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
  );
}
