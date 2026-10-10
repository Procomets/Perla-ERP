import React from 'react';
import { Header } from './Header';

interface PageContainerProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

export const PageContainer: React.FC<PageContainerProps> = ({ title, subtitle, children }) => {
  return (
    <div className="flex flex-col h-screen bg-[#F8F9FA] w-full overflow-hidden">
      <Header title={title} subtitle={subtitle} />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto p-6 md:p-8">
          {children}
        </div>
      </main>
    </div>
  );
};
