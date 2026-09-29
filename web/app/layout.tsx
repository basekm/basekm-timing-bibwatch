import type {
  Metadata
} from 'next';
import {
  Mulish
} from 'next/font/google';

import './globals.css';
import {
  ReactQueryProvider
} from '@/components/providers/ReactQueryProvider';
import {
  Toaster
} from '@/components/ui/toast';
import {
  TooltipProvider
} from '@/components/ui/tooltip';
import {
  cn
} from '@/lib/utils';

const primaryFont = Mulish({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
});

export const metadata: Metadata = {
  title: {
    default: 'bibwatch',
    template: '%s | bibwatch',
  },
  description: 'Watch race finish-line video with every bib found, check who crossed the finish line, and tag runners.',
};

const RootLayout = ({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) => {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(primaryFont.className, 'overscroll-x-none')}
    >
      <body>
        <ReactQueryProvider>
          <TooltipProvider>
            {children}
            <Toaster />
          </TooltipProvider>
        </ReactQueryProvider>
      </body>
    </html>
  );
};

export default RootLayout;
