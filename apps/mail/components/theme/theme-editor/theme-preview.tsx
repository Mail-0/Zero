'use client';

import { ThemeSettings } from '@zero/db/schema';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Calendar } from '@/components/ui/calendar';
import { User, Bell, PlusCircle } from 'lucide-react';
import React from 'react';

interface ThemePreviewProps {
  settings: ThemeSettings;
}

export function ThemePreview({ settings }: ThemePreviewProps) {
  const [date, setDate] = React.useState<Date | undefined>(new Date());

  const previewContainerStyle = {
    backgroundColor: settings.background.type === 'color' ? settings.background.value :
                     settings.background.type === 'gradient' ? settings.background.value :
                     undefined,
    backgroundImage: settings.background.type === 'image' ? `url(${settings.background.value})` : undefined,
    backgroundSize: settings.background.type === 'image' ? 'cover' : undefined,
    fontFamily: settings.fonts.family,
  };

  return (
    <TooltipProvider>
      <div className="theme-preview p-4 rounded-md border space-y-6 overflow-auto" style={previewContainerStyle}>
        
        <section className="space-y-2">
          <h2 className="text-xl font-semibold" style={{ color: settings.colors.primary }}>Interactive Components</h2>
          <div className="grid grid-cols-2 gap-4 items-start">
            <div className="space-y-2">
              <Label htmlFor="preview-name">Name</Label>
              <Input id="preview-name" placeholder="Enter your name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="preview-select">Fruit</Label>
              <Select>
                <SelectTrigger id="preview-select">
                  <SelectValue placeholder="Select a fruit" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="apple">Apple</SelectItem>
                  <SelectItem value="banana">Banana</SelectItem>
                  <SelectItem value="blueberry">Blueberry</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="text-lg font-medium">Buttons & Badges</h3>
          <div className="flex flex-wrap gap-2 items-center">
            <Button>Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="destructive">Destructive</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="link">Link</Button>
            <Badge>Default Badge</Badge>
            <Badge variant="secondary">Secondary Badge</Badge>
            <Badge variant="destructive">Destructive Badge</Badge>
            <Badge variant="outline">Outline Badge</Badge>
          </div>
           <div className="flex gap-2 items-center">
            <Button size="icon" variant="outline"><User className="h-4 w-4" /></Button>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon" variant="outline"><Bell className="h-4 w-4" /></Button>
              </TooltipTrigger>
              <TooltipContent><p>Notifications</p></TooltipContent>
            </Tooltip>
             <Button size="icon"><PlusCircle className="h-4 w-4" /></Button>
          </div>
        </section>

        <Card className="w-full">
          <CardHeader>
            <CardTitle>Sample Card</CardTitle>
            <CardDescription>This is a card component to showcase the theme.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>
              The quick brown fox jumps over the lazy dog. This card uses themed background, text colors, and border radius.
            </p>
            <div className="flex items-center space-x-2">
              <Checkbox id="preview-terms" />
              <Label htmlFor="preview-terms" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                Accept terms and conditions
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Switch id="preview-airplane" />
              <Label htmlFor="preview-airplane">Airplane Mode</Label>
            </div>
             <div className="flex items-center space-x-2">
              <Avatar>
                <AvatarImage src="https://github.com/shadcn.png" alt="@shadcn" />
                <AvatarFallback>CN</AvatarFallback>
              </Avatar>
              <p className="text-sm font-medium">User McUsername</p>
            </div>
          </CardContent>
          <CardFooter className="flex justify-end gap-2">
            <Button variant="outline">Cancel</Button>
            <Button>Submit</Button>
          </CardFooter>
        </Card>

        <section className="space-y-2">
          <h3 className="text-lg font-medium">Calendar Example</h3>
          <Calendar
            mode="single"
            selected={date}
            onSelect={setDate}
            className="rounded-md border w-min"
          />
        </section>

      </div>
    </TooltipProvider>
  );
} 