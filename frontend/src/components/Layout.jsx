import { useState } from "react";
import { Menu, Sun, Moon } from "lucide-react";
import Sidebar from "./Sidebar";
import ChatWidget from "./ChatWidget";
import { useTheme } from "../context/ThemeContext";

export default function Layout({ children }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { dark, toggleTheme } = useTheme();

  return (
    <div className="flex min-h-screen">
      <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0">
        <header className="lg:hidden flex items-center justify-between px-4 py-3 bg-white/80 dark:bg-gray-900/80 backdrop-blur border-b border-gray-200/70 dark:border-gray-800 sticky top-0 z-20">
          <button onClick={() => setMobileOpen(true)} className="text-gray-600 dark:text-gray-300">
            <Menu size={22} />
          </button>
          <p className="font-display font-semibold">Creative Block Predictor</p>
          <button onClick={toggleTheme} className="text-gray-600 dark:text-gray-300">
            {dark ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </header>

        <button
          onClick={toggleTheme}
          className="hidden lg:flex items-center gap-2 fixed top-5 right-6 z-20 bg-white/90 dark:bg-gray-900/90 backdrop-blur border border-gray-200 dark:border-gray-800 rounded-full px-3 py-2 text-sm shadow-card text-gray-600 dark:text-gray-300 hover:shadow-card-hover transition-shadow"
        >
          {dark ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>

      <ChatWidget />
    </div>
  );
}
