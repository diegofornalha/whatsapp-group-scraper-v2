import React, { useState, useEffect } from 'react';
import { ThemeProvider } from '../themes/ThemeManager';
import { ResponsiveLayout } from '../layouts/ResponsiveLayout';
import { PerformanceCounter } from './PerformanceCounter';
import './ModernUI.css';

interface ModernUIProps {
  onStartScraping: () => void;
  onStopScraping: () => void;
  isScrapingActive: boolean;
  progress: number;
  membersCount: number;
  groupName?: string;
  error?: string;
}

export const ModernUI: React.FC<ModernUIProps> = ({
  onStartScraping,
  onStopScraping,
  isScrapingActive,
  progress,
  membersCount,
  groupName = 'WhatsApp Group',
  error
}) => {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    // Check system preference
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setIsDarkMode(prefersDark);
  }, []);

  useEffect(() => {
    if (progress === 100 && !error) {
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    }
  }, [progress, error]);

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
  };

  return (
    <ThemeProvider isDarkMode={isDarkMode}>
      <ResponsiveLayout>
        <div className="modern-ui">
          {/* Header */}
          <header className="header">
            <div className="header-content">
              <h1 className="app-title">
                <span className="icon">📱</span>
                WhatsApp Scraper
              </h1>
              <button 
                className="theme-toggle"
                onClick={toggleTheme}
                aria-label="Toggle dark mode"
              >
                {isDarkMode ? '☀️' : '🌙'}
              </button>
            </div>
          </header>

          {/* Main Content */}
          <main className="main-content">
            <div className="card">
              <h2 className="card-title">
                {groupName}
              </h2>

              {/* Status Section */}
              <div className="status-section">
                <div className={`status-indicator ${isScrapingActive ? 'active' : ''}`}>
                  <span className="status-dot"></span>
                  <span className="status-text">
                    {isScrapingActive ? 'Coletando dados...' : 'Pronto para iniciar'}
                  </span>
                </div>
              </div>

              {/* Progress Section */}
              {isScrapingActive && (
                <div className="progress-section">
                  <div className="progress-header">
                    <span>Progresso</span>
                    <span>{Math.round(progress)}%</span>
                  </div>
                  <div className="progress-bar">
                    <div 
                      className="progress-fill"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Performance Counter */}
              <PerformanceCounter
                membersCount={membersCount}
                isActive={isScrapingActive}
              />

              {/* Action Buttons */}
              <div className="action-buttons">
                {!isScrapingActive ? (
                  <button
                    className="btn btn-primary"
                    onClick={onStartScraping}
                  >
                    <span className="btn-icon">▶️</span>
                    Iniciar Coleta
                  </button>
                ) : (
                  <button
                    className="btn btn-danger"
                    onClick={onStopScraping}
                  >
                    <span className="btn-icon">⏹️</span>
                    Parar Coleta
                  </button>
                )}
              </div>

              {/* Error Display */}
              {error && (
                <div className="error-message">
                  <span className="error-icon">⚠️</span>
                  {error}
                </div>
              )}

              {/* Success Animation */}
              {showSuccess && (
                <div className="success-animation">
                  <span className="success-icon">✅</span>
                  <span>Coleta concluída com sucesso!</span>
                </div>
              )}
            </div>

            {/* Stats Cards */}
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon">👥</div>
                <div className="stat-content">
                  <div className="stat-value">{membersCount}</div>
                  <div className="stat-label">Membros Coletados</div>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon">⏱️</div>
                <div className="stat-content">
                  <div className="stat-value">{isScrapingActive ? 'Ativo' : 'Pausado'}</div>
                  <div className="stat-label">Status</div>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon">📊</div>
                <div className="stat-content">
                  <div className="stat-value">{Math.round(progress)}%</div>
                  <div className="stat-label">Progresso</div>
                </div>
              </div>
            </div>
          </main>

          {/* Footer */}
          <footer className="footer">
            <p>WhatsApp Group Scraper © 2025</p>
          </footer>
        </div>
      </ResponsiveLayout>
    </ThemeProvider>
  );
};