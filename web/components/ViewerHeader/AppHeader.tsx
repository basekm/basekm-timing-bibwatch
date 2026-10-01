'use client';

import {
  ReactNode
} from 'react';

import Image from 'next/image';

type AppHeaderProps = {
  children: ReactNode;
  actions: ReactNode;
};

export const AppHeader = ({
  children,
  actions,
}: AppHeaderProps) => {
  return (
    <header className="sticky top-0 z-10 flex h-14 w-full items-center justify-between gap-3 border-b border-border/50 bg-background/85 px-3 backdrop-blur-md sm:px-4">
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <div className="flex shrink-0 items-center gap-2">
          <Image
            src="/logo.svg"
            alt=""
            width={22}
            height={22}
          />
          <span className="text-sm font-extrabold tracking-tight">bibwatch</span>
        </div>

        <div className="h-4 w-px shrink-0 bg-border" />

        {children}
      </div>

      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        {actions}
      </div>
    </header>
  );
};
