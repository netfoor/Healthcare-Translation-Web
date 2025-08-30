/**
 * Unit tests for TranscriptDisplay components
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { TranscriptDisplay, TranscriptDisplayCompact } from '../TranscriptDisplay';
import { TranscriptEntry } from '../../lib/types';

// Mock transcript entries for testing
const mockEntries: TranscriptEntry[] = [
  {
    id: 'entry-1',
    sessionId: 'session-1',
    originalText: 'Hello, I need help with my medication.',
    translatedText: 'Hola, necesito ayuda con mi medicamento.',
    confidence: 0.95,
    timestamp: new Date('2024-01-01T10:00:00Z'),
    isProcessing: false
  },
  {
    id: 'entry-2',
    sessionId: 'session-1',
    originalText: 'I have been experiencing chest pain.',
    translatedText: 'He estado experimentando dolor en el pecho.',
    confidence: 0.88,
    timestamp: new Date('2024-01-01T10:01:00Z'),
    isProcessing: false
  }
];

describe('TranscriptDisplay', () => {
  const defaultProps = {
    originalText: 'Current original text',
    translatedText: 'Current translated text',
    isTranslating: false,
    onSpeakTranslation: jest.fn(),
    entries: mockEntries
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders dual-pane layout correctly', () => {
    render(<TranscriptDisplay {...defaultProps} />);
    
    expect(screen.getByText('Original')).toBeInTheDocument();
    expect(screen.getByText('Translation')).toBeInTheDocument();
    expect(screen.getByText('Transcript')).toBeInTheDocument();
  });

  it('displays historical transcript entries', () => {
    render(<TranscriptDisplay {...defaultProps} />);
    
    expect(screen.getByText('Hello, I need help with my medication.')).toBeInTheDocument();
    expect(screen.getByText('Hola, necesito ayuda con mi medicamento.')).toBeInTheDocument();
    expect(screen.getByText('I have been experiencing chest pain.')).toBeInTheDocument();
    expect(screen.getByText('He estado experimentando dolor en el pecho.')).toBeInTheDocument();
  });

  it('displays current live transcript', () => {
    render(<TranscriptDisplay {...defaultProps} />);
    
    expect(screen.getByText('Current original text')).toBeInTheDocument();
    expect(screen.getByText('Current translated text')).toBeInTheDocument();
  });

  it('shows translation loading state', () => {
    render(<TranscriptDisplay {...defaultProps} isTranslating={true} />);
    
    expect(screen.getByText('Translating...')).toBeInTheDocument();
  });

  it('calls onSpeakTranslation when speak button is clicked', () => {
    const mockOnSpeak = jest.fn();
    render(<TranscriptDisplay {...defaultProps} onSpeakTranslation={mockOnSpeak} />);
    
    const speakButtons = screen.getAllByLabelText('Play translated text as audio');
    fireEvent.click(speakButtons[0]);
    
    expect(mockOnSpeak).toHaveBeenCalledWith('Current translated text');
  });

  it('displays confidence scores correctly', () => {
    render(<TranscriptDisplay {...defaultProps} />);
    
    expect(screen.getByText('95%')).toBeInTheDocument();
    expect(screen.getByText('88%')).toBeInTheDocument();
  });

  it('highlights currently playing entry', () => {
    render(<TranscriptDisplay {...defaultProps} currentPlayingId="entry-1" highlightCurrentEntry={true} />);
    
    const highlightedEntry = screen.getByText('Hello, I need help with my medication.').closest('div');
    expect(highlightedEntry).toHaveClass('bg-blue-100');
  });

  it('shows entry count in header', () => {
    render(<TranscriptDisplay {...defaultProps} />);
    
    expect(screen.getByText('2 entries')).toBeInTheDocument();
  });

  it('handles empty entries gracefully', () => {
    render(<TranscriptDisplay {...defaultProps} entries={[]} />);
    
    expect(screen.getByText('0 entries')).toBeInTheDocument();
    expect(screen.getByText('Current original text')).toBeInTheDocument();
  });
});

describe('TranscriptDisplayCompact', () => {
  const defaultProps = {
    originalText: 'Current original text',
    translatedText: 'Current translated text',
    isTranslating: false,
    onSpeakTranslation: jest.fn(),
    entries: mockEntries
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders tab navigation correctly', () => {
    render(<TranscriptDisplayCompact {...defaultProps} />);
    
    expect(screen.getByText('Original')).toBeInTheDocument();
    expect(screen.getByText('Translation')).toBeInTheDocument();
  });

  it('switches between tabs correctly', () => {
    render(<TranscriptDisplayCompact {...defaultProps} />);
    
    // Initially shows original tab
    expect(screen.getByText('Current original text')).toBeInTheDocument();
    
    // Click translation tab
    fireEvent.click(screen.getByText('Translation'));
    
    // Should show translated content
    expect(screen.getByText('Current translated text')).toBeInTheDocument();
  });

  it('shows translation indicator when translating', () => {
    render(<TranscriptDisplayCompact {...defaultProps} isTranslating={true} />);
    
    const translationTab = screen.getByText('Translation');
    const indicator = translationTab.querySelector('.animate-pulse');
    expect(indicator).toBeInTheDocument();
  });

  it('displays historical entries when showHistory is true', () => {
    render(<TranscriptDisplayCompact {...defaultProps} showHistory={true} />);
    
    expect(screen.getByText('Hello, I need help with my medication.')).toBeInTheDocument();
  });

  it('hides historical entries when showHistory is false', () => {
    render(<TranscriptDisplayCompact {...defaultProps} showHistory={false} />);
    
    expect(screen.queryByText('Hello, I need help with my medication.')).not.toBeInTheDocument();
    expect(screen.getByText('Current original text')).toBeInTheDocument();
  });

  it('calls onSpeakTranslation for translated text', () => {
    const mockOnSpeak = jest.fn();
    render(<TranscriptDisplayCompact {...defaultProps} onSpeakTranslation={mockOnSpeak} />);
    
    // Switch to translation tab
    fireEvent.click(screen.getByText('Translation'));
    
    // Click speak button
    const speakButton = screen.getByLabelText('Play audio');
    fireEvent.click(speakButton);
    
    expect(mockOnSpeak).toHaveBeenCalledWith('Current translated text');
  });
});

describe('TranscriptDisplay Accessibility', () => {
  const defaultProps = {
    originalText: 'Test original',
    translatedText: 'Test translation',
    isTranslating: false,
    onSpeakTranslation: jest.fn(),
    entries: []
  };

  it('has proper ARIA labels for speak buttons', () => {
    render(<TranscriptDisplay {...defaultProps} />);
    
    const speakButton = screen.getByLabelText('Play translated text as audio');
    expect(speakButton).toBeInTheDocument();
    expect(speakButton).toHaveAttribute('title', 'Play audio');
  });

  it('provides proper heading structure', () => {
    render(<TranscriptDisplay {...defaultProps} />);
    
    const mainHeading = screen.getByRole('heading', { level: 2 });
    expect(mainHeading).toHaveTextContent('Transcript');
    
    const subHeadings = screen.getAllByRole('heading', { level: 3 });
    expect(subHeadings).toHaveLength(2);
    expect(subHeadings[0]).toHaveTextContent('Original');
    expect(subHeadings[1]).toHaveTextContent('Translation');
  });

  it('maintains focus management for scrolling', async () => {
    render(<TranscriptDisplay {...defaultProps} />);
    
    const scrollButton = screen.getByText('Scroll to bottom');
    fireEvent.click(scrollButton);
    
    // Button should disappear after clicking
    await waitFor(() => {
      expect(screen.queryByText('Scroll to bottom')).not.toBeInTheDocument();
    });
  });
});