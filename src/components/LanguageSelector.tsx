/**
 * LanguageSelector - Language selection interface with dropdown menus
 * Supports input/output language selection with healthcare language priorities
 */

'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Language } from '../lib/types';
import { 
  getCommonLanguages, 
  getAllSupportedLanguages, 
  getLanguageByCode,
  isLanguageSupported 
} from '../lib/languages';

export interface LanguageSelectorProps {
  inputLanguage: string;
  outputLanguage: string;
  onLanguageChange: (type: 'input' | 'output', language: string) => void;
  supportedLanguages?: Language[];
  disabled?: boolean;
  className?: string;
  showCommonFirst?: boolean;
  allowSwap?: boolean;
}

export function LanguageSelector({
  inputLanguage,
  outputLanguage,
  onLanguageChange,
  supportedLanguages,
  disabled = false,
  className = '',
  showCommonFirst = true,
  allowSwap = true
}: LanguageSelectorProps) {
  const [inputDropdownOpen, setInputDropdownOpen] = useState(false);
  const [outputDropdownOpen, setOutputDropdownOpen] = useState(false);
  const [inputSearch, setInputSearch] = useState('');
  const [outputSearch, setOutputSearch] = useState('');
  
  const inputDropdownRef = useRef<HTMLDivElement>(null);
  const outputDropdownRef = useRef<HTMLDivElement>(null);
  const inputSearchRef = useRef<HTMLInputElement>(null);
  const outputSearchRef = useRef<HTMLInputElement>(null);

  // Use provided languages or default to all supported languages
  const languages = supportedLanguages || getAllSupportedLanguages();
  const commonLanguages = getCommonLanguages();

  /**
   * Close dropdowns when clicking outside
   */
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (inputDropdownRef.current && !inputDropdownRef.current.contains(event.target as Node)) {
        setInputDropdownOpen(false);
        setInputSearch('');
      }
      if (outputDropdownRef.current && !outputDropdownRef.current.contains(event.target as Node)) {
        setOutputDropdownOpen(false);
        setOutputSearch('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  /**
   * Focus search input when dropdown opens
   */
  useEffect(() => {
    if (inputDropdownOpen && inputSearchRef.current) {
      inputSearchRef.current.focus();
    }
  }, [inputDropdownOpen]);

  useEffect(() => {
    if (outputDropdownOpen && outputSearchRef.current) {
      outputSearchRef.current.focus();
    }
  }, [outputDropdownOpen]);

  /**
   * Filter languages based on search
   */
  const filterLanguages = useCallback((searchTerm: string) => {
    if (!searchTerm.trim()) return languages;
    
    const term = searchTerm.toLowerCase();
    return languages.filter(lang => 
      lang.name.toLowerCase().includes(term) ||
      lang.nativeName.toLowerCase().includes(term) ||
      lang.code.toLowerCase().includes(term)
    );
  }, [languages]);

  /**
   * Get organized language list (common first if enabled)
   */
  const getOrganizedLanguages = useCallback((searchTerm: string = '') => {
    const filtered = filterLanguages(searchTerm);
    
    if (!showCommonFirst || searchTerm.trim()) {
      return filtered;
    }

    const common = filtered.filter(lang => lang.isCommon);
    const others = filtered.filter(lang => !lang.isCommon);
    
    return { common, others };
  }, [filterLanguages, showCommonFirst]);

  /**
   * Handle language selection
   */
  const handleLanguageSelect = useCallback((type: 'input' | 'output', languageCode: string) => {
    if (!isLanguageSupported(languageCode)) {
      console.warn(`Language ${languageCode} is not supported`);
      return;
    }

    onLanguageChange(type, languageCode);
    
    if (type === 'input') {
      setInputDropdownOpen(false);
      setInputSearch('');
    } else {
      setOutputDropdownOpen(false);
      setOutputSearch('');
    }
  }, [onLanguageChange]);

  /**
   * Handle language swap
   */
  const handleSwapLanguages = useCallback(() => {
    if (disabled || !allowSwap) return;
    
    onLanguageChange('input', outputLanguage);
    onLanguageChange('output', inputLanguage);
  }, [disabled, allowSwap, inputLanguage, outputLanguage, onLanguageChange]);

  /**
   * Render language option
   */
  const renderLanguageOption = useCallback((
    language: Language, 
    isSelected: boolean, 
    onClick: () => void
  ) => (
    <button
      key={language.code}
      onClick={onClick}
      className={`w-full px-4 py-3 text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
        isSelected 
          ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' 
          : 'text-gray-900 dark:text-gray-100'
      }`}
      disabled={!language.isSupported}
    >
      <div className="flex items-center justify-between">
        <div>
          <div className="font-medium">{language.name}</div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {language.nativeName}
          </div>
        </div>
        {language.isCommon && (
          <span className="text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-2 py-1 rounded-full">
            Common
          </span>
        )}
      </div>
    </button>
  ), []);

  /**
   * Render dropdown content
   */
  const renderDropdownContent = useCallback((
    type: 'input' | 'output',
    searchTerm: string,
    selectedLanguage: string
  ) => {
    const organized = getOrganizedLanguages(searchTerm);
    
    if (Array.isArray(organized)) {
      // Simple filtered list
      return organized.map(language => 
        renderLanguageOption(
          language,
          language.code === selectedLanguage,
          () => handleLanguageSelect(type, language.code)
        )
      );
    }

    // Organized with common languages first
    return (
      <>
        {organized.common.length > 0 && (
          <>
            <div className="px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide border-b border-gray-200 dark:border-gray-700">
              Common Languages
            </div>
            {organized.common.map(language => 
              renderLanguageOption(
                language,
                language.code === selectedLanguage,
                () => handleLanguageSelect(type, language.code)
              )
            )}
          </>
        )}
        
        {organized.others.length > 0 && (
          <>
            <div className="px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide border-b border-gray-200 dark:border-gray-700">
              Other Languages
            </div>
            {organized.others.map(language => 
              renderLanguageOption(
                language,
                language.code === selectedLanguage,
                () => handleLanguageSelect(type, language.code)
              )
            )}
          </>
        )}
      </>
    );
  }, [getOrganizedLanguages, renderLanguageOption, handleLanguageSelect]);

  /**
   * Get display name for selected language
   */
  const getLanguageDisplayName = useCallback((code: string) => {
    const language = getLanguageByCode(code);
    return language ? language.name : code;
  }, []);

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Language Selection
        </h3>
        
        {allowSwap && (
          <button
            onClick={handleSwapLanguages}
            disabled={disabled}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Swap languages"
            aria-label="Swap input and output languages"
          >
            <SwapIcon className="w-5 h-5" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Input Language Selector */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Input Language
          </label>
          
          <div className="relative" ref={inputDropdownRef}>
            <button
              onClick={() => !disabled && setInputDropdownOpen(!inputDropdownOpen)}
              disabled={disabled}
              className="w-full px-4 py-3 text-left bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm hover:border-gray-400 dark:hover:border-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="text-gray-900 dark:text-gray-100">
                  {getLanguageDisplayName(inputLanguage)}
                </span>
                <ChevronDownIcon className={`w-5 h-5 text-gray-400 transition-transform ${
                  inputDropdownOpen ? 'rotate-180' : ''
                }`} />
              </div>
            </button>

            {inputDropdownOpen && (
              <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-64 overflow-hidden">
                {/* Search Input */}
                <div className="p-3 border-b border-gray-200 dark:border-gray-700">
                  <input
                    ref={inputSearchRef}
                    type="text"
                    placeholder="Search languages..."
                    value={inputSearch}
                    onChange={(e) => setInputSearch(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                
                {/* Language Options */}
                <div className="max-h-48 overflow-y-auto">
                  {renderDropdownContent('input', inputSearch, inputLanguage)}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Output Language Selector */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Output Language
          </label>
          
          <div className="relative" ref={outputDropdownRef}>
            <button
              onClick={() => !disabled && setOutputDropdownOpen(!outputDropdownOpen)}
              disabled={disabled}
              className="w-full px-4 py-3 text-left bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm hover:border-gray-400 dark:hover:border-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="text-gray-900 dark:text-gray-100">
                  {getLanguageDisplayName(outputLanguage)}
                </span>
                <ChevronDownIcon className={`w-5 h-5 text-gray-400 transition-transform ${
                  outputDropdownOpen ? 'rotate-180' : ''
                }`} />
              </div>
            </button>

            {outputDropdownOpen && (
              <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-64 overflow-hidden">
                {/* Search Input */}
                <div className="p-3 border-b border-gray-200 dark:border-gray-700">
                  <input
                    ref={outputSearchRef}
                    type="text"
                    placeholder="Search languages..."
                    value={outputSearch}
                    onChange={(e) => setOutputSearch(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                
                {/* Language Options */}
                <div className="max-h-48 overflow-y-auto">
                  {renderDropdownContent('output', outputSearch, outputLanguage)}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Language Validation Messages */}
      {(!isLanguageSupported(inputLanguage) || !isLanguageSupported(outputLanguage)) && (
        <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <div className="flex items-start gap-2">
            <ExclamationTriangleIcon className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-yellow-800 dark:text-yellow-200">
              <p className="font-medium">Language Support Warning</p>
              <p>
                {!isLanguageSupported(inputLanguage) && `Input language "${getLanguageDisplayName(inputLanguage)}" may not be fully supported. `}
                {!isLanguageSupported(outputLanguage) && `Output language "${getLanguageDisplayName(outputLanguage)}" may not be fully supported.`}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Compact language selector for mobile or smaller spaces
 */
export function LanguageSelectorCompact({
  inputLanguage,
  outputLanguage,
  onLanguageChange,
  supportedLanguages,
  disabled = false,
  className = '',
  allowSwap = true
}: LanguageSelectorProps) {
  const getLanguageDisplayName = useCallback((code: string) => {
    const language = getLanguageByCode(code);
    return language ? language.name.split(' ')[0] : code; // Show short name
  }, []);

  const handleSwapLanguages = useCallback(() => {
    if (disabled || !allowSwap) return;
    
    onLanguageChange('input', outputLanguage);
    onLanguageChange('output', inputLanguage);
  }, [disabled, allowSwap, inputLanguage, outputLanguage, onLanguageChange]);

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Input Language */}
      <select
        value={inputLanguage}
        onChange={(e) => onLanguageChange('input', e.target.value)}
        disabled={disabled}
        className="flex-1 px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {(supportedLanguages || getAllSupportedLanguages()).map(language => (
          <option key={language.code} value={language.code}>
            {language.name}
          </option>
        ))}
      </select>

      {/* Swap Button */}
      {allowSwap && (
        <button
          onClick={handleSwapLanguages}
          disabled={disabled}
          className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          title="Swap languages"
        >
          <SwapIcon className="w-4 h-4" />
        </button>
      )}

      {/* Output Language */}
      <select
        value={outputLanguage}
        onChange={(e) => onLanguageChange('output', e.target.value)}
        disabled={disabled}
        className="flex-1 px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {(supportedLanguages || getAllSupportedLanguages()).map(language => (
          <option key={language.code} value={language.code}>
            {language.name}
          </option>
        ))}
      </select>
    </div>
  );
}

/**
 * Icon components
 */
function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 9l-7 7-7-7"
      />
    </svg>
  );
}

function SwapIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
      />
    </svg>
  );
}

function ExclamationTriangleIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
      />
    </svg>
  );
}