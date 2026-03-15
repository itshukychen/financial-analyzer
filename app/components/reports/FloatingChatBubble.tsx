'use client';

import { useState } from 'react';
import ReportChatWidget from './ReportChatWidget';

interface FloatingChatBubbleProps {
  reportId: string;
  reportDate: string;
  reportPeriod: string;
}

export default function FloatingChatBubble({
  reportId,
  reportDate,
  reportPeriod,
}: FloatingChatBubbleProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Floating bubble button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        data-testid="floating-chat-bubble-button"
        className="fixed bottom-6 right-6 z-40 w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg flex items-center justify-center transition-all duration-200 transform hover:scale-110"
        aria-label={isOpen ? 'Close chat' : 'Open chat'}
      >
        {isOpen ? (
          /* Close icon (X) */
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          /* Chat icon */
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        )}
      </button>

      {/* Floating panel */}
      {isOpen && (
        <div
          data-testid="floating-chat-panel"
          className="fixed bottom-24 right-6 z-40 w-full max-w-sm max-h-[600px] bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-3 flex items-center justify-between">
            <h3 className="text-white font-semibold flex items-center gap-2">
              <span>💬</span>
              <span>Ask AI</span>
            </h3>
            <button
              onClick={() => setIsOpen(false)}
              className="text-white hover:bg-blue-800 rounded-full p-1 transition"
              aria-label="Close chat"
              data-testid="floating-chat-close-button"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Chat widget content */}
          <div className="flex-1 overflow-y-auto p-4">
            <ReportChatWidget
              reportId={reportId}
              reportDate={reportDate}
              reportPeriod={reportPeriod}
              isFloating={true}
            />
          </div>
        </div>
      )}
    </>
  );
}
