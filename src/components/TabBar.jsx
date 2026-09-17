export default function TabBar({ tabs, activeId, onSelect, onClose, onNew }) {
  return (
    <div className="tab-bar" role="tablist">
      {tabs.map((tab) => (
        <div
          key={tab.id}
          className={`tab${tab.id === activeId ? " active" : ""}`}
          role="tab"
          aria-selected={tab.id === activeId}
          onClick={() => onSelect(tab.id)}
          onMouseDown={(e) => {
            if (e.button === 1) {
              e.preventDefault();
              onClose(tab.id);
            }
          }}
        >
          <span className="tab-title">
            {tab.dirty ? "*" : ""}
            {tab.title}
          </span>
          <button
            type="button"
            className="tab-close"
            title="Close tab"
            onClick={(e) => {
              e.stopPropagation();
              onClose(tab.id);
            }}
          >
            ×
          </button>
        </div>
      ))}
      <button type="button" className="tab-new" title="New tab" onClick={onNew}>
        +
      </button>
    </div>
  );
}
