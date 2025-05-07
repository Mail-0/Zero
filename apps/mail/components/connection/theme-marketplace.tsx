import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const themes = [
  { name: "Theme", color: "bg-[#0c0e1c]", text: "text-white", button: "bg-[#1c1f2e] text-white" },
  { name: "Theme", color: "bg-[#d7f5ff]", text: "text-[#02356c]", button: "bg-[#c6ecff] text-[#02356c]" },
  { name: "Emerald", color: "bg-[#b3f2c1]", text: "text-green-900", button: "bg-[#a3e4b3] text-green-900" },
  { name: "Orange", color: "bg-[#f5e6ff]", text: "text-purple-900", button: "bg-[#d9cfff] text-purple-900" },
  { name: "Pink", color: "bg-[#fcd2d2]", text: "text-red-800", button: "bg-[#f4b3b3] text-red-800" },
  { name: "Yellow", color: "bg-[#fff1c4]", text: "text-yellow-800", button: "bg-[#ffe599] text-yellow-800" },
  { name: "Theme", color: "bg-[#4580f3]", text: "text-white", button: "bg-[#3568c8] text-white" },
  { name: "Gray", color: "bg-[#d7d7d7]", text: "text-gray-800", button: "bg-[#bababa] text-gray-800" },
  { name: "Blue", color: "bg-[#143b4a]", text: "text-white", button: "bg-[#28566e] text-white" },
  { name: "Gray", color: "bg-[#699e99]", text: "text-white", button: "bg-[#53827d] text-white" }
];

export default function ThemeMarketplace({ open, onOpenChange, onCopy }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCopy: (theme: any) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Theme Marketplace</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {themes.map((theme, index) => (
            <Card key={index} className={`${theme.color} ${theme.text} rounded-xl`}>
              <CardContent className="p-6">
                <h2 className="text-2xl font-bold mb-2">{theme.name}</h2>
                <p className="mb-4">Lorem ipsum</p>
                <Button
                  className={`${theme.button} font-semibold px-4 py-2 rounded`}
                  onClick={() => {
                    onCopy(theme);
                    onOpenChange(false);
                  }}
                >
                  Copy
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
