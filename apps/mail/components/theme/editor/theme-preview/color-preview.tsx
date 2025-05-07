import { ThemeEditorPreviewProps } from "@/types/theme";

interface ColorPreviewProps {
  styles: ThemeEditorPreviewProps["styles"];
  currentMode: ThemeEditorPreviewProps["currentMode"];
}

const renderColorPreview = (label: string, color: string) => (
  <div className="flex items-center gap-4">
    <div
      className="w-12 h-12 rounded-md border"
      style={{ backgroundColor: color }}
    />
    <div className="flex-1">
      <p className="text-sm font-medium">{label}</p>
      <p className="text-xs text-muted-foreground">{color}</p>
    </div>
  </div>
);

const ColorPreview = ({ styles, currentMode }: ColorPreviewProps) => {
  if (!styles || !styles[currentMode]) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 gap-8">
      {/* Primary Colors */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium border-b pb-2">Primary Theme Colors</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {renderColorPreview("Background", styles[currentMode].background)}
          {renderColorPreview("Foreground", styles[currentMode].foreground)}
          {renderColorPreview("Primary", styles[currentMode].primary)}
          {renderColorPreview(
            "Primary Foreground",
            styles[currentMode]["primary-foreground"]
          )}
        </div>
      </div>

      {/* Secondary & Accent Colors */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium border-b pb-2">
          Secondary & Accent Colors
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {renderColorPreview("Secondary", styles[currentMode].secondary)}
          {renderColorPreview(
            "Secondary Foreground",
            styles[currentMode]["secondary-foreground"]
          )}
          {renderColorPreview("Accent", styles[currentMode].accent)}
          {renderColorPreview(
            "Accent Foreground",
            styles[currentMode]["accent-foreground"]
          )}
        </div>
      </div>

      {/* UI Component Colors */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium border-b pb-2">UI Component Colors</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {renderColorPreview("Card", styles[currentMode].card)}
          {renderColorPreview(
            "Card Foreground",
            styles[currentMode]["card-foreground"]
          )}
          {renderColorPreview("Popover", styles[currentMode].popover)}
          {renderColorPreview(
            "Popover Foreground",
            styles[currentMode]["popover-foreground"]
          )}
          {renderColorPreview("Muted", styles[currentMode].muted)}
          {renderColorPreview(
            "Muted Foreground",
            styles[currentMode]["muted-foreground"]
          )}
        </div>
      </div>

      {/* Utility & Form Colors */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium border-b pb-2">Utility & Form Colors</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {renderColorPreview("Border", styles[currentMode].border)}
          {renderColorPreview("Input", styles[currentMode].input)}
          {renderColorPreview("Ring", styles[currentMode].ring)}
          {renderColorPreview("Radius", styles[currentMode].radius)}
        </div>
      </div>

      {/* Status & Feedback Colors */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium border-b pb-2">
          Status & Feedback Colors
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {renderColorPreview("Destructive", styles[currentMode].destructive)}
          {renderColorPreview(
            "Destructive Foreground",
            styles[currentMode]["destructive-foreground"]
          )}
        </div>
      </div>

      {/* Chart & Data Visualization Colors */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium border-b pb-2">
          Chart & Visualization Colors
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {renderColorPreview("Chart 1", styles[currentMode]["chart-1"])}
          {renderColorPreview("Chart 2", styles[currentMode]["chart-2"])}
          {renderColorPreview("Chart 3", styles[currentMode]["chart-3"])}
          {renderColorPreview("Chart 4", styles[currentMode]["chart-4"])}
          {renderColorPreview("Chart 5", styles[currentMode]["chart-5"])}
        </div>
      </div>

      {/* Sidebar Colors */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium border-b pb-2">
          Sidebar & Navigation Colors
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {renderColorPreview("Sidebar Background", styles[currentMode].sidebar)}
          {renderColorPreview(
            "Sidebar Foreground",
            styles[currentMode]["sidebar-foreground"]
          )}
          {renderColorPreview(
            "Sidebar Primary",
            styles[currentMode]["sidebar-primary"]
          )}
          {renderColorPreview(
            "Sidebar Primary Foreground",
            styles[currentMode]["sidebar-primary-foreground"]
          )}
          {renderColorPreview(
            "Sidebar Accent",
            styles[currentMode]["sidebar-accent"]
          )}
          {renderColorPreview(
            "Sidebar Accent Foreground",
            styles[currentMode]["sidebar-accent-foreground"]
          )}
          {renderColorPreview(
            "Sidebar Border",
            styles[currentMode]["sidebar-border"]
          )}
          {renderColorPreview("Sidebar Ring", styles[currentMode]["sidebar-ring"])}
        </div>
      </div>
    </div>
  );
};

export default ColorPreview;
