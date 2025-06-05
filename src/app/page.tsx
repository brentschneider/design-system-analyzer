"use client";

import { URLInput } from "../components/URLInput";
import { SourceList } from "../components/SourceList";
import { ComponentViewer } from "../components/ComponentViewer";

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-100 dark:bg-gray-900">
      <div className="container mx-auto py-8 px-4">
        <div className="grid grid-cols-12 gap-8">
          {/* Left Sidebar */}
          <div className="col-span-12 md:col-span-4 space-y-8">
            <URLInput />
            <div className="h-[600px]">
              <SourceList />
            </div>
          </div>

          {/* Main Content */}
          <div className="col-span-12 md:col-span-8">
            <ComponentViewer />
          </div>
        </div>
      </div>
    </main>
  );
}
