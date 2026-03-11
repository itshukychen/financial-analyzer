import type { Metadata } from 'next';
import ChatPageClient from './ChatPageClient';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'AI Chat | FinAnalyzer',
  description:
    'Chat with Claude AI about your portfolio, options strategies, and market insights. Get real-time analysis and actionable recommendations.',
};

export default function ChatPage() {
  return <ChatPageClient />;
}
