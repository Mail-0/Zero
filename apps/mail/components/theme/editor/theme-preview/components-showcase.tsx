import { ThemeEditorPreviewProps } from "@/types/theme";
import { Settings, Info, AlertTriangle, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";

interface ComponentsShowcaseProps {
  styles: ThemeEditorPreviewProps["styles"];
  currentMode: ThemeEditorPreviewProps["currentMode"];
}

const ComponentsShowcase = ({ styles, currentMode }: ComponentsShowcaseProps) => {
  if (!styles || !styles[currentMode]) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Button showcase */}
      <section className="space-y-3">
        <h3 className="text-sm font-medium border-b pb-2">
          Buttons & Interactive Elements
        </h3>
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <Button variant="default">Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="link">Link</Button>
            <Button variant="destructive">Delete</Button>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Switch id="notifications" />
              <label htmlFor="notifications">Notifications</label>
            </div>
            <div className="flex items-center space-x-2">
              <Switch id="darkmode" />
              <label htmlFor="darkmode">Dark Mode</label>
            </div>
          </div>
        </div>
      </section>

      {/* Cards & Containers */}
      <section className="space-y-3">
        <h3 className="text-sm font-medium border-b pb-2">Cards & Containers</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Feature Card</CardTitle>
              <CardDescription>
                Card description with muted foreground color
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm">
                This card demonstrates the card background and foreground colors,
                with content showing regular text.
              </p>
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button variant="ghost">Cancel</Button>
              <Button>Continue</Button>
            </CardFooter>
          </Card>

          <div className="space-y-3">
            <div
              className="rounded-lg p-4"
              style={{
                backgroundColor: styles[currentMode].popover,
                color: styles[currentMode]["popover-foreground"],
                border: `1px solid ${styles[currentMode].border}`,
              }}
            >
              <h4 className="text-sm font-medium mb-2">Popover Container</h4>
              <p className="text-xs">
                This container shows popover colors and styling.
              </p>
            </div>

            <div
              className="rounded-lg p-4"
              style={{
                backgroundColor: styles[currentMode].muted,
                color: styles[currentMode]["muted-foreground"],
              }}
            >
              <h4 className="text-sm font-medium mb-2">Muted Container</h4>
              <p className="text-xs">
                Container with muted background and foreground colors.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Status Indicators */}
      <section className="space-y-3">
        <h3 className="text-sm font-medium border-b pb-2">
          Status Indicators & Alerts
        </h3>
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge>Default Badge</Badge>
            <Badge variant="secondary">Secondary</Badge>
            <Badge variant="outline">Outline</Badge>
            <Badge variant="destructive">Error</Badge>
            <Badge className="bg-blue-500 hover:bg-blue-600">Custom</Badge>
          </div>

          <div className="space-y-3">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>Information</AlertTitle>
              <AlertDescription>
                Standard alert with default styling.
              </AlertDescription>
            </Alert>

            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>
                Destructive alert showcasing error state colors.
              </AlertDescription>
            </Alert>

            <div
              className="rounded-lg border p-4 flex items-start gap-3"
              style={{
                borderColor: styles[currentMode].border,
                backgroundColor: `${styles[currentMode].accent}20`,
              }}
            >
              <Star className="h-5 w-5 text-yellow-500 shrink-0" />
              <div>
                <h5 className="font-medium text-sm">Success Alert</h5>
                <p className="text-xs mt-1">
                  Custom alert using accent colors with an opacity modifier.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Data Display */}
      <section className="space-y-3">
        <h3 className="text-sm font-medium border-b pb-2">Data Display</h3>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Role</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell className="font-medium">Alex Johnson</TableCell>
              <TableCell>
                <Badge variant="outline" className="bg-green-500/10 text-green-600">
                  Active
                </Badge>
              </TableCell>
              <TableCell>Admin</TableCell>
              <TableCell className="text-right">
                <Button variant="ghost" size="sm">
                  <Settings className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">Sarah Chen</TableCell>
              <TableCell>
                <Badge
                  variant="outline"
                  className="bg-destructive/10 text-destructive"
                >
                  Inactive
                </Badge>
              </TableCell>
              <TableCell>User</TableCell>
              <TableCell className="text-right">
                <Button variant="ghost" size="sm">
                  <Settings className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </section>
    </div>
  );
};

export default ComponentsShowcase;
