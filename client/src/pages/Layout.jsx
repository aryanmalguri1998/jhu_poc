import React, { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Stethoscope, Microscope, Home } from "lucide-react";
import { createPageUrl } from "@/lib/utils";

export default function Layout({ children, currentPageName }) {
  const location = useLocation();

  useEffect(() => {
    document.title = "G3 AI | Johns Hopkins Medicine";
  }, []);

  const navItems = [
    { name: "Home", path: createPageUrl("Home"), icon: Home },
    { name: "Experiment", path: createPageUrl("Experiment"), icon: Microscope },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header with Navigation */}
      <header className="bg-[#002D72] border-b-4 border-[#68ACE5] sticky top-0 z-50 shadow-md">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center gap-4 py-4">
              <div className="h-12 w-12 bg-white rounded-full flex items-center justify-center shadow-lg">
                <Stethoscope className="w-7 h-7 text-[#002D72]" />
              </div>
              <div className="border-l-2 border-[#68ACE5] pl-3">
                <h1 className="text-xl font-bold text-white">
                  Johns Hopkins Medicine
                </h1>
                <p className="text-xs text-[#68ACE5]">
                  Clinical Research Platform
                </p>
              </div>
            </div>

            {/* Navigation */}
            <nav className="flex gap-2">
              {navItems.map((item) => {
                const isActive = currentPageName === item.name;
                const Icon = item.icon;

                return (
                  <Link
                    key={item.name}
                    to={item.path}
                    className={`
                      flex items-center gap-2 px-4 py-2 rounded-lg transition-all
                      ${
                        isActive
                          ? "bg-white text-[#002D72] shadow-lg"
                          : "text-white hover:bg-[#003d72]"
                      }
                    `}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="font-medium">{item.name}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      </header>

      {/* Page Content */}
      <main>{children}</main>
    </div>
  );
}
