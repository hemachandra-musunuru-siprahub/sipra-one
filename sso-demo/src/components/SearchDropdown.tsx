import React from 'react';
import type { SearchResults, SearchResult } from '../hooks/useGlobalSearch';
import { Users, Megaphone, FileText, ExternalLink, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface SearchDropdownProps {
  results: SearchResults;
  isLoading: boolean;
  isVisible: boolean;
  onClose: () => void;
}

export const SearchDropdown: React.FC<SearchDropdownProps> = ({ 
  results, 
  isLoading, 
  isVisible, 
  onClose 
}) => {
  const navigate = useNavigate();

  if (!isVisible) return null;

  const hasResults = 
    results.employees.length > 0 || 
    results.announcements.length > 0 || 
    results.hr_documents.length > 0;

  const handleItemClick = (item: SearchResult) => {
    if (item.url) {
      if (item.url.startsWith('http')) {
        window.open(item.url, '_blank');
      } else {
        navigate(item.url);
      }
    }
    onClose();
  };

  return (
    <div className="absolute top-full left-0 w-full mt-2 bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden z-[100] animate-in fade-in slide-in-from-top-2 duration-200">
      <div className="max-h-[480px] overflow-y-auto custom-scrollbar">
        {isLoading && !hasResults && (
          <div className="p-8 text-center">
            <div className="inline-block w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mb-2"></div>
            <p className="text-sm text-gray-500 font-medium">Searching SipraHub...</p>
          </div>
        )}

        {!isLoading && !hasResults && (
          <div className="p-8 text-center">
            <div className="bg-gray-50 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
              <SearchIcon className="text-gray-400 w-6 h-6" />
            </div>
            <p className="text-sm text-gray-600 font-medium">No results found</p>
            <p className="text-xs text-gray-400 mt-1">Try searching for employees, notices, or documents</p>
          </div>
        )}

        {results.employees.length > 0 && (
          <div className="p-2">
            <div className="px-3 py-2 flex items-center gap-2 text-[11px] font-bold text-gray-400 uppercase tracking-wider">
              <Users size={14} className="text-blue-500" />
              Employees
            </div>
            {results.employees.map((item) => (
              <SearchItem key={item.id} item={item} icon={<User size={16} />} onClick={() => handleItemClick(item)} />
            ))}
          </div>
        )}

        {results.announcements.length > 0 && (
          <div className="p-2 border-t border-gray-50">
            <div className="px-3 py-2 flex items-center gap-2 text-[11px] font-bold text-gray-400 uppercase tracking-wider">
              <Megaphone size={14} className="text-orange-500" />
              Announcements
            </div>
            {results.announcements.map((item) => (
              <SearchItem key={item.id} item={item} icon={<Megaphone size={16} />} onClick={() => handleItemClick(item)} />
            ))}
          </div>
        )}

        {results.hr_documents.length > 0 && (
          <div className="p-2 border-t border-gray-50">
            <div className="px-3 py-2 flex items-center gap-2 text-[11px] font-bold text-gray-400 uppercase tracking-wider">
              <FileText size={14} className="text-purple-500" />
              HR Documents
            </div>
            {results.hr_documents.map((item) => (
              <SearchItem 
                key={item.id} 
                item={item} 
                icon={<FileText size={16} />} 
                onClick={() => handleItemClick(item)} 
                rightIcon={<ExternalLink size={14} className="text-gray-300" />}
              />
            ))}
          </div>
        )}
      </div>
      
      <div className="bg-gray-50 px-4 py-2 border-t border-gray-100 flex justify-between items-center">
        <span className="text-[10px] text-gray-400">Press Esc to close</span>
        <span className="text-[10px] font-medium text-primary-500">Global Search v1.0</span>
      </div>
    </div>
  );
};

const SearchItem = ({ 
  item, 
  icon, 
  onClick, 
  rightIcon 
}: { 
  item: SearchResult; 
  icon: React.ReactNode; 
  onClick: () => void;
  rightIcon?: React.ReactNode;
}) => (
  <button
    onClick={onClick}
    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 rounded-lg transition-all group text-left"
  >
    <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center text-gray-500 group-hover:bg-white group-hover:shadow-sm transition-all border border-transparent group-hover:border-gray-100">
      {icon}
    </div>
    <div className="flex-1 min-w-0">
      <div className="text-[13px] font-semibold text-gray-800 truncate group-hover:text-primary-600 transition-colors">
        {item.title}
      </div>
      <div className="text-[11px] text-gray-500 truncate mt-0.5">
        {item.subtitle}
      </div>
    </div>
    {rightIcon}
  </button>
);

const SearchIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);
