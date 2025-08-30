/**
 * Unit tests for LanguageSelector components
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { LanguageSelector, LanguageSelectorCompact } from '../LanguageSelector';
import { Language } from '../../lib/types';

// Mock languages for testing
const mockLanguages: Language[] = [
  {
    code: 'en-US',
    name: 'English (US)',
    nativeName: 'English',
    isSupported: true,
    isCommon: true
  },
  {
    code: 'es-US',
    name: 'Spanish (US)',
    nativeName: 'Español',
    isSupported: true,
    isCommon: true
  },
  {
    code: 'fr-FR',
    name: 'French',
    nativeName: 'Français',
    isSupported: true,
    isCommon: false
  },
  {
    code: 'de-DE',
    name: 'German',
    nativeName: 'Deutsch',
    isSupported: true,
    isCommon: false
  }
];

describe('LanguageSelector', () => {
  const defaultProps = {
    inputLanguage: 'en-US',
    outputLanguage: 'es-US',
    onLanguageChange: jest.fn(),
    supportedLanguages: mockLanguages
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders language selection interface correctly', () => {
    render(<LanguageSelector {...defaultProps} />);
    
    expect(screen.getByText('Language Selection')).toBeInTheDocument();
    expect(screen.getByText('Input Language')).toBeInTheDocument();
    expect(screen.getByText('Output Language')).toBeInTheDocument();
  });

  it('displays selected languages correctly', () => {
    render(<LanguageSelector {...defaultProps} />);
    
    expect(screen.getByText('English (US)')).toBeInTheDocument();
    expect(screen.getByText('Spanish (US)')).toBeInTheDocument();
  });

  it('opens dropdown when language button is clicked', async () => {
    render(<LanguageSelector {...defaultProps} />);
    
    const inputButton = screen.getByText('English (US)');
    fireEvent.click(inputButton);
    
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search languages...')).toBeInTheDocument();
      expect(screen.getByText('Français')).toBeInTheDocument();
    });
  });

  it('filters languages based on search input', async () => {
    render(<LanguageSelector {...defaultProps} />);
    
    const inputButton = screen.getByText('English (US)');
    fireEvent.click(inputButton);
    
    await waitFor(() => {
      const searchInput = screen.getByPlaceholderText('Search languages...');
      fireEvent.change(searchInput, { target: { value: 'French' } });
      
      expect(screen.getByText('French')).toBeInTheDocument();
      expect(screen.queryByText('German')).not.toBeInTheDocument();
    });
  });

  it('calls onLanguageChange when language is selected', async () => {
    const mockOnChange = jest.fn();
    render(<LanguageSelector {...defaultProps} onLanguageChange={mockOnChange} />);
    
    const inputButton = screen.getByText('English (US)');
    fireEvent.click(inputButton);
    
    await waitFor(() => {
      const frenchOption = screen.getByText('French');
      fireEvent.click(frenchOption);
      
      expect(mockOnChange).toHaveBeenCalledWith('input', 'fr-FR');
    });
  });

  it('shows common languages section when showCommonFirst is true', async () => {
    render(<LanguageSelector {...defaultProps} showCommonFirst={true} />);
    
    const inputButton = screen.getByText('English (US)');
    fireEvent.click(inputButton);
    
    await waitFor(() => {
      expect(screen.getByText('Common Languages')).toBeInTheDocument();
      expect(screen.getByText('Other Languages')).toBeInTheDocument();
    });
  });

  it('swaps languages when swap button is clicked', () => {
    const mockOnChange = jest.fn();
    render(<LanguageSelector {...defaultProps} onLanguageChange={mockOnChange} allowSwap={true} />);
    
    const swapButton = screen.getByLabelText('Swap input and output languages');
    fireEvent.click(swapButton);
    
    expect(mockOnChange).toHaveBeenCalledWith('input', 'es-US');
    expect(mockOnChange).toHaveBeenCalledWith('output', 'en-US');
  });

  it('disables interaction when disabled prop is true', () => {
    render(<LanguageSelector {...defaultProps} disabled={true} />);
    
    const inputButton = screen.getByText('English (US)');
    expect(inputButton).toBeDisabled();
    
    const swapButton = screen.getByLabelText('Swap input and output languages');
    expect(swapButton).toBeDisabled();
  });

  it('shows validation warning for unsupported languages', () => {
    const unsupportedLanguages = mockLanguages.map(lang => ({ ...lang, isSupported: false }));
    render(<LanguageSelector {...defaultProps} supportedLanguages={unsupportedLanguages} />);
    
    expect(screen.getByText('Language Support Warning')).toBeInTheDocument();
  });

  it('closes dropdown when clicking outside', async () => {
    render(<LanguageSelector {...defaultProps} />);
    
    const inputButton = screen.getByText('English (US)');
    fireEvent.click(inputButton);
    
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search languages...')).toBeInTheDocument();
    });
    
    // Click outside
    fireEvent.mouseDown(document.body);
    
    await waitFor(() => {
      expect(screen.queryByPlaceholderText('Search languages...')).not.toBeInTheDocument();
    });
  });
});

describe('LanguageSelectorCompact', () => {
  const defaultProps = {
    inputLanguage: 'en-US',
    outputLanguage: 'es-US',
    onLanguageChange: jest.fn(),
    supportedLanguages: mockLanguages
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders compact layout with select elements', () => {
    render(<LanguageSelectorCompact {...defaultProps} />);
    
    const selects = screen.getAllByRole('combobox');
    expect(selects).toHaveLength(2);
    
    expect(selects[0]).toHaveValue('en-US');
    expect(selects[1]).toHaveValue('es-US');
  });

  it('calls onLanguageChange when select value changes', () => {
    const mockOnChange = jest.fn();
    render(<LanguageSelectorCompact {...defaultProps} onLanguageChange={mockOnChange} />);
    
    const inputSelect = screen.getAllByRole('combobox')[0];
    fireEvent.change(inputSelect, { target: { value: 'fr-FR' } });
    
    expect(mockOnChange).toHaveBeenCalledWith('input', 'fr-FR');
  });

  it('shows swap button when allowSwap is true', () => {
    render(<LanguageSelectorCompact {...defaultProps} allowSwap={true} />);
    
    const swapButton = screen.getByTitle('Swap languages');
    expect(swapButton).toBeInTheDocument();
  });

  it('hides swap button when allowSwap is false', () => {
    render(<LanguageSelectorCompact {...defaultProps} allowSwap={false} />);
    
    const swapButton = screen.queryByTitle('Swap languages');
    expect(swapButton).not.toBeInTheDocument();
  });

  it('disables all controls when disabled prop is true', () => {
    render(<LanguageSelectorCompact {...defaultProps} disabled={true} />);
    
    const selects = screen.getAllByRole('combobox');
    expect(selects[0]).toBeDisabled();
    expect(selects[1]).toBeDisabled();
    
    const swapButton = screen.getByTitle('Swap languages');
    expect(swapButton).toBeDisabled();
  });

  it('swaps languages correctly', () => {
    const mockOnChange = jest.fn();
    render(<LanguageSelectorCompact {...defaultProps} onLanguageChange={mockOnChange} allowSwap={true} />);
    
    const swapButton = screen.getByTitle('Swap languages');
    fireEvent.click(swapButton);
    
    expect(mockOnChange).toHaveBeenCalledWith('input', 'es-US');
    expect(mockOnChange).toHaveBeenCalledWith('output', 'en-US');
  });
});

describe('LanguageSelector Accessibility', () => {
  const defaultProps = {
    inputLanguage: 'en-US',
    outputLanguage: 'es-US',
    onLanguageChange: jest.fn(),
    supportedLanguages: mockLanguages
  };

  it('has proper labels for form controls', () => {
    render(<LanguageSelector {...defaultProps} />);
    
    expect(screen.getByText('Input Language')).toBeInTheDocument();
    expect(screen.getByText('Output Language')).toBeInTheDocument();
  });

  it('has proper ARIA labels for buttons', () => {
    render(<LanguageSelector {...defaultProps} allowSwap={true} />);
    
    const swapButton = screen.getByLabelText('Swap input and output languages');
    expect(swapButton).toBeInTheDocument();
    expect(swapButton).toHaveAttribute('title', 'Swap languages');
  });

  it('maintains focus management in dropdowns', async () => {
    render(<LanguageSelector {...defaultProps} />);
    
    const inputButton = screen.getByText('English (US)');
    fireEvent.click(inputButton);
    
    await waitFor(() => {
      const searchInput = screen.getByPlaceholderText('Search languages...');
      expect(searchInput).toHaveFocus();
    });
  });

  it('supports keyboard navigation', async () => {
    render(<LanguageSelector {...defaultProps} />);
    
    const inputButton = screen.getByText('English (US)');
    
    // Focus and activate with keyboard
    inputButton.focus();
    fireEvent.keyDown(inputButton, { key: 'Enter' });
    
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search languages...')).toBeInTheDocument();
    });
  });

  it('provides proper role attributes', () => {
    render(<LanguageSelectorCompact {...defaultProps} />);
    
    const selects = screen.getAllByRole('combobox');
    expect(selects).toHaveLength(2);
  });
});