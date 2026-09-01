import { useEffect, useState } from 'react';

/**
 * A browser-fullscreen-style title bar for the frameless dashboard window: it
 * stays hidden and slides down only when the cursor is pushed to the very top
 * edge (a thin hover "region" reveals it; it stays while hovered). The bar is a
 * drag handle (double-click maximizes) and hosts the minimize / maximize /
 * close controls.
 */
export function TitleBar() {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    void window.kofe.isWindowMaximized().then(setMaximized);
  }, []);

  const toggleMax = () => {
    void window.kofe.toggleMaximizeWindow().then(setMaximized);
  };

  return (
    <>
      <div className="titlebar-region" aria-hidden />
      <div className="titlebar" onDoubleClick={toggleMax}>
        <span className="titlebar-title">Deepbrew</span>
        <div className="titlebar-controls">
          <button
            className="tb-btn"
            title="Minimize"
            aria-label="Minimize"
            onClick={() => void window.kofe.minimizeWindow()}
          >
            <svg width="11" height="11" viewBox="0 0 11 11" aria-hidden>
              <rect x="1" y="5" width="9" height="1.4" fill="currentColor" />
            </svg>
          </button>
          <button className="tb-btn" title="Maximize" aria-label="Maximize" onClick={toggleMax}>
            {maximized ? (
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden>
                <rect x="1.2" y="2.6" width="6.2" height="6.2" />
                <path d="M3.4 2.6V1.2h6.2v6.2H8.2" />
              </svg>
            ) : (
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden>
                <rect x="1.2" y="1.2" width="8.6" height="8.6" />
              </svg>
            )}
          </button>
          <button
            className="tb-btn close"
            title="Close"
            aria-label="Close"
            onClick={() => void window.kofe.closeWindow()}
          >
            <svg width="11" height="11" viewBox="0 0 11 11" stroke="currentColor" strokeWidth="1.4" aria-hidden>
              <path d="M1.5 1.5l8 8M9.5 1.5l-8 8" />
            </svg>
          </button>
        </div>
      </div>
    </>
  );
}
