import type { Metadata } from 'next'
import customMetadata from '@/utils/metadata'

const defaultMetadata = {
  title: 'ElevateHR',
  description: 'ElevateHR - AI-Powered Recruitment Platform',
  icons: {
    icon: '/favicon.svg',
  },
}

export const metadata: Metadata = {
  ...(customMetadata || defaultMetadata),
} 